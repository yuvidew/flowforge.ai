import { useQuery } from "@tanstack/react-query"
import { getProject } from "../api"

// Loads the board's name and published state for the workspace header.
export const useProject = (projectId: string) =>
    useQuery({
        queryFn: () => getProject(projectId),
        queryKey: ["get-project", projectId],
        enabled: !!projectId,
    })
