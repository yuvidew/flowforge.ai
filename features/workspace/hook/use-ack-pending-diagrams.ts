import { useMutation, useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/get-error-message"
import { ackPendingDiagrams } from "../api"

// Clears drawn diagrams from the queue. Deliberately no success toast: it runs in the background after every draw.
export const useAckPendingDiagrams = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ackPendingDiagrams,
        mutationKey: ["ack-pending-diagrams"],
        onSuccess: (_data, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: ["get-pending-diagrams", projectId] })
        },
        onError: (error) => {
            toast.add({
                title: "Couldn't update the diagram queue",
                description: getErrorMessage(error, "Please try again."),
                type: "error",
            })
        },
    })
}

