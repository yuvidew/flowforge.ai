import { db, whiteboardData } from "@/db";
import type { PendingItem, WriteSceneInput, WriteSceneResult } from "@/features/workspace/types/types";
import { and, eq, sql } from "drizzle-orm";
import { withoutPendingIds } from "./boards";
import type { SceneElement } from "@/lib/scene-elements";


// The open workspace polls every 3s, so a board seen within this window is treated as open in a browser.
const PRESENCE_WINDOW_MS = 15_000;

// The ONLY function that writes a board's elements. One conditional UPDATE (the Neon HTTP driver has no transactions):
// it matches only while the stored version still equals baseVersion, so a stale writer gets a conflict instead of
// silently erasing newer work
export const writeScene = async ({
    projectId,
    elements,
    appState,
    files,
    baseVersion,
    ackPendingIds,
}: WriteSceneInput): Promise<WriteSceneResult> => {
    // Make sure the row exists so the conditional UPDATE below has something to match (first save of a new board).
    await db.insert(whiteboardData).values({ projectId }).onConflictDoNothing({ target: whiteboardData.projectId });

    const [updated] = await db
        .update(whiteboardData)
        .set({
            elements,
            ...(appState ? { appState } : {}),
            ...(files ? { files } : {}),
            updatedAt: new Date(),
            version: sql`${whiteboardData.version} + 1`,
            // Same statement as the scene write: a queued item leaves the queue exactly when its result is saved.
            ...(ackPendingIds?.length ? { pendingDiagrams: withoutPendingIds(ackPendingIds) } : {}),
        })
        .where(
            and(
                eq(whiteboardData.projectId, projectId),
                baseVersion === undefined ? undefined : eq(whiteboardData.version, baseVersion)
            )
        )
        .returning({ version: whiteboardData.version });

    if (updated) return { ok: true, version: updated.version }

    const [row] = await db
        .select({ version: whiteboardData.version })
        .from(whiteboardData)
        .where(eq(whiteboardData.projectId, projectId))
        .limit(1);
    return { ok: false, serverVersion: row?.version ?? 0 };
};

// Reads the stored scene together with its version and the MCP queue.
export const loadScene = async (projectId: string) => {
    const [row] = await db
        .select({ 
            elements: whiteboardData.elements,
            version: whiteboardData.version,
            pending: whiteboardData.pendingDiagrams,
        })
        .from(whiteboardData)
        .where(
            eq(whiteboardData.projectId, projectId)
        )
        .limit(1);

    return {
    elements: (Array.isArray(row?.elements) ? row.elements : []) as SceneElement[],
    version: row?.version ?? 0,
    pending: (Array.isArray(row?.pending) ? row.pending : []) as PendingItem[],
  };
};

// True when a workspace tab polled this board recently, i.e. the browser can draw it itself with exact text metrics.
export const isBoardOpenInBrowser = async (projectId: string) => {
    const [row] = await db
        .select({ lastSeenAt: whiteboardData.lastSeenAt })
        .from(whiteboardData)
        .where(
            eq(whiteboardData.projectId, projectId)
        )
        .limit(1);

    return !!row?.lastSeenAt && Date.now() - row.lastSeenAt.getTime() < PRESENCE_WINDOW_MS;
};
