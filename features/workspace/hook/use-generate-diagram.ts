import { useMutation } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/get-error-message"
import { generateDiagram } from "../api"

// Asks the AI for a diagram spec. Nothing server-side changes, so there is no query to invalidate;
// the component draws the result on the canvas through the per-call onSuccess callback.
export const useGenerateDiagram = () =>
    useMutation({
        mutationFn: generateDiagram,
        mutationKey: ["generate-diagram"],
        onError: (error) => {
            toast.add({
                title: "Couldn't generate diagram",
                description: getErrorMessage(error, "Please try again."),
                type: "error",
            })
        },
    })
