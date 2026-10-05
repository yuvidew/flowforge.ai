import type { projects } from "@/db/schema"
import type { NewBoardValues } from "./schema"

// Body sent to POST /api/projects.
export type CreateProjectRequest = NewBoardValues

// A board row as returned by the API.
export type Project = typeof projects.$inferSelect
