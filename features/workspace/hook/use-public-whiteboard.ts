import { useQuery } from "@tanstack/react-query"
import { getPublicWhiteboard } from "../api"

// Loads a published board for the public view; no retry so an unpublished link fails fast.
export const usePublicWhiteboard = (projectId: string) =>
    useQuery({
        queryFn: () => getPublicWhiteboard(projectId),
        queryKey: ["get-public-whiteboard", projectId],
        enabled: !!projectId,
        retry: false,
        refetchOnWindowFocus: false,
    })
