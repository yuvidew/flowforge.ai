import { db, projects, whiteboardData } from "@/db";
import { updateProjectSchema } from "@/features/all-files/schema";
import { currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ projectId: string }> };

// Returns a single board owned by the signed-in user (used by the workspace header).
export const GET = async (_req: NextRequest, { params }: RouteContext) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await params;

        const [row] = await db
            .select()
            .from(projects)
            .where(and(eq(projects.projectId, projectId), eq(projects.userEmail, email)))
            .limit(1);

        if (!row) {
            return NextResponse.json({ error: "Board not found" }, { status: 404 });
        }

        return NextResponse.json(row);
    } catch (error) {
        console.error("GET /api/projects/[projectId] failed", error);
        return NextResponse.json({ error: "Failed to load board" }, { status: 500 });
    }
};

// Renames, archives and/or publishes a board owned by the signed-in user.
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
        if (parsed.data.isPublished !== undefined) changes.isPublished = parsed.data.isPublished;

        const [row] = await db
            .update(projects)
            .set(changes)
            .where(and(eq(projects.projectId, projectId), eq(projects.userEmail, email)))
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

        // Ownership check before touching the child table.
        const [owned] = await db
            .select({ id: projects.id })
            .from(projects)
            .where(and(eq(projects.projectId, projectId), eq(projects.userEmail, email)));

        if (!owned) {
            return NextResponse.json({ error: "Board not found" }, { status: 404 });
        }

        await db.delete(whiteboardData).where(eq(whiteboardData.projectId, projectId));
        await db.delete(projects).where(eq(projects.projectId, projectId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/projects/[projectId] failed", error);
        return NextResponse.json({ error: "Failed to delete board" }, { status: 500 });
    }
};
