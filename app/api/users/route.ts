import { db, users } from "@/db";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Finds or creates the DB row for the signed-in Clerk user.
// Uses a single atomic upsert so concurrent calls (double effects, webhook) can't hit the unique email constraint.
export const POST = async () => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const [row] = await db
            .insert(users)
            .values({ clerkId: user.id, name: user.fullName, email })
            .onConflictDoUpdate({
                target: users.email,
                // Backfills clerkId/name on rows created before they were stored; credits are left untouched.
                set: { clerkId: user.id, name: user.fullName },
            })
            .returning();

        return NextResponse.json(row);
    } catch (error) {
        console.error("POST /api/users failed", error);
        return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
    }
};
