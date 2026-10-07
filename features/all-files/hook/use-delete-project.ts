import { useMutation, useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/get-error-message"
import { deleteProject } from "../api"
import { PROJECTS_QUERY_KEY } from "../constants"

// Deletes a board, then refreshes the boards list.
export const useDeleteProject = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: deleteProject,
        mutationKey: ["delete-project"],
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] })
            toast.add({ title: "Board deleted", type: "success" })
        },
        onError: (error) => {
            toast.add({
                title: "Couldn't delete board",
                description: getErrorMessage(error, "Please try again."),
                type: "error",
            })
        },
    })
}
