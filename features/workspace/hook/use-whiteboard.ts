import { useQuery } from "@tanstack/react-query"
import { getWhiteboard } from "../api"

// Loads the saved whiteboard once; never refetches on its own so a background refresh can't clobber local edits.
export const useWhiteboard = (projectId: string) =>
    useQuery({
        queryFn: () => getWhiteboard(projectId),
        queryKey: ["get-whiteboard", projectId],
        enabled: !!projectId,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
    })
