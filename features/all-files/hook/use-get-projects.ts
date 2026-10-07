import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { PROJECTS_QUERY_KEY } from "../constants"
import { getProjects } from "../api"
import type { GetProjectsParams } from "../types"

// Paginated boards list (active or archived); keeps the previous page visible while the next one loads.
export const useGetProjects = (params: GetProjectsParams) =>
    useQuery({
        queryFn: () => getProjects(params),
        queryKey: [PROJECTS_QUERY_KEY, params],
        placeholderData: keepPreviousData,
    })
