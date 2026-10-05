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
