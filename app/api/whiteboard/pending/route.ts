import { db, projects, whiteboardData } from "@/db";
import { ackPendingDiagramsSchema } from "@/features/workspace/schema";
import { withoutPendingIds } from "@/lib/boards";
import { currentUser } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Same ownership check as /api/whiteboard; goes away once that logic moves into a shared module.
const getOwnedProject = async (projectId: string, email: string) => {
    const [project] = await db
        .select({ projectId: projects.projectId })
        .from(projects)
        .where(and(eq(projects.projectId, projectId), eq(projects.userEmail, email)))
        .limit(1);
    return project;
};

// Returns the diagrams the MCP server queued for a board owned by the signed-in user.
export const GET = async (req: NextRequest) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const projectId = req.nextUrl.searchParams.get("projectId");

        if (!projectId) {
            return NextResponse.json({ error: "Project id is required" }, { status: 400 });
        }

        if (!(await getOwnedProject(projectId, email))) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const [row] = await db
            .select({ pending: whiteboardData.pendingDiagrams})
            .from(whiteboardData)
            .where(eq(whiteboardData.projectId, projectId))
            .limit(1);

        return NextResponse.json({ pending: row.pending ?? [] })
    } catch (error) {
        console.error("GET /api/whiteboard/pending failed", error);
        return NextResponse.json({ error: "Failed to load pending diagrams" }, { status: 500 });
    }
}

// Removes drawn diagram from the queue.
export const POST = async (req: NextRequest) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const parsed = ackPendingDiagramsSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid request" },
                { status: 400 }
            );
        }

        const {projectId, ids} = parsed.data;

        if (!(await getOwnedProject(projectId, email))) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // One statement filters the array in the database, so a diagram queued by the MCP meanwhile is never lost
        // (a read-modify-write would drop it, and the Neon HTTP driver has no interactive transactions).
        const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `);

        await db
            .update(whiteboardData)
            .set({ pendingDiagrams: withoutPendingIds(ids) })
            .where(eq(whiteboardData.projectId, projectId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("POST /api/whiteboard/pending failed", error);
        return NextResponse.json({ error: "Failed to update pending diagrams" }, { status: 500 });
    }
}