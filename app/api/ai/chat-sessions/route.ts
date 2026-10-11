import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { listChatSessionsQuerySchema } from "@/features/workspace/schema";
import { listSessions } from "@/lib/chat-sessions";

// Lists the signed-in user's chat sessions on one board (?projectId=...), newest activity first.
export const GET = async (req: NextRequest) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const parsed = listChatSessionsQuerySchema.safeParse({
            projectId: req.nextUrl.searchParams.get("projectId"),
        });

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid request" },
                { status: 400 }
            );
        }

        const sessions = await listSessions(email, parsed.data.projectId);

        return NextResponse.json({ sessions });
    } catch (error) {
        console.error("GET /api/ai/chat-sessions failed", error);
        return NextResponse.json({ error: "Failed to load chat sessions" }, { status: 500 });
    }
};
