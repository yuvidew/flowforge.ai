import { api } from "@/lib/axios"
import { PROJECTS_PAGE_SIZE } from "../constants"
import type {
    CreateProjectRequest,
    GetProjectsParams,
    Project,
    ProjectsResponse,
    UpdateProjectRequest,
} from "../types"

// Creates a new board for the signed-in user.
export const createProject = async (values: CreateProjectRequest) => {
    const { data } = await api.post<Project>("/projects", values)
    return data
}

// Fetches a page of the signed-in user's boards (active or archived), optionally filtered by name.
export const getProjects = async ({ archived, search, page }: GetProjectsParams) => {
    const { data } = await api.get<ProjectsResponse>("/projects", {
        params: { archived, search, page, pageSize: PROJECTS_PAGE_SIZE },
    })
    return data
}

// Renames and/or archives a board.
export const updateProject = async ({ projectId, ...values }: UpdateProjectRequest) => {
    const { data } = await api.patch<Project>(`/projects/${projectId}`, values)
    return data
}

// Deletes a board and its whiteboard data.
export const deleteProject = async ({ projectId }: { projectId: string }) => {
    const { data } = await api.delete<{ success: boolean }>(`/projects/${projectId}`)
    return data
}
