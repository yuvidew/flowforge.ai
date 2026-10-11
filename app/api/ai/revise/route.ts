import { currentUser } from "@clerk/nextjs/server";
import { NoObjectGeneratedError } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { diagramSchema } from "@/features/workspace/ai/diagram-schema";
import { getReviseSystemPrompt, getReviseUserPrompt } from "@/features/workspace/ai/prompts";
import { reviseDiagramSchema } from "@/features/workspace/schema";
import { generateObjectWithFallback, isBusyError, isTimeoutError } from "@/lib/ai-model";

// Model calls can take a while; lets hosts that cap function time (e.g. Vercel) allow it.
export const maxDuration = 120;

// Returns the complete updated diagram (nodes/edges JSON) after applying a requested change to the current one.
// The client re-lays it out and swaps it in for the old diagram.
export const POST = async (req: NextRequest) => {
    try {
        const user = await currentUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // A malformed/empty JSON body is a client error, not a 500.
        const body = await req.json().catch(() => null);
        const parsed = reviseDiagramSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid request" },
                { status: 400 }
            );
        }

        const { mode, instruction, spec } = parsed.data;

        const output = await generateObjectWithFallback({
            schema: diagramSchema,
            system: getReviseSystemPrompt(mode),
            prompt: getReviseUserPrompt({ spec, instruction }),
        });

        return NextResponse.json(output);
    } catch (error) {
        console.error("POST /api/ai/revise failed", error);

        if (NoObjectGeneratedError.isInstance(error)) {
            // Server-side only: shows what the model actually returned and why it failed validation.
            console.error("Model output that failed validation:", error.text?.slice(0, 2000), error.cause);
            return NextResponse.json(
                { error: "The AI returned an invalid diagram. Please try again." },
                { status: 502 }
            );
        }

        if (isBusyError(error) || isTimeoutError(error)) {
            return NextResponse.json(
                { error: "AI is busy right now. Please try again in a moment." },
                { status: 503 }
            );
        }

        return NextResponse.json({ error: "Failed to revise diagram" }, { status: 500 });
    }
};
