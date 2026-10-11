import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query"
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"

import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/get-error-message"
import { applyEdits } from "../ai/apply-edits"
import { buildChatContext } from "../ai/build-chat-context"
import { drawGeneratedDiagram } from "../ai/draw-generated-diagram"
import type { AiModeId } from "../ai/prompts"
import { reviseDiagramOnCanvas } from "../ai/revise-diagram"
import { generateDiagram, reviseDiagram, sendChatMessage, updateChatMessage } from "../api"
import type { ChatMessagesPage } from "../types/types"
import { chatMessagesKey, chatMessagesOptions } from "./use-get-chat-messages"
import { chatSessionsKey } from "./use-get-chat-sessions"

// Sends one chat turn to the server (which saves it to the session), then carries out what the AI decided: reply
// (nothing to do), edit the shapes on the canvas, redraw a diagram with a change, or generate and draw a new one.
// The canvas, board id, session and mode ride along as mutation variables: they are only needed to build the request and act on it.
export const useSendChatMessage = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            excalidrawApi,
            projectId,
            sessionId,
            message,
            mode,
        }: {
            excalidrawApi: ExcalidrawImperativeAPI
            projectId: string
            sessionId?: string
            message: string
            mode?: AiModeId
        }) => {
            const result = await sendChatMessage({
                projectId,
                sessionId,
                message,
                mode,
                ...buildChatContext(excalidrawApi),
            })

            // The server saved the reply before the canvas step runs. If that step fails, the saved reply is rewritten so
            // the history doesn't claim something that never happened. Best effort: a failure here isn't worth reporting.
            const reportFailure = (content: string) =>
                updateChatMessage({
                    sessionId: result.sessionId,
                    messageId: result.assistantMessageId,
                    content,
                }).catch(() => undefined)

            // The turn is already saved at this point, so a canvas failure is reported here (toast + corrected history)
            // instead of failing the whole mutation; otherwise the chat would lose track of the session that was just created.
            if (result.action === "edit") {
                try {
                    const applied = await applyEdits(excalidrawApi, result.ops)

                    if (!applied) {
                        toast.add({
                            title: "Nothing changed",
                            description: "Those shapes are no longer on the board.",
                            type: "warning",
                        })
                        await reportFailure(
                            "I couldn't apply that change: those shapes are no longer on the board, so nothing changed.",
                        )
                    }
                } catch (error) {
                    toast.add({
                        title: "Couldn't apply the change",
                        description: getErrorMessage(error, "Please try again."),
                        type: "error",
                    })
                    await reportFailure("I couldn't apply that change. Please try again.")
                }
            }

            if (result.action === "revise") {
                try {
                    const revised = await reviseDiagramOnCanvas(excalidrawApi, result.diagramId, (current) =>
                        reviseDiagram({ ...current, instruction: result.instruction }),
                    )

                    if (!revised) {
                        toast.add({
                            title: "Nothing changed",
                            description: "That diagram is no longer on the board.",
                            type: "warning",
                        })
                        await reportFailure(
                            "I couldn't update that diagram because it is no longer on the board, so nothing changed.",
                        )
                    }
                } catch (error) {
                    toast.add({
                        title: "Couldn't update diagram",
                        description: getErrorMessage(error, "Please try again."),
                        type: "error",
                    })
                    await reportFailure("I couldn't update that diagram. Please try again.")
                }
            }

            if (result.action === "create") {
                try {
                    await drawGeneratedDiagram(excalidrawApi, result.mode, () =>
                        generateDiagram({ mode: result.mode, prompt: result.prompt }),
                    )
                } catch (error) {
                    toast.add({
                        title: "Couldn't generate diagram",
                        description: getErrorMessage(error, "Please try again."),
                        type: "error",
                    })
                    await reportFailure("I couldn't draw that diagram. Please try again.")
                }
            }

            return { sessionId: result.sessionId, sessionName: result.sessionName }
        },
        mutationKey: ["send-chat-message"],
        onSuccess: async ({ sessionId }, { projectId }) => {
            // Keep only the newest page before refetching: with older pages loaded, the new messages would shift the
            // page boundaries and leave a gap.
            queryClient.setQueryData<InfiniteData<ChatMessagesPage, number | undefined>>(chatMessagesKey(sessionId), (data) =>
                data ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data,
            )
            queryClient.invalidateQueries({ queryKey: chatSessionsKey(projectId) })
            // Awaited (and staleTime 0, so it really fetches) so the new messages are in the cache before the chat
            // window drops its "sending" bubble and, for a new session, switches to this query. A failed refetch
            // is left to the message list's own error state.
            await queryClient
                .fetchInfiniteQuery({ ...chatMessagesOptions(sessionId), staleTime: 0 })
                .catch(() => undefined)
        },
        onError: (error) => {
            toast.add({
                title: "Couldn't get a reply",
                description: getErrorMessage(error, "Please try again."),
                type: "error",
            })
        },
    })
}
