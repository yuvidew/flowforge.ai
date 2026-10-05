import z from "zod";

// Whiteboard payload: Excalidraw's elements/appState/files are opaque JSON blobs we only persist.
export const saveWhiteboardSchema = z.object({
    projectId: z.string().min(1, "Project id is required"),
    elements: z.array(z.unknown()),
    appState: z.record(z.string(), z.unknown()),
    files: z.record(z.string(), z.unknown()),
});