import { Liveblocks } from "@liveblocks/node";
import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBoardAccess, getUserColor } from "@/lib/board-access";
import { getBoardIdFromRoomId } from "@/lib/liveblocks";

const liveblocks = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! });

const bodySchema = z.object({ room: z.string().min(1) });

// Issues a Liveblocks access token for one board room, only if the signed-in user owns the board or was invited.
export const POST = async (req: NextRequest) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const parsed = bodySchema.safeParse(await req.json().catch(() => null));
        const projectId = parsed.success ? getBoardIdFromRoomId(parsed.data.room) : null;

        if (!parsed.success || !projectId) {
            return NextResponse.json({ error: "Invalid room" }, { status: 400 });
        }

        const access = await getBoardAccess(email, projectId);

        if (!access) {
            return NextResponse.json({ error: "Board not found" }, { status: 404 });
        }

        // Shown on cursors and in the header's avatar stack for everyone else in the room.
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || email.split("@")[0];

        const session = liveblocks.prepareSession(user.id, {
            userInfo: { name, email, avatar: user.imageUrl, color: getUserColor(user.id) },
        });
        session.allow(parsed.data.room, session.FULL_ACCESS);

        const { status, body } = await session.authorize();
        return new NextResponse(body, { status, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        console.error("POST /api/liveblocks-auth failed", error);
        return NextResponse.json({ error: "Failed to authorize" }, { status: 500 });
    }
};
