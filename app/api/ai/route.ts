import { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest) => {
    try {
    } catch (error) {
        console.error("POST /api/users failed", error);
        return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
    }
}