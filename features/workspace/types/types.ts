import type { z } from "zod"
import type { ackPendingDiagramsSchema, chatRequestSchema, editDiagramSchema, editOpSchema, editOpsResultSchema, generateDiagramSchema, pendingDiagramSchema, pendingEditSchema, reviseDiagramSchema, saveWhiteboardSchema } from "../schema"
import type { AiModeId } from "../ai/prompts"

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


// The few fields we read from an Excalidraw element (the real element has many more).
// Works for elements saved in the database and for live ones from the canvas.
export type SavedElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  containerId?: string | null;
  backgroundColor?: string;
  strokeColor?: string;
  isDeleted?: boolean;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
  // Free-form in Excalidraw; summarizeScene reads nodeId / diagramId from it only when they are strings.
  customData?: Record<string, unknown>;
};

// Input of the edit step of the chat (generateEditOps).
export type EditDiagramRequest = z.infer<typeof editDiagramSchema>;

// Edit operations returned by the edit step of the chat (empty when the AI found nothing it can change).
export type EditDiagramResponse = z.infer<typeof editOpsResultSchema>;

// Body sent to POST /api/ai/chat
export type ChatRequest = z.infer<typeof chatRequestSchema>;

// What the chat route answers: a plain reply, a diagram for the client to generate, or edits for it to apply.

export type ChatResult = 
    | { action: "reply"; message: string }
    | { action: "create"; mode: AiModeId; prompt: string; message: string }
    | { action: "edit"; ops: EditOp[]; message: string }
    | { action: "revise"; diagramId: string; instruction: string; message: string }

// What POST /api/ai/chat returns: the decision plus the session the turn was saved in (new or existing).
// `assistantMessageId` identifies the saved reply, which the client rewrites if the canvas step then fails.
export type ChatResponse = ChatResult & { sessionId: string; sessionName: string; assistantMessageId: number };


// One row of the session list as the client receives it (dates arrive as ISO strings over JSON).
export type ChatSessionItem = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
};

// A chat message as stored in the database; the numeric id is also the pagination cursor.
export type StoredChatMessage = {
    id: number;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
};

// One page of a session's messages, oldest first; hasMore says whether older ones exist.
export type ChatMessagesPage = {
    messages: StoredChatMessage[];
    hasMore: boolean;
};

// Body of a chat turn: the server's ChatRequest plus the optional creation mode picked in the composer.
export type SendChatMessageRequest = ChatRequest & { mode?: AiModeId };

// Body of PATCH /api/ai/chat-sessions/[sessionId].
export type RenameChatSessionRequest = { sessionId: string; name: string };

// Body sent to POST /api/ai/revise.
export type ReviseDiagramRequest = z.infer<typeof reviseDiagramSchema>;

// Body of PATCH /api/ai/chat-sessions/[sessionId]/messages/[messageId], plus the ids that build its URL.
export type UpdateChatMessageRequest = { sessionId: string; messageId: number; content: string };
