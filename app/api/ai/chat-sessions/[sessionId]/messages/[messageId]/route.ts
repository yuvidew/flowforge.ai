import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { chatMessageIdSchema, chatSessionIdSchema, updateChatMessageSchema } from "@/features/workspace/schema";
import { getOwnedSession, updateAssistantMessage } from "@/lib/chat-sessions";

type RouteContext = { params: Promise<{ sessionId: string; messageId: string }> };

// Corrects the text of a saved assistant message in a session owned by the signed-in user. The client uses it when the
// canvas step (edit, redraw, new diagram) failed after the reply was saved.
export const PATCH = async (req: NextRequest, { params }: RouteContext) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId, messageId } = await params;
        const parsedMessageId = chatMessageIdSchema.safeParse(messageId);

        if (!chatSessionIdSchema.safeParse(sessionId).success || !parsedMessageId.success) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        const body = await req.json().catch(() => null);
        const parsed = updateChatMessageSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid message" },
                { status: 400 }
            );
        }

        const session = await getOwnedSession(email, sessionId);

        if (!session || !(await updateAssistantMessage(sessionId, parsedMessageId.data, parsed.data.content))) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH /api/ai/chat-sessions/[sessionId]/messages/[messageId] failed", error);
        return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
    }
};
