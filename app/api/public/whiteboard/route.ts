import { db, projects, whiteboardData } from "@/db";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Public (no auth): returns a board's whiteboard only if its owner has published it.
export const GET = async (req: NextRequest) => {
    try {
        const projectId = req.nextUrl.searchParams.get("projectId");

        if (!projectId) {
            return NextResponse.json({ error: "Project id is required" }, { status: 400 });
        }

        // Unpublished and non-existent boards get the same 404 so existence isn't leaked.
        const [project] = await db
            .select({ projectName: projects.projectName })
            .from(projects)
            .where(and(eq(projects.projectId, projectId), eq(projects.isPublished, true)))
            .limit(1);

        if (!project) {
            return NextResponse.json({ error: "Board not found" }, { status: 404 });
        }

        const [row] = await db
            .select()
            .from(whiteboardData)
            .where(eq(whiteboardData.projectId, projectId))
            .limit(1);

        // Only whiteboard content and the title are exposed — never the owner's email.
        return NextResponse.json({
            projectName: project.projectName,
            elements: row?.elements ?? [],
            appState: row?.appState ?? {},
            files: row?.files ?? {},
        });
    } catch (error) {
        console.error("GET /api/public/whiteboard failed", error);
        return NextResponse.json({ error: "Failed to load board" }, { status: 500 });
    }
};
