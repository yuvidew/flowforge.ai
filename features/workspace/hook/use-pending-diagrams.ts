import { useQuery } from "@tanstack/react-query"

import { getPendingDiagrams } from "../api"

// Polls the MCP queue while the workspace is open (TanStack pauses it when the tab is hidden).
export const usePendingDiagrams = (projectId: string) =>
    useQuery({
        queryFn: () => getPendingDiagrams(projectId),
        queryKey: ["get-pending-diagrams", projectId],
        enabled: !!projectId,
        refetchInterval: 3000,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: "always",
        staleTime: 0,
    })
