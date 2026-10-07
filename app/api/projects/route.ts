import { db, projects } from "@/db";
import { COVER_IMAGES } from "@/features/all-files/constants";
import { newBoardSchema, projectsQuerySchema } from "@/features/all-files/schema";
import { currentUser } from "@clerk/nextjs/server";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Creates a board (project) owned by the signed-in user.
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

        // Only whitelisted fields are inserted; the id is generated server-side, never taken from the client.
        const [row] = await db
            .insert(projects)
            .values({
                projectId: crypto.randomUUID(),
                projectName: parsed.data.name,
                userEmail: email,
                coverImage: COVER_IMAGES[Math.floor(Math.random() * COVER_IMAGES.length)],
            })
            .returning();

        return NextResponse.json(row, { status: 201 });
    } catch (error) {
        console.error("POST /api/projects failed", error);
        return NextResponse.json({ error: "Failed to create board" }, { status: 500 });
    }
};

// Lists a page of the signed-in user's boards (active or archived), newest first, optionally filtered by name.
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

        const { archived, search, page, pageSize } = parsed.data;

        // Escape LIKE wildcards so a typed "%" or "_" is matched literally.
        const escaped = search.replace(/[\\%_]/g, "\\$&");

        const where = and(
            eq(projects.userEmail, email),
            eq(projects.isArchived, archived === "true"),
            search ? ilike(projects.projectName, `%${escaped}%`) : undefined
        );

        const [rows, [{ total }]] = await Promise.all([
            db
                .select()
                .from(projects)
                .where(where)
                .orderBy(desc(projects.createdAt))
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
