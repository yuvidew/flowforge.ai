import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { chatMessagesQuerySchema, chatSessionIdSchema } from "@/features/workspace/schema";
import { getOwnedSession, listMessages } from "@/lib/chat-sessions";

type RouteContext = { params: Promise<{ sessionId: string }> };

// Returns one page of a chat session's messages (?limit=50&before=<messageId>), oldest first.
export const GET = async (req: NextRequest, { params }: RouteContext) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId } = await params;

        if (!chatSessionIdSchema.safeParse(sessionId).success) {
            return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
        }

        // Missing params come back as null; undefined lets zod apply the default / skip the cursor.
        const parsed = chatMessagesQuerySchema.safeParse({
            limit: req.nextUrl.searchParams.get("limit") ?? undefined,
            before: req.nextUrl.searchParams.get("before") ?? undefined,
        });

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid request" },
                { status: 400 }
            );
        }

        const session = await getOwnedSession(email, sessionId);

        if (!session) {
            return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
        }

        const page = await listMessages(sessionId, parsed.data.limit, parsed.data.before);

        return NextResponse.json(page);
    } catch (error) {
        console.error("GET /api/ai/chat-sessions/[sessionId]/messages failed", error);
        return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
    }
};
