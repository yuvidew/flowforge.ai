import { z } from "zod"

// Validation rules for the "create new board" form.
export const newBoardSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Workspace name is required")
        .max(50, "Workspace name must be 50 characters or less"),
})

export type NewBoardValues = z.infer<typeof newBoardSchema>

// PATCH /api/projects/[projectId] body: at least one of a new name, the archived flag or the published flag.
export const updateProjectSchema = z
    .object({
        name: newBoardSchema.shape.name.optional(),
        isArchived: z.boolean().optional(),
        isPublished: z.boolean().optional(),
    })
    .refine((v) => v.name !== undefined || v.isArchived !== undefined || v.isPublished !== undefined, {
        message: "Nothing to update",
    })

export type UpdateProjectValues = z.infer<typeof updateProjectSchema>

// GET /api/projects query string: archived filter, name search and pagination.
export const projectsQuerySchema = z.object({
    archived: z.enum(["true", "false"]).default("false"),
    search: z.string().trim().max(50).default(""),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(12),
})
