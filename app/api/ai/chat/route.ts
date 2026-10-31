import { currentUser } from "@clerk/nextjs/server";
import { NoObjectGeneratedError } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { getChatSystemPrompt, getChatUserPrompt, indexDiagrams, leaksSystemPrompt, PROMPT_LEAK_REPLY } from "@/features/workspace/ai/prompts";
import { chatActionSchema, chatRequestSchema } from "@/features/workspace/schema";
import type { ChatResponse, ChatResult } from "@/features/workspace/types/types";
import { generateEditOps } from "@/lib/ai-edit";
import { generateObjectWithFallback, isBusyError, isTimeoutError } from "@/lib/ai-model";
import { getBoardAccess } from "@/lib/board-access";
import { getOwnedSession, recentMessages, saveChatTurn } from "@/lib/chat-sessions";

// An edit makes two model calls (decide, then edit); lets hosts that cap function time (e.g. Vercel) allow it.
export const maxDuration = 120;

// How many earlier messages of the session the router sees besides the new one.
const HISTORY_LIMIT = 12;

// One chat turn: decides whether to reply, draw a new diagram or edit shapes, and for edits also produces the
// operations. The turn is saved to the session (created on the first message). Drawing a new diagram is left to the
// client, which calls POST /api/ai/generate with the returned mode and prompt.
export const POST = async (req: NextRequest) => {
    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!user || !email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // A malformed/empty JSON body is a client error, not a 500.
        const body = await req.json().catch(() => null);
        const parsed = chatRequestSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid request" },
                { status: 400 }
            );
        }

        const { projectId, sessionId, message, scene, selected, mode } = parsed.data;

        const board = await getBoardAccess(email, projectId);

        if (!board) {
            return NextResponse.json({ error: "Board not found" }, { status: 404 });
        }

        // A continued session must belong to this user and this board; a new one is only created after the model answers.
        let history: Awaited<ReturnType<typeof recentMessages>> = [];

        if (sessionId) {
            const session = await getOwnedSession(email, sessionId);

            if (!session || session.projectId !== projectId) {
                return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
            }

            history = await recentMessages(sessionId, HISTORY_LIMIT);
        }

        const decision = await generateObjectWithFallback({
            schema: chatActionSchema,
            system: getChatSystemPrompt(),
            prompt: getChatUserPrompt({
                messages: [...history, { role: "user", content: message }],
                scene,
                selected,
                mode,
            }),
        });

        let result: ChatResult;

        if (decision.action === "revise") {
            // The model names the diagram by its short label (D1, D2, ...); map it back to the real diagramId.
            const diagramId = [...indexDiagrams(scene)].find(([, label]) => label === decision.diagram)?.[0];
            const diagramMode = scene.find((item) => item.diagramId === diagramId)?.mode;

            // Mockups are spatial layouts that can't be re-laid out automatically, so they can't be revised.
            result =
                !diagramId || diagramMode === "web" || diagramMode === "mobile"
                    ? {
                          action: "reply",
                          message: "I couldn't tell which diagram to change. Select a shape in it, or draw a new diagram that includes the change.",
                      }
                    : { action: "revise", diagramId, instruction: decision.instruction, message: decision.message };
        } else if (decision.action === "edit") {
            const { ops } = await generateEditOps({ prompt: decision.instruction, scene, selected });

            // The model found nothing it could change; say so in the chat instead of applying an empty edit.
            result =
                ops.length === 0
                    ? {
                          action: "reply",
                          message: "I couldn't find a shape that matches that. Try selecting it on the canvas or naming it exactly.",
                      }
                    : { action: "edit", ops, message: decision.message };
        } else {
            // reply and create already have the shape the client needs.
            result = decision;
        }

        // Backstop for the prompt's confidentiality rule: never show or store a message that quotes the system prompt.
        if (leaksSystemPrompt(result.message)) {
            result = { action: "reply", message: PROMPT_LEAK_REPLY };
        }

        // Saved only after the model succeeded, and in one batch (see saveChatTurn), so a failed turn leaves no
        // empty session or unanswered message.
        const saved = await saveChatTurn({
            email,
            projectId,
            sessionId,
            userContent: message,
            assistantContent: result.message,
        });

        // sessionName is only filled for a new session; an existing one keeps its (possibly renamed) name.
        const response: ChatResponse = { ...result, ...saved };

        return NextResponse.json(response);
    } catch (error) {
        console.error("POST /api/ai/chat failed", error);

        if (NoObjectGeneratedError.isInstance(error)) {
            // Server-side only: shows what the model actually returned and why it failed validation.
            console.error("Model output that failed validation:", error.text?.slice(0, 2000), error.cause);
            return NextResponse.json(
                { error: "The AI gave an invalid answer. Please try again." },
                { status: 502 }
            );
        }

        if (isBusyError(error) || isTimeoutError(error)) {
            return NextResponse.json(
                { error: "AI is busy right now. Please try again in a moment." },
                { status: 503 }
            );
        }

        return NextResponse.json({ error: "Failed to get a reply" }, { status: 500 });
    }
};
