import { db, projects, whiteboardData } from "@/db";
import { updateProjectSchema } from "@/features/all-files/schema";
import { getBoardAccess } from "@/lib/board-access";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ projectId: string }> };

// Returns a single board the signed-in user owns or was invited to (used by the workspace header).
export const GET = async (_req: NextRequest, { params }: RouteContext) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await params;

        // Owners and invited collaborators can open the board.
        const access = await getBoardAccess(email, projectId);

        if (!access) {
            return NextResponse.json({ error: "Board not found" }, { status: 404 });
        }

        return NextResponse.json(access.board);
    } catch (error) {
        console.error("GET /api/projects/[projectId] failed", error);
        return NextResponse.json({ error: "Failed to load board" }, { status: 500 });
    }
};

// Renames, pins, archives and/or publishes a board the signed-in user may manage.
export const PATCH = async (req: NextRequest, { params }: RouteContext) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await params;
        const body = await req.json().catch(() => null);
        const parsed = updateProjectSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid board data" },
                { status: 400 }
            );
        }

        // Only whitelisted fields are copied into the update; never spread the client body.
        const changes: Partial<typeof projects.$inferInsert> = {};
        if (parsed.data.name !== undefined) changes.projectName = parsed.data.name;
        if (parsed.data.isArchived !== undefined) changes.isArchived = parsed.data.isArchived;
        if (parsed.data.isPinned !== undefined) changes.isPinned = parsed.data.isPinned;
        // Archived boards are never favorites; this also wins over a pin sent in the same request.
        if (parsed.data.isArchived === true) changes.isPinned = false;
        if (parsed.data.isPublished !== undefined) changes.isPublished = parsed.data.isPublished;

        // Renaming, pinning, archiving and publishing need the board's creator or (on a team board) a workspace admin.
        const access = await getBoardAccess(email, projectId);

        if (!access) {
            return NextResponse.json({ error: "Board not found" }, { status: 404 });
        }

        if (!access.canManage) {
            return NextResponse.json({ error: "Only the board's creator or a workspace admin can change it" }, { status: 403 });
        }

        const [row] = await db
            .update(projects)
            .set(changes)
            .where(eq(projects.projectId, projectId))
            .returning();

        if (!row) {
            return NextResponse.json({ error: "Board not found" }, { status: 404 });
        }

        return NextResponse.json(row);
    } catch (error) {
        console.error("PATCH /api/projects/[projectId] failed", error);
        return NextResponse.json({ error: "Failed to update board" }, { status: 500 });
    }
};

// Deletes a board and its whiteboard data (child row first because of the foreign key).
export const DELETE = async (_req: NextRequest, { params }: RouteContext) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await params;

        // Access check before touching the child table.
        const access = await getBoardAccess(email, projectId);

        if (!access) {
            return NextResponse.json({ error: "Board not found" }, { status: 404 });
        }

        if (!access.canManage) {
            return NextResponse.json({ error: "Only the board's creator or a workspace admin can delete it" }, { status: 403 });
        }

        await db.delete(whiteboardData).where(eq(whiteboardData.projectId, projectId));
        await db.delete(projects).where(eq(projects.projectId, projectId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/projects/[projectId] failed", error);
        return NextResponse.json({ error: "Failed to delete board" }, { status: 500 });
    }
};
