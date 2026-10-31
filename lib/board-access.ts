import { and, eq } from "drizzle-orm";
import { boardCollaborators, db, projects } from "@/db";
// How a user relates to a board: its owner, an invited collaborator, or neither (null).
export type BoardRole = "owner" | "collaborator";

// Resolves the user's role on a board in one round trip. Owners match projects.userEmail exactly (as elsewhere);
// collaborators match their lower-cased invite email.
export const getBoardAccess = async (email: string, projectId: string) => {
    const [board] = await db
        .select()
        .from(projects)
        .where(eq(projects.projectId, projectId))
        .limit(1);

    if (!board) return null;
    if (board.userEmail === email) return { board, role: "owner" as BoardRole };

    const [invite] = await db
        .select({ id: boardCollaborators.id })
        .from(boardCollaborators)
        .where(and(eq(boardCollaborators.projectId, projectId), eq(boardCollaborators.email, email.toLowerCase())))
        .limit(1);

    return invite ? { board, role: "collaborator" as BoardRole } : null;
};

// Deterministic cursor/avatar colour for a user id, so everyone sees the same colour for the same person.
const CURSOR_COLORS = ["#e03131", "#e8590c", "#f08c00", "#2f9e44", "#0c8599", "#1971c2", "#6741d9", "#c2255c"];
export const getUserColor = (userId: string) => {
    let hash = 0;
    for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return CURSOR_COLORS[hash % CURSOR_COLORS.length];
};
