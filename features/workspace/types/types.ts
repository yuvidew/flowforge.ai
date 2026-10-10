import type { z } from "zod"
import type { ackPendingDiagramsSchema, editOpSchema, generateDiagramSchema, pendingDiagramSchema, pendingEditSchema, saveWhiteboardSchema } from "../schema"

export type TabsType = "whiteboard" | "doc"

// Body sent to POST /api/whiteboard.
export type SaveWhiteboardRequest = z.infer<typeof saveWhiteboardSchema>

// Saved whiteboard as returned by GET /api/whiteboard.
export type WhiteboardResponse = Omit<SaveWhiteboardRequest, "projectId" | "ackPendingIds">

// Published board as returned by GET /api/public/whiteboard.
export type PublicWhiteboardResponse = WhiteboardResponse & { projectName: string }

// Body sent to POST /api/ai/generate.
export type GenerateDiagramRequest = z.infer<typeof generateDiagramSchema>

// A diagram queued by the MCP server (spec + the mode it was written for).
export type PendingDiagram = z.infer<typeof pendingDiagramSchema>

// Body sent to POST /api/whiteboard/pending.
export type AckPendingDiagramsRequest = z.infer<typeof ackPendingDiagramsSchema>

// Queue as returned by GET /api/whiteboard/pending.
export type PendingDiagramsResponse = { pending: PendingItem[] }

// One edit operation (update_text / set_color / delete) aimed at a node.
export type EditOp = z.infer<typeof editOpSchema>

// A batch of edits queued by the MCP server.
export type PendingEdit = z.infer<typeof pendingEditSchema>

// Anything the MCP server can queue: a diagram to draw or edits to apply.
export type PendingItem = PendingDiagram | PendingEdit


