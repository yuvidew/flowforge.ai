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

// Body of POST /api/whiteboard/pending: ids of the queued diagrams the browser has finished drawing.
export const ackPendingDiagramsSchema = z.object({
    projectId: z.string().min(1, "Project id is required"),
    ids: z.array(z.string().min(1)).min(1, "No diagram ids").max(50),
});



