import { db, projects, whiteboardData } from "@/db";
import { COVER_IMAGES } from "@/features/all-files/constants";
import type { PendingItem, SavedElement } from "@/features/workspace/types/types";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { summarizeScene } from "@/features/workspace/ai/summarize-scene";
import { readDiagrams } from "@/features/workspace/ai/read-diagrams";


// The Excalidrow elements daved for a board
const getSavedElements = async (boardId: string) => {
    const [row] = await db
        .select({ elements: whiteboardData.elements })
        .from(whiteboardData)
        .where(eq(whiteboardData.projectId, boardId))
        .limit(1);

    return (Array.isArray(row?.elements) ? row.elements : []) as SavedElement[];
};

// Reads a board's saved scene from the database and returns the compact version for the AI.
export const getBoardScene = async (boardId: string) => {
    return summarizeScene(await getSavedElements(boardId))
};

// One saved diagram of a board rebuilt as a spec, or null when it isn't saved on the board (a diagram still waiting
// in the queue isn't).
export const getBoardDiagram = async (boardId: string, diagramId: string) =>
    readDiagrams(await getSavedElements(boardId)).find((diagram) => diagram.diagramId === diagramId) ?? null;

// Which workspace to search or create in: a Clerk organization id, "personal" for the user's own boards, or undefined
// for "any board of the user" (the pre-workspace behaviour).
export type WorkspaceScope = { orgId: string } | "personal" | undefined;

// Active boards whose name matches exactly, ignoring case. Limit 2 is enough to tell "ambiguous" from "unique".
// A team workspace lists every member's boards; personal and unscoped lookups only see the user's own.
export const findBoardsByName = (email: string, name: string, scope?: WorkspaceScope) =>
    db
        .select()
        .from(projects)
        .where(
            and(
                scope && scope !== "personal" ? eq(projects.orgId, scope.orgId) : eq(projects.userEmail, email),
                scope === "personal" ? isNull(projects.orgId) : undefined,
                eq(projects.isArchived, false),
                sql`lower(${projects.projectName}) = ${name.trim().toLowerCase()}`,
            ),
        )
        .limit(2);

// A board by id, only if it belongs to the user or to a workspace (orgIds) the user is a member of.
export const getOwnedBoard = async (email: string, boardId: string, orgIds: string[] = []) => {
    const [row] = await db
        .select()
        .from(projects)
        .where(
            and(
                eq(projects.projectId, boardId),
                or(eq(projects.userEmail, email), orgIds.length > 0 ? inArray(projects.orgId, orgIds) : undefined),
            )
        )
        .limit(1);

    return row ?? null;
}

// Creates a board the same way POST /api/projects does.
// orgId puts it in that team workspace; omitted or null creates a personal board.
export const createBoardForUser = async (email: string, name: string, orgId: string | null = null) => {
    const [row] = await db
        .insert(projects)
        .values({
            projectId: crypto.randomUUID(),
            projectName: name,
            userEmail: email,
            orgId,
            coverImage: COVER_IMAGES[Math.floor(Math.random() * COVER_IMAGES.length)],
        })
        .returning();
    return row;
}

// Appends a diagram to the board's queue in one statement (creating the whiteboard row if the board was never saved),
// so concurrent calls and the browser's ack can't overwrite each other.
export const queueDiagram = async (boardId: string, item: PendingItem) => {
    const added = JSON.stringify([item]);

    await db
        .insert(whiteboardData)
        .values({ projectId: boardId, pendingDiagrams: [item] })
        .onConflictDoUpdate({
            target: whiteboardData.projectId,
            set: { pendingDiagrams: sql`COALESCE(${whiteboardData.pendingDiagrams}, '[]'::jsonb) || ${added}::jsonb` },
        });
};

// Sets the board's published flag; returns the updated board, or null if it isn't the user's.
export const setBoardPublished = async (email: string, boardId: string, isPublished: boolean) => {
    const [row] = await db
        .update(projects)
        .set({ isPublished })
        .where(and(eq(projects.projectId, boardId), eq(projects.userEmail, email)))
        .returning();
    return row ?? null;
};

// How many MCP diagrams are still waiting to be drawn in the browser (they are not on the public page yet).
export const countPendingDiagrams = async (boardId: string) => {
    const [row] = await db
        .select({ pending: whiteboardData.pendingDiagrams })
        .from(whiteboardData)
        .where(eq(whiteboardData.projectId, boardId))
        .limit(1);
    return Array.isArray(row?.pending) ? row.pending.length : 0;
};

// SQL expression for a board's pending queue minus the given ids. Used inside an UPDATE / ON CONFLICT so removal
// is one atomic statement (a diagram queued meanwhile is never lost, and the Neon HTTP driver has no transactions).
export const withoutPendingIds = (ids: string[]) => {
    const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `);
    return sql`COALESCE((SELECT jsonb_agg(item) FROM jsonb_array_elements(${whiteboardData.pendingDiagrams}) AS item WHERE item->>'id' NOT IN (${idList})), '[]'::jsonb)`;
};

