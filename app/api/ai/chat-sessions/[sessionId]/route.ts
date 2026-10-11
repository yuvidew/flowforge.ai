import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { chatSessionIdSchema, renameChatSessionSchema } from "@/features/workspace/schema";
import { deleteSession, renameSession } from "@/lib/chat-sessions";

type RouteContext = { params: Promise<{ sessionId: string }> };

// Renames a chat session owned by the signed-in user.
export const PATCH = async (req: NextRequest, { params }: RouteContext) => {
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

        const body = await req.json().catch(() => null);
        const parsed = renameChatSessionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid name" },
                { status: 400 }
            );
        }

        const session = await renameSession(email, sessionId, parsed.data.name);

        if (!session) {
            return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
        }

        return NextResponse.json(session);
    } catch (error) {
        console.error("PATCH /api/ai/chat-sessions/[sessionId] failed", error);
        return NextResponse.json({ error: "Failed to rename chat session" }, { status: 500 });
    }
};

// Deletes a chat session (and its messages) owned by the signed-in user.
export const DELETE = async (_req: NextRequest, { params }: RouteContext) => {
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

        const deleted = await deleteSession(email, sessionId);

        if (!deleted) {
            return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/ai/chat-sessions/[sessionId] failed", error);
        return NextResponse.json({ error: "Failed to delete chat session" }, { status: 500 });
    }
};
