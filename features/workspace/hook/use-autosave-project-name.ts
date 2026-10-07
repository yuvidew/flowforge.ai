import { useMutation, useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { updateProject } from "@/features/all-files/api"
import { PROJECTS_QUERY_KEY } from "@/features/all-files/constants"
import { getErrorMessage } from "@/lib/get-error-message"

// Renames the board from the workspace header's autosaving input; success is silent (no toast per keystroke pause), only failures toast.
export const useAutosaveProjectName = (projectId: string) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (name: string) => updateProject({ projectId, name }),
        mutationKey: ["autosave-project-name", projectId],
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["get-project", projectId] })
            queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] })
        },
        onError: (error) => {
            toast.add({
                title: "Couldn't save board name",
                description: getErrorMessage(error, "Please try again."),
                type: "error",
            })
        },
    })
}
