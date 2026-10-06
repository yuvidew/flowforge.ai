import { createMistral } from "@ai-sdk/mistral";
import { currentUser } from "@clerk/nextjs/server";
import { APICallError, generateText, NoObjectGeneratedError, Output, RetryError } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { diagramSchema } from "@/features/workspace/ai/diagram-schema";
import { getSystemPrompt, getUserPrompt } from "@/features/workspace/ai/prompts";
import { generateDiagramSchema } from "@/features/workspace/schema";

// Model calls can take a while; lets hosts that cap function time (e.g. Vercel) allow it.
export const maxDuration = 120;

// Reads the key from MISTRAL_API_KEY (the SDK default) or the MISTRAL_AI name used in this project's .env.
const mistral = createMistral({ apiKey: process.env.MISTRAL_API_KEY ?? process.env.MISTRAL_AI });

// Each model gets its own time limit, so one that hangs can't use up the whole request; 2 x 55s fits maxDuration.
const MODEL_TIMEOUT_MS = 55_000;
// Pause after a rate-limit response before trying the next model; the limit is account-wide, so switching alone doesn't help.
const RATE_LIMIT_PAUSE_MS = 2_000;
// Upper bound on the reply size; stops a small model from rambling (slow, and burns the free-tier quota).
const MAX_OUTPUT_TOKENS = 7_000;

// Mistral models to try in order, those with a non-zero rate limit on this free account first; a busy, rate-limited or plan-restricted one falls back to the next.
const MODELS = ["ministral-14b-latest", "ministral-8b-latest"] as const;

// Unwraps the SDK's RetryError to the underlying API error, if any.
const getApiError = (error: unknown) => {
    const cause = RetryError.isInstance(error) ? error.lastError : error;
    return APICallError.isInstance(cause) ? cause : null;
};

// Whether an error means the model is overloaded or rate limited (worth trying later).
const isBusyError = (error: unknown) => {
    const status = getApiError(error)?.statusCode;
    return status === 429 || status === 503;
};

// Whether this model's own time limit ran out (AbortSignal.timeout surfaces as a TimeoutError).
const isTimeoutError = (error: unknown) => {
    const cause = RetryError.isInstance(error) ? error.lastError : error;
    return cause instanceof Error && cause.name === "TimeoutError";
};

// Whether another model is worth trying: busy, timed out, or not available on the account's plan (403/404).
const canTryNextModel = (error: unknown) => {
    const status = getApiError(error)?.statusCode;
    return isBusyError(error) || isTimeoutError(error) || status === 403 || status === 404;
};

// Short reason for logs: HTTP status and provider message, or the error name.
const describeError = (error: unknown) => {
    const apiError = getApiError(error);
    if (apiError) return `HTTP ${apiError.statusCode}: ${apiError.message}`;
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
};

// Asks one Mistral model for a schema-validated diagram.
const generate = async (
    model: (typeof MODELS)[number],
    mode: Parameters<typeof getSystemPrompt>[0],
    prompt: string,
    abortSignal: AbortSignal
) => {
    const { output } = await generateText({
        model: mistral(model),
        output: Output.object({ schema: diagramSchema }),
        system: getSystemPrompt(mode),
        prompt: getUserPrompt(prompt),
        temperature: 0.3,
        maxRetries: 1,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal,
    });
    return output;
};

// Generates a diagram (nodes/edges/texts JSON) for the signed-in user from a mode + description.
export const POST = async (req: NextRequest) => {
    try {
        const user = await currentUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // A malformed/empty JSON body is a client error, not a 500.
        const body = await req.json().catch(() => null);
        const parsed = generateDiagramSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid request" },
                { status: 400 }
            );
        }

        const { mode, prompt } = parsed.data;

        // Structured output: the SDK makes Mistral return JSON and validates it against the diagram schema.
        // One retry per model plus a per-model time limit keep the total bounded; a busy, slow or restricted model
        // falls through to the next one.
        let lastError: unknown;
        let output: Awaited<ReturnType<typeof generate>> | undefined;

        for (const model of MODELS) {
            try {
                output = await generate(model, mode, prompt, AbortSignal.timeout(MODEL_TIMEOUT_MS));
                break;
            } catch (error) {
                lastError = error;
                if (!canTryNextModel(error)) throw error;
                console.warn(`Model ${model} skipped (${describeError(error)}), trying the next one`);
                if (getApiError(error)?.statusCode === 429) {
                    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_PAUSE_MS));
                }
            }
        }

        if (!output) throw lastError;

        return NextResponse.json(output);
    } catch (error) {
        console.error("POST /api/ai/generate failed", error);

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

        return NextResponse.json({ error: "Failed to generate diagram" }, { status: 500 });
    }
};
