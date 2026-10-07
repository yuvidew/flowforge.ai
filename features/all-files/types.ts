import type { projects } from "@/db/schema"
import type { NewBoardValues, UpdateProjectValues } from "./schema"

// Body sent to POST /api/projects.
export type CreateProjectRequest = NewBoardValues

// A board row as returned by the API.
export type Project = typeof projects.$inferSelect

// Response of GET /api/projects.
export type ProjectsResponse = {
    projects: Project[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

// Filters for GET /api/projects.
export type GetProjectsParams = { archived: boolean; search: string; page: number }

// Variables for updating a board (rename and/or archive).
export type UpdateProjectRequest = UpdateProjectValues & { projectId: string }
