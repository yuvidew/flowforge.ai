import { api } from "@/lib/axios"
import type { GenerateDiagramRequest, SaveWhiteboardRequest, WhiteboardResponse } from "../types/types"
import type { DiagramSpec } from "../ai/diagram-schema"

// Fetches the saved whiteboard for a project.
export const getWhiteboard = async (projectId: string) => {
    const { data } = await api.get<WhiteboardResponse>("/whiteboard", { params: { projectId } })
    return data
}

// Saves (upserts) the whiteboard for a project.
export const saveWhiteboard = async (values: SaveWhiteboardRequest) => {
    const { data } = await api.post<{ success: boolean }>("/whiteboard", values)
    return data
}

// Asks the server to generate a diagram spec for the AI Helper (model calls can take a while, hence the long timeout).
export const generateDiagram = async (values: GenerateDiagramRequest) => {
    const { data } = await api.post<DiagramSpec>("/ai/generate", values, { timeout: 120_000 })
    return data
}
