import { api } from "@/lib/axios"
import type { Project } from "@/features/all-files/types"
import type { AckPendingDiagramsRequest, ChatMessagesPage, ChatResponse, ChatSessionItem, GenerateDiagramRequest, PendingDiagramsResponse, PublicWhiteboardResponse, RenameChatSessionRequest, ReviseDiagramRequest, SaveWhiteboardRequest, SendChatMessageRequest, UpdateChatMessageRequest, WhiteboardResponse } from "../types/types"
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

// Sends one chat turn; the server decides whether to reply, draw a new diagram or edit existing shapes, and saves the turn.
export const sendChatMessage = async (values: SendChatMessageRequest) => {
    const { data } = await api.post<ChatResponse>("/ai/chat", values, { timeout: 120_000 })
    return data
}

// Lists the signed-in user's chat sessions on a board, newest activity first.
export const getChatSessions = async (projectId: string) => {
    const { data } = await api.get<{ sessions: ChatSessionItem[] }>("/ai/chat-sessions", { params: { projectId } })
    return data
}

// Fetches one page of a session's messages (oldest first); `before` is the id of the oldest message already loaded.
export const getChatMessages = async ({ sessionId, before }: { sessionId: string; before?: number }) => {
    const { data } = await api.get<ChatMessagesPage>(`/ai/chat-sessions/${sessionId}/messages`, { params: { before } })
    return data
}

// Renames a chat session.
export const renameChatSession = async ({ sessionId, name }: RenameChatSessionRequest) => {
    const { data } = await api.patch<ChatSessionItem>(`/ai/chat-sessions/${sessionId}`, { name })
    return data
}

// Deletes a chat session together with its messages.
export const deleteChatSession = async (sessionId: string) => {
    const { data } = await api.delete<{ success: boolean }>(`/ai/chat-sessions/${sessionId}`)
    return data
}

// Asks the server for the complete updated spec of an existing diagram after a requested change (steps added, removed, ...).
export const reviseDiagram = async (values: ReviseDiagramRequest) => {
    const { data } = await api.post<DiagramSpec>("/ai/revise", values, { timeout: 120_000 })
    return data
}

// Rewrites the text of a saved assistant message (used when the canvas step failed after the reply was saved).
export const updateChatMessage = async ({ sessionId, messageId, content }: UpdateChatMessageRequest) => {
    const { data } = await api.patch<{ success: boolean }>(`/ai/chat-sessions/${sessionId}/messages/${messageId}`, { content })
    return data
}
