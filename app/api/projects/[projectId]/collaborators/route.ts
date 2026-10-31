import { boardCollaborators, db } from "@/db";
import { addCollaboratorSchema, removeCollaboratorSchema } from "@/features/workspace/schema";
import { getBoardAccess } from "@/lib/board-access";
import { currentUser } from "@clerk/nextjs/server";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ projectId: string }> };

// Lists who can edit the board: the owner plus invited collaborators. Visible to anyone with access.
export const GET = async (_req: NextRequest, { params }: RouteContext) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await params;
        const access = await getBoardAccess(email, projectId);

        if (!access) {
            return NextResponse.json({ error: "Board not found" }, { status: 404 });
        }

        const rows = await db
            .select({ email: boardCollaborators.email })
            .from(boardCollaborators)
            .where(eq(boardCollaborators.projectId, projectId))
            .orderBy(asc(boardCollaborators.createdAt));

        return NextResponse.json({
            owner: access.board.userEmail,
            role: access.role,
            canManage: access.canManage,
            collaborators: rows.map((row) => row.email),
        });
    } catch (error) {
        console.error("GET /api/projects/[projectId]/collaborators failed", error);
        return NextResponse.json({ error: "Failed to load collaborators" }, { status: 500 });
    }
};

// Invites someone by email. Owner only.
export const POST = async (req: NextRequest, { params }: RouteContext) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await params;
        const access = await getBoardAccess(email, projectId);

        if (!access) {
            return NextResponse.json({ error: "Board not found" }, { status: 404 });
        }

        if (access.role !== "owner") {
            return NextResponse.json({ error: "Only the owner can invite people" }, { status: 403 });
        }

        // Team boards are open to the whole workspace; people are managed there (Clerk), not per board.
        if (access.board.orgId) {
            return NextResponse.json({ error: "Team boards are shared with the whole workspace" }, { status: 400 });
        }

        const parsed = addCollaboratorSchema.safeParse(await req.json().catch(() => null));

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid email" }, { status: 400 });
        }

        const invited = parsed.data.email;

        if (invited === access.board.userEmail.toLowerCase()) {
            return NextResponse.json({ error: "You already own this board" }, { status: 400 });
        }

        // The unique (project, email) index makes a repeat invite a no-op.
        await db.insert(boardCollaborators).values({ projectId, email: invited }).onConflictDoNothing();

        return NextResponse.json({ email: invited }, { status: 201 });
    } catch (error) {
        console.error("POST /api/projects/[projectId]/collaborators failed", error);
        return NextResponse.json({ error: "Failed to invite collaborator" }, { status: 500 });
    }
};

// Removes an invited collaborator. Owner only.
export const DELETE = async (req: NextRequest, { params }: RouteContext) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await params;
        const access = await getBoardAccess(email, projectId);

        if (!access) {
            return NextResponse.json({ error: "Board not found" }, { status: 404 });
        }

        if (access.role !== "owner") {
            return NextResponse.json({ error: "Only the owner can remove people" }, { status: 403 });
        }

        const parsed = removeCollaboratorSchema.safeParse(await req.json().catch(() => null));

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid email" }, { status: 400 });
        }

        await db
            .delete(boardCollaborators)
            .where(and(eq(boardCollaborators.projectId, projectId), eq(boardCollaborators.email, parsed.data.email)));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/projects/[projectId]/collaborators failed", error);
        return NextResponse.json({ error: "Failed to remove collaborator" }, { status: 500 });
    }
};
