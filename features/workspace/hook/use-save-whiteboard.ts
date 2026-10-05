import { useMutation } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/get-error-message"
import { saveWhiteboard } from "../api"

// Autosaves the whiteboard. Deliberately no success toast (fires every save) and no invalidation of
// ["get-whiteboard", id] — the canvas is the source of truth, refetching would only risk overwriting it.
export const useSaveWhiteboard = () =>
    useMutation({
        mutationFn: saveWhiteboard,
        mutationKey: ["save-whiteboard"],
        onError: (error) => {
            toast.add({
                title: "Couldn't save whiteboard",
                description: getErrorMessage(error, "Please try again."),
                type: "error",
            })
        },
    })
