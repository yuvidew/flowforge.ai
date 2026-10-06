import type { z } from "zod"
import type { generateDiagramSchema, saveWhiteboardSchema } from "../schema"

export type TabsType = "whiteboard" | "doc"

// Body sent to POST /api/whiteboard.
export type SaveWhiteboardRequest = z.infer<typeof saveWhiteboardSchema>

// Saved whiteboard as returned by GET /api/whiteboard.
export type WhiteboardResponse = Omit<SaveWhiteboardRequest, "projectId">


// Body sent to POST /api/ai/generate.
export type GenerateDiagramRequest = z.infer<typeof generateDiagramSchema>
