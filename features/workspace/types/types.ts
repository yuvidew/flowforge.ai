import type { z } from "zod"
import type { ackPendingDiagramsSchema, chatRequestSchema, editDiagramSchema, editOpSchema, editOpsResultSchema, generateDiagramSchema, pendingDiagramSchema, pendingEditSchema, pendingReviseSchema, reviseDiagramSchema, saveWhiteboardSchema } from "../schema"
import type { AiModeId } from "../ai/prompts"
import { DiagramSpec } from "../ai/diagram-schema"

export type TabsType = "whiteboard" | "doc"

// Body sent to POST /api/whiteboard.
export type SaveWhiteboardRequest = z.infer<typeof saveWhiteboardSchema>

export type WhiteboardResponse = Omit<SaveWhiteboardRequest, "projectId" | "ackPendingIds" | "baseVersion"> & { version: number }

// Published board as returned by GET /api/public/whiteboard (public pages don't use versions).
export type PublicWhiteboardResponse = Omit<WhiteboardResponse, "version"> & { projectName: string }


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

// Anything the MCP server can queue: a diagram to draw, edits to apply, or a diagram to redraw.
export type PendingItem = PendingDiagram | PendingEdit | PendingRevise

// A diagram redraw queued by the MCP server (the full updated spec for an existing diagram).
export type PendingRevise = z.infer<typeof pendingReviseSchema>

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
    // Used to rebuild a diagram's edges, styles and labels from saved elements.
  groupIds?: readonly string[];
  strokeStyle?: string;
  endArrowhead?: string | null;
  // Text elements only: the label as typed, and its font size.
  originalText?: string;
  fontSize?: number;

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

// One diagram found in a scene, rebuilt as the spec that draw_diagram takes. `mode` is null for diagrams drawn before
// the mode was stored; `revisable` is false for web/mobile mockups, which can't be laid out again automatically.
export type ReadDiagram = {
  diagramId: string;
  mode: AiModeId | null;
  revisable: boolean;
  spec: DiagramSpec;
};

export type WriteSceneInput = {
  projectId: string;
  elements: unknown[];
  // Omitted by server writers: the stored appState / files are left untouched.
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
  // Version the writer's scene was based on; omitted = unconditional write.
  baseVersion?: number;
  ackPendingIds?: string[];
};

export type WriteSceneResult = { ok: true; version: number } | { ok: false; serverVersion: number };



