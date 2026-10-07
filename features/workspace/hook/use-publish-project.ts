import { useMutation, useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { updateProject } from "@/features/all-files/api"
import { PROJECTS_QUERY_KEY } from "@/features/all-files/constants"
import { getErrorMessage } from "@/lib/get-error-message"

// Publishes or unpublishes a board (PATCH isPublished), then refreshes the board and the boards list.
export const usePublishProject = (projectId: string) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (isPublished: boolean) => updateProject({ projectId, isPublished }),
        mutationKey: ["publish-project", projectId],
        onSuccess: (_data, isPublished) => {
            queryClient.invalidateQueries({ queryKey: ["get-project", projectId] })
            queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] })
            toast.add({ title: isPublished ? "Board published" : "Board unpublished", type: "success" })
        },
        onError: (error, isPublished) => {
            toast.add({
                title: isPublished ? "Couldn't publish board" : "Couldn't unpublish board",
                description: getErrorMessage(error, "Please try again."),
                type: "error",
            })
        },
    })
}
