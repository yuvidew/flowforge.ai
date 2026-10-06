import z from "zod";

// Whiteboard payload: Excalidraw's elements/appState/files are opaque JSON blobs we only persist.
export const saveWhiteboardSchema = z.object({
    projectId: z.string().min(1, "Project id is required"),
    elements: z.array(z.unknown()),
    appState: z.record(z.string(), z.unknown()),
    files: z.record(z.string(), z.unknown()),
});

// Body of POST /api/ai/generate: which kind of diagram to make and the user's description of it.
export const generateDiagramSchema = z.object({
    mode: z.enum(["diagram", "flowchart", "architecture", "web", "mobile"]),
    prompt: z.string().trim().min(1, "Describe what you want to create").max(2000, "Description is too long"),
});
