import { useMutation, useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/get-error-message"
import { addCollaborator } from "../api"
import { collaboratorsQueryKey } from "./use-collaborators"

// Invites someone to the board by email, then refreshes the collaborators list.
export const useAddCollaborator = (projectId: string) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (email: string) => addCollaborator({ projectId, email }),
        mutationKey: ["add-collaborator", projectId],
        onSuccess: ({ email }) => {
            queryClient.invalidateQueries({ queryKey: collaboratorsQueryKey(projectId) })
            toast.add({ title: "Collaborator added", description: `${email} can now edit this board.`, type: "success" })
        },
        onError: (error) => {
            toast.add({
                title: "Couldn't add collaborator",
                description: getErrorMessage(error, "Please try again."),
                type: "error",
            })
        },
    })
}
