import { db, projects, whiteboardData } from "@/db";
import { saveWhiteboardSchema } from "@/features/workspace/schema";
import { currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withoutPendingIds } from "@/lib/boards";




// Finds the project only if it belongs to the given user email (ownership check shared by GET/POST).
const getOwnedProject = async (projectId: string, email: string) => {
    const [project] = await db
        .select({ projectId: projects.projectId })
        .from(projects)
        .where(and(eq(projects.projectId, projectId), eq(projects.userEmail, email)))
        .limit(1);
    return project;
};

// Saves (upserts) the whiteboard for a project owned by the signed-in user.
export const POST = async (req: NextRequest) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // A malformed/empty JSON body is a client error, not a 500.
        const body = await req.json().catch(() => null);
        const parsed = saveWhiteboardSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid whiteboard data" },
                { status: 400 }
            );
        }

        const { projectId, elements, appState, files, ackPendingIds  } = parsed.data;

        // Ownership check: the project must belong to the signed-in user.
        const project = await getOwnedProject(projectId, email);

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Relies on the unique constraint on whiteboardData.projectId.
        await db
            .insert(whiteboardData)
            .values({ projectId, elements, appState, files })
            .onConflictDoUpdate({
                target: whiteboardData.projectId,
                set: {
                    elements,
                    appState,
                    files,
                    updatedAt: new Date(),
                    // Same statement as the scene save: a diagram leaves the queue exactly when it is saved.
                    ...(ackPendingIds?.length ? { pendingDiagrams: withoutPendingIds(ackPendingIds) } : {}),
                },

            });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("POST /api/whiteboard failed", error);
        return NextResponse.json({ error: "Failed to save whiteboard" }, { status: 500 });
    }
};

// Loads the saved whiteboard for a project owned by the signed-in user (empty board if none saved yet).
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

        const project = await getOwnedProject(projectId, email);

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const [row] = await db
            .select()
            .from(whiteboardData)
            .where(eq(whiteboardData.projectId, projectId))
            .limit(1);

        return NextResponse.json({
            elements: row?.elements ?? [],
            appState: row?.appState ?? {},
            files: row?.files ?? {},
        });
    } catch (error) {
        console.error("GET /api/whiteboard failed", error);
        return NextResponse.json({ error: "Failed to load whiteboard" }, { status: 500 });
    }
};
