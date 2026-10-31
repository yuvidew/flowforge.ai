import { useQuery } from "@tanstack/react-query"

import { getCollaborators } from "../api"

// Query key shared with the invite/remove mutations so they refresh this list.
export const collaboratorsQueryKey = (projectId: string) => ["get-collaborators", projectId]

// The board's owner, invited collaborators and the signed-in user's own role (owner or collaborator).
export const useCollaborators = (projectId: string) =>
    useQuery({
        queryFn: () => getCollaborators(projectId),
        queryKey: collaboratorsQueryKey(projectId),
        enabled: !!projectId,
    })
