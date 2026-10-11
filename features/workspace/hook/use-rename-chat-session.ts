import { useMutation, useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/get-error-message"
import { renameChatSession } from "../api"
import { chatSessionsKey } from "./use-get-chat-sessions"

// Renames a chat session, then refreshes the sessions list.
export const useRenameChatSession = (projectId: string) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: renameChatSession,
        mutationKey: ["rename-chat-session"],
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: chatSessionsKey(projectId) })
            toast.add({ title: "Session renamed", type: "success" })
        },
        onError: (error) => {
            toast.add({
                title: "Couldn't rename session",
                description: getErrorMessage(error, "Please try again."),
                type: "error",
            })
        },
    })
}
