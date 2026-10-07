import { api } from "@/lib/axios"
import type { Project } from "@/features/all-files/types"
import type { AckPendingDiagramsRequest, GenerateDiagramRequest, PendingDiagramsResponse, PublicWhiteboardResponse, SaveWhiteboardRequest, WhiteboardResponse } from "../types/types"
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

// Fetches a single board owned by the signed-in user (name, published state).
export const getProject = async (projectId: string) => {
    const { data } = await api.get<Project>(`/projects/${projectId}`)
    return data
}

// Fetches a published board's whiteboard (no auth; 404 when unpublished or unknown).
export const getPublicWhiteboard = async (projectId: string) => {
    const { data } = await api.get<PublicWhiteboardResponse>("/public/whiteboard", { params: { projectId } })
    return data
}

// Fetches the diagrams the MCP server has queued for a board.
export const getPendingDiagrams = async (projectId: string) => {
    const { data } = await api.get<PendingDiagramsResponse>("/whiteboard/pending", { params: { projectId } })
    return data
}

// Tells the server which queued diagrams are now drawn, so they are removed from the queue.
export const ackPendingDiagrams = async (values: AckPendingDiagramsRequest) => {
    const { data } = await api.post<{ success: boolean }>("/whiteboard/pending", values)
    return data
}

