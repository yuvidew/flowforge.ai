import { useMutation, useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/get-error-message"
import { removeCollaborator } from "../api"
import { collaboratorsQueryKey } from "./use-collaborators"

// Removes an invited collaborator, then refreshes the collaborators list. The email is the mutation variable.
export const useRemoveCollaborator = (projectId: string) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (email: string) => removeCollaborator({ projectId, email }),
        mutationKey: ["remove-collaborator", projectId],
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: collaboratorsQueryKey(projectId) })
            toast.add({ title: "Collaborator removed", type: "success" })
        },
        onError: (error) => {
            toast.add({
                title: "Couldn't remove collaborator",
                description: getErrorMessage(error, "Please try again."),
                type: "error",
            })
        },
    })
}
