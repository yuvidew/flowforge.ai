import { db, chatSessions, chatMessages } from "@/db";
import { and, desc, eq, lt } from "drizzle-orm";

// A chat session by id, only if it belongs to the user.
export const getOwnedSession = async (email: string, sessionId: string) => {
    const [row] = await db
        .select()
        .from(chatSessions)
        .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userEmail, email)))
        .limit(1);

    return row ?? null;
};

// The user's chat sessions on one board, most recently active first.
export const listSessions = (email: string, projectId: string) =>
    db
        .select({
            id: chatSessions.id,
            name: chatSessions.name,
            createdAt: chatSessions.createdAt,
            updatedAt: chatSessions.updatedAt,
        })
        .from(chatSessions)
        .where(and(eq(chatSessions.projectId, projectId), eq(chatSessions.userEmail, email)))
        .orderBy(desc(chatSessions.updatedAt));

// Renames an owned session; returns null when it doesn't exist or isn't the user's.
export const renameSession = async (email: string, sessionId: string, name: string) => {
    const [row] = await db
        .update(chatSessions)
        .set({ name })
        .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userEmail, email)))
        .returning({
            id: chatSessions.id,
            name: chatSessions.name,
            createdAt: chatSessions.createdAt,
            updatedAt: chatSessions.updatedAt,
        });

    return row ?? null;
};

// Deletes an owned session (its messages go with it via ON DELETE CASCADE); false when nothing matched.
export const deleteSession = async (email: string, sessionId: string) => {
    const rows = await db
        .delete(chatSessions)
        .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userEmail, email)))
        .returning({ id: chatSessions.id });

    return rows.length > 0;
};

// One page of a session's messages: the newest `limit` (or the ones older than `before`), returned oldest first.
// Fetches one extra row to learn whether an older page exists without a second count query.
export const listMessages = async (sessionId: string, limit: number, before?: number) => {
    const rows = await db
        .select({
            id: chatMessages.id,
            role: chatMessages.role,
            content: chatMessages.content,
            createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .where(
            before === undefined
                ? eq(chatMessages.sessionId, sessionId)
                : and(eq(chatMessages.sessionId, sessionId), lt(chatMessages.id, before)),
        )
        .orderBy(desc(chatMessages.id))
        .limit(limit + 1);

    const hasMore = rows.length > limit;

    return { messages: rows.slice(0, limit).reverse(), hasMore };
};

// Session name token from the first message
export const sessionNameFrom = (message: string) => {
    const text = message.replace(/\s+/g, " ").trim();
    return text.length > 40 ? `${text.slice(0, 40).trimEnd()}…` : text;
};

// The latest messages of a session (oldest first) that give the AI context for a follow-up.
export const recentMessages = async (sessionId: string, limit: number) => {
    const rows = await db
        .select({
            role: chatMessages.role,
            content: chatMessages.content
        })
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(desc(chatMessages.id))
        .limit(limit)

    return rows.reverse();
};

// Saves one finished turn (the user's message, then the assistant's answer) and marks the session as just used.
// A new chat (no `sessionId`) creates its session in the same batch, named after the first message. Everything goes
// through db.batch, which neon-http runs as one transaction, so a failure never leaves an empty session or half a turn.
// Returns the session and the saved assistant message's id (the client can correct it if the canvas step fails).
export const saveChatTurn = async ({
    email,
    projectId,
    sessionId,
    userContent,
    assistantContent,
}: {
    email: string;
    projectId: string;
    sessionId?: string;
    userContent: string;
    assistantContent: string;
}) => {
    const turn = (id: string) => [
        { sessionId: id, role: "user" as const, content: userContent },
        { sessionId: id, role: "assistant" as const, content: assistantContent },
    ];
    const returning = { id: chatMessages.id, role: chatMessages.role };

    if (sessionId) {
        const [messages] = await db.batch([
            db.insert(chatMessages).values(turn(sessionId)).returning(returning),
            db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, sessionId)),
        ]);

        return { sessionId, sessionName: "", assistantMessageId: assistantIdOf(messages) };
    }

    const id = crypto.randomUUID();
    const name = sessionNameFrom(userContent);
    const [, messages] = await db.batch([
        db.insert(chatSessions).values({ id, projectId, userEmail: email, name }),
        db.insert(chatMessages).values(turn(id)).returning(returning),
    ]);

    return { sessionId: id, sessionName: name, assistantMessageId: assistantIdOf(messages) };
};

// The id of the assistant row among the two just inserted.
const assistantIdOf = (rows: { id: number; role: "user" | "assistant" }[]) => {
    const row = rows.find((item) => item.role === "assistant");
    if (!row) throw new Error("Assistant message was not saved");
    return row.id;
};

// Replaces the text of a saved assistant message, only if it belongs to the session (the caller has checked the session
// is the user's). Used when the canvas step failed, so the history doesn't claim something that never happened.
export const updateAssistantMessage = async (sessionId: string, messageId: number, content: string) => {
    const rows = await db
        .update(chatMessages)
        .set({ content })
        .where(and(eq(chatMessages.id, messageId), eq(chatMessages.sessionId, sessionId), eq(chatMessages.role, "assistant")))
        .returning({ id: chatMessages.id });

    return rows.length > 0;
};
