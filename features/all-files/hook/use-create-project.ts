import { useMutation, useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/get-error-message"
import { createProject } from "../api"
import { useRouter } from "next/navigation"

// Creates a board, then refreshes the boards list.
export const useCreateProject = () => {
    const queryClient = useQueryClient();
    const router = useRouter();

    return useMutation({
        mutationFn: createProject,
        mutationKey: ["create-project"],
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["get-projects"] })
            toast.add({ title: `${data.projectName} board is created`, type: "success" })
            router.push(`/workspace/${data.id}`)
        },
        onError: (error) => {
            toast.add({
                title: "Couldn't create board",
                description: getErrorMessage(error, "Please try again."),
                type: "error",
            })
        },
    })
}
