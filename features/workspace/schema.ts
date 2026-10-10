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


// Body of POST /api/whiteboard/pending: ids of the queued diagrams the browser has finished drawing.
export const ackPendingDiagramsSchema = z.object({
    projectId: z.string().min(1, "Project id is required"),
    ids: z.array(z.string().min(1)).min(1, "No diagram ids").max(50),
});



