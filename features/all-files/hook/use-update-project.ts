import { useMutation, useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/get-error-message"
import { updateProject } from "../api"
import { PROJECTS_QUERY_KEY } from "../constants"

// Renames or archives a board, then refreshes the boards list.
export const useUpdateProject = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: updateProject,
        mutationKey: ["update-project"],
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] })
            // isArchived is only sent by archive/unarchive; a rename leaves it undefined.
            const title =
                variables.isArchived === true
                    ? "Board archived"
                    : variables.isArchived === false
                      ? "Board unarchived"
                      : "Board updated"
            toast.add({ title, type: "success" })
        },
        onError: (error) => {
            toast.add({
                title: "Couldn't update board",
                description: getErrorMessage(error, "Please try again."),
                type: "error",
            })
        },
    })
}
