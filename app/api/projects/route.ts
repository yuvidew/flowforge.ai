import { db, projects } from "@/db";
import { newBoardSchema } from "@/features/all-files/schema";
import { currentUser } from "@clerk/nextjs/server";
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
            })
            .returning();

        return NextResponse.json(row, { status: 201 });
    } catch (error) {
        console.error("POST /api/projects failed", error);
        return NextResponse.json({ error: "Failed to create board" }, { status: 500 });
    }
};

export const GET = async (req: NextRequest) => {
    try {
        const user = await currentUser();
    } catch (error) {
        console.error("POST /api/projects failed", error);
        return NextResponse.json({ error: "Failed to create board" }, { status: 500 });
    }
}
