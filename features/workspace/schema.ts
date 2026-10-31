import z from "zod";
import { diagramSchema } from "./ai/diagram-schema";


// The AI Helper creation modes; shared by the generate route and the MCP queue.
const diagramModeSchema = z.enum(["diagram", "flowchart", "architecture", "web", "mobile"]);

// Whiteboard payload: Excalidraw's elements/appState/files are opaque JSON blobs we only persist.
export const saveWhiteboardSchema = z.object({
    projectId: z.string().min(1, "Project id is required"),
    elements: z.array(z.unknown()),
    appState: z.record(z.string(), z.unknown()),
    files: z.record(z.string(), z.unknown()),
    // MCP diagrams that are part of this scene; the server drops them from the pending queue in the same statement.
    ackPendingIds: z.array(z.string().min(1)).max(50).optional(),
    // Scene version this save was based on; a mismatch means the board changed elsewhere (409).
    baseVersion: z.number().int().min(0).optional(),
});

// Body of POST /api/projects/[id]/collaborators: the email is trimmed and lower-cased so it matches the stored invite.
export const addCollaboratorSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
});

// Body of DELETE /api/projects/[id]/collaborators.
export const removeCollaboratorSchema = z.object({
    email: z.string().trim().toLowerCase().min(1, "Email is required"),
});

// Body of POST /api/ai/generate: which kind of diagram to make and the user's description of it.
export const generateDiagramSchema = z.object({
    mode: diagramModeSchema,
    prompt: z.string().trim().min(1, "Describe what you want to create").max(2000, "Description is too long"),
});

// One diagram queued by the MCP server, waiting for an open workspace to draw it.
export const pendingDiagramSchema = z.object({
    id: z.string().min(1),
    mode: diagramModeSchema,
    spec: diagramSchema,
    createdAt: z.string(),
});

// One change to a shape that was drawn by FlowForge; the shape is found by its diagramId + nodeId.
export const editOpSchema = z.discriminatedUnion("op", [
    z.object({
        op: z.literal("update_text"),
        diagramId: z.string().min(1).describe("diagramId from get_board_scene"),
        nodeId: z.string().min(1).describe("nodeId from get_board_scene"),
        text: z.string().max(200).describe("New label for the shape"),
    }),
    z.object({
        op: z.literal("set_color"),
        diagramId: z.string().min(1),
        nodeId: z.string().min(1),
        fill: z.string().optional().describe('Hex colour such as "#dbeafe", or "transparent"'),
        stroke: z.string().optional().describe('Hex colour such as "#1d4ed8"'),
    }),
    z.object({
        op: z.literal("delete"),
        diagramId: z.string().min(1),
        nodeId: z.string().min(1),
    }),
]);

// A batch of edits queued by the MCP server; `kind` tells it apart from a queued diagram.
export const pendingEditSchema = z.object({
    id: z.string().min(1),
    kind: z.literal("edit"),
    ops: z.array(editOpSchema).min(1).max(50),
    createdAt: z.string(),
});

// A diagram redraw queued by the MCP server: the complete updated spec replaces the diagram `diagramId`.
// `mode` is read from the saved diagram by the server, not taken from the AI.
export const pendingReviseSchema = z.object({
    id: z.string().min(1),
    kind: z.literal("revise"),
    diagramId: z.string().min(1),
    mode: diagramModeSchema,
    spec: diagramSchema,
    createdAt: z.string(),
});

// Body of POST /api/whiteboard/pending: ids of the queued diagrams the browser has finished drawing.
export const ackPendingDiagramsSchema = z.object({
    projectId: z.string().min(1, "Project id is required"),
    ids: z.array(z.string().min(1)).min(1, "No diagram ids").max(50),
});


// One shape of the board as the AI Helper describes it to the model. `from`/`to` are the nodeIds an arrow connects
// (the browser maps Excalidraw's element ids to nodeIds before sending).
const editSceneItemSchema = z.object({
    diagramId: z.string().min(1),
    nodeId: z.string().min(1),
    type: z.string(),
    text: z.string().nullish(),
    fill: z.string().nullish(),
    stroke: z.string().nullish(),
    from: z.string().nullish(),
    to: z.string().nullish(),
    // The mode the diagram was drawn in (diagrams drawn before it was stored have none).
    mode: diagramModeSchema.nullish(),
});

// Input of the edit step (generateEditOps, run by POST /api/ai/chat): what the user wants changed, the editable shapes on the board and which are selected.
export const editDiagramSchema = z.object({
    prompt: z.string().trim().min(1, "Describe what you want to change").max(1000, "Description is too long"),
    scene: z.array(editSceneItemSchema).max(300),
    selected: z.array(z.object({ diagramId: z.string().min(1), nodeId: z.string().min(1) })).max(50),
});

// What the model must return for an edit request; an empty list means "nothing I can change".
export const editOpsResultSchema = z.object({
    ops: z.array(editOpSchema).max(50),
});


// Body of POST /api/ai/chat: the new user message, the board it belongs to, the session it continues (none = start a
// new one), the editable shapes on the board and which of them are selected. History is read from the database.
export const chatRequestSchema = z.object({
    projectId: z.string().min(1, "projectId is required"),
    sessionId: z.uuid().optional(),
    message: z.string().trim().min(1, "Write a message first").max(2000, "Message is too long"),
    scene: editDiagramSchema.shape.scene,
    selected: editDiagramSchema.shape.selected,
    mode: diagramModeSchema.optional(),
});



// What the router model decides for a chat message. `message` is the short line shown to the user; for "edit" the
// `instruction` is a self-contained rewrite of the request that the edit step works from.
export const chatActionSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("reply"), message: z.string().min(1).max(600) }),
    z.object({
        action: z.literal("create"),
        mode: diagramModeSchema,
        prompt: z.string().min(1).max(2000),
        message: z.string().min(1).max(300),
    }),
    z.object({
        action: z.literal("edit"),
        instruction: z.string().min(1).max(1000),
        message: z.string().min(1).max(300),
    }),
    // `diagram` is the short label (D1, D2, ...) the chat prompt gave the target diagram; the route maps it back to a diagramId.
    z.object({
        action: z.literal("revise"),
        diagram: z.string().min(1).max(20),
        instruction: z.string().min(1).max(1500),
        message: z.string().min(1).max(300),
    }),
]);

// Body of POST /api/ai/revise: the diagram as it is now (rebuilt from the canvas), its mode and the change to make.
export const reviseDiagramSchema = z.object({
    mode: diagramModeSchema,
    instruction: z.string().trim().min(1, "Describe what you want to change").max(1500, "Description is too long"),
    spec: diagramSchema.refine(
        (spec) => spec.nodes.length <= 100 && spec.edges.length <= 200,
        "This diagram is too big to revise",
    ),
});

// Query of GET /api/ai/chat-sessions: which board's sessions to list.
export const listChatSessionsQuerySchema = z.object({
    projectId: z.string().min(1, "projectId is required"),
});

// Body of PATCH /api/ai/chat-sessions/[sessionId].
export const renameChatSessionSchema = z.object({
    name: z.string().trim().min(1, "Name can't be empty").max(60, "Name is too long")
});

// Session ids are uuids; checking the shape first keeps a bad id a 404 instead of a database error.
export const chatSessionIdSchema = z.uuid();

// Query of GET /api/ai/chat-sessions/[sessionId]/messages: a page size and an optional cursor (older than this message id).
export const chatMessagesQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z.coerce.number().int().positive().optional(),
});

// Body of PATCH /api/ai/chat-sessions/[sessionId]/messages/[messageId]: the corrected text of an assistant message.
export const updateChatMessageSchema = z.object({
    content: z.string().trim().min(1, "Message can't be empty").max(600, "Message is too long"),
});

// Message ids are serial numbers; a non-number is a 404, like a bad session id.
export const chatMessageIdSchema = z.coerce.number().int().positive();
