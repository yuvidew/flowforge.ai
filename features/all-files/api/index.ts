import { api } from "@/lib/axios"
import type { CreateProjectRequest, Project } from "../types"

// Creates a new board for the signed-in user.
export const createProject = async (values: CreateProjectRequest) => {
    const { data } = await api.post<Project>("/projects", values)
    return data
}
