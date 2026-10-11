import { useMutation, useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/get-error-message"
import { deleteChatSession } from "../api"
import { chatMessagesKey } from "./use-get-chat-messages"
import { chatSessionsKey } from "./use-get-chat-sessions"

// Deletes a chat session, then drops its cached messages and refreshes the sessions list.
export const useDeleteChatSession = (projectId: string) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: deleteChatSession,
        mutationKey: ["delete-chat-session"],
        onSuccess: (_data, sessionId) => {
            queryClient.removeQueries({ queryKey: chatMessagesKey(sessionId) })
            queryClient.invalidateQueries({ queryKey: chatSessionsKey(projectId) })
            toast.add({ title: "Session deleted", type: "success" })
        },
        onError: (error) => {
            toast.add({
                title: "Couldn't delete session",
                description: getErrorMessage(error, "Please try again."),
                type: "error",
            })
        },
    })
}
