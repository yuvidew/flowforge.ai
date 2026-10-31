import { db, projects } from "@/db";
import { COVER_IMAGES } from "@/features/all-files/constants";
import { newBoardSchema, projectsQuerySchema } from "@/features/all-files/schema";
import { auth, currentUser } from "@clerk/nextjs/server";
import { and, count, desc, eq, ilike, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Creates a board owned by the signed-in user, inside the active team workspace when one is selected (otherwise personal).
export const POST = async (req: NextRequest) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // A malformed/empty JSON body is a client error, not a 500.
        const body = await req.json().catch(() => null);
        const parsed = newBoardSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid board data" },
                { status: 400 }
            );
        }

        // The workspace comes from the session, never from the request body, so nobody can create boards in another team.
        const { orgId } = await auth();

        // Only whitelisted fields are inserted; the id is generated server-side, never taken from the client.
        const [row] = await db
            .insert(projects)
            .values({
                projectId: crypto.randomUUID(),
                projectName: parsed.data.name,
                userEmail: email,
                orgId: orgId ?? null,
                coverImage: COVER_IMAGES[Math.floor(Math.random() * COVER_IMAGES.length)],
            })
            .returning();

        return NextResponse.json(row, { status: 201 });
    } catch (error) {
        console.error("POST /api/projects failed", error);
        return NextResponse.json({ error: "Failed to create board" }, { status: 500 });
    }
};

// Lists a page of the active workspace's boards (a team's boards for every member, or the user's own personal boards), newest first.
export const GET = async (req: NextRequest) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const parsed = projectsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid query" },
                { status: 400 }
            );
        }

        const { archived, pinned, search, page, pageSize } = parsed.data;

        // The active Clerk organization decides which workspace is listed; no active org means the personal workspace.
        const { orgId } = await auth();

        // Escape LIKE wildcards so a typed "%" or "_" is matched literally.
        const escaped = search.replace(/[\\%_]/g, "\\$&");

        const where = and(
            orgId ? eq(projects.orgId, orgId) : and(eq(projects.userEmail, email), isNull(projects.orgId)),
            eq(projects.isArchived, archived === "true"),
            pinned === "true" ? eq(projects.isPinned, true) : undefined,
            search ? ilike(projects.projectName, `%${escaped}%`) : undefined
        );

        const [rows, [{ total }]] = await Promise.all([
            db
                .select()
                .from(projects)
                .where(where)
                // Pinned boards stay first on every page; the rest are newest first.
                .orderBy(desc(projects.isPinned), desc(projects.createdAt))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
            db.select({ total: count() }).from(projects).where(where),
        ]);

        return NextResponse.json({
            projects: rows,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (error) {
        console.error("GET /api/projects failed", error);
        return NextResponse.json({ error: "Failed to load boards" }, { status: 500 });
    }
}
