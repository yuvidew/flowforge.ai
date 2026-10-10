import { db, projects, whiteboardData } from "@/db";
import { COVER_IMAGES } from "@/features/all-files/constants";
import type { PendingDiagram } from "@/features/workspace/types/types";
import { and, eq, sql } from "drizzle-orm";

// Max elements sent to the AI; a bigger board is cut off so the reply stays small.
const MAX_SCENE_ELEMENTS = 300;

// The few fields we read from a saved Excalidraw element (the real element has many more).
type SavedElement = {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    containerId?: string | null;
    backgroundColor?: string;
    strokeColor?: string;
    isDeleted?: boolean;
    startBinding?: { elementId: string } | null;
    endBinding?: { elementId: string } | null;
    customData?: { nodeId?: string; diagramId?: string };
};

// Reads a board's saved scene and returns a compact version for the AI: no files/images, no deleted
// elements, and the text inside a shape or arrow merged into that shape as `text`.
export const getBoardScene = async (boardId: string) => {
    const [row] = await db
        .select({ elements: whiteboardData.elements })
        .from(whiteboardData)
        .where(eq(whiteboardData.projectId, boardId))
        .limit(1);

    const saved = (Array.isArray(row?.elements) ? row.elements : []) as SavedElement[];
    const live = saved.filter((element) => !element.isDeleted);

    // Excalidraw stores a shape's label as a separate text element pointing at the shape via containerId.
    const labels = new Map<string, string>();
    live.forEach((ele) => {
        if (ele.type === "text" && ele.containerId && ele.text) {
            labels.set(ele.containerId, ele.text);
        }
    });

    const elements = live
        // Those label texts are merged into their shape below, so skip them as separate items.
        .filter((element) => !(element.type === "text" && element.containerId))
        .map((element) => ({
            id: element.id,
            nodeId: element.customData?.nodeId ?? null,
            diagramId: element.customData?.diagramId ?? null,
            type: element.type,
            x: Math.round(element.x),
            y: Math.round(element.y),
            width: Math.round(element.width),
            height: Math.round(element.height),
            text: element.type === "text" ? element.text : labels.get(element.id),
            fill: element.backgroundColor,
            stroke: element.strokeColor,
            // Only arrows have these: which shapes they connect.
            from: element.startBinding?.elementId,
            to: element.endBinding?.elementId,
        }));

    return {
        total: elements.length,
        truncated: elements.length > MAX_SCENE_ELEMENTS,
        elements: elements.slice(0, MAX_SCENE_ELEMENTS),
    };
}

// Active boards of a user whose name matches exactly, ignoring case. Limit 2 is enough to tell "ambiguous" from "unique".
export const findBoardsByName = (email: string, name: string) =>
    db
        .select()
        .from(projects)
        .where(
            and(
                eq(projects.userEmail, email),
                eq(projects.isArchived, false),
                sql`lower(${projects.projectName}) = ${name.trim().toLowerCase()}`,
            ),
        )
        .limit(2);

// A board by id, only if it belongs to the user.
export const getOwnedBoard = async (email: string, boardId: string) => {
    const [row] = await db
        .select()
        .from(projects)
        .where(
            and(
                eq(projects.projectId, boardId),
                eq(projects.userEmail, email)
            )
        )
        .limit(1);

    return row ?? null;
}

// Creates a board the same way POST /api/projects does.
export const createBoardForUser = async (email: string, name: string) => {
    const [row] = await db
        .insert(projects)
        .values({
            projectId: crypto.randomUUID(),
            projectName: name,
            userEmail: email,
            coverImage: COVER_IMAGES[Math.floor(Math.random() * COVER_IMAGES.length)],
        })
        .returning();
    return row;
}

// Appends a diagram to the board's queue in one statement (creating the whiteboard row if the board was never saved),
// so concurrent calls and the browser's ack can't overwrite each other.
export const queueDiagram = async (boardId: string, item: PendingDiagram) => {
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

