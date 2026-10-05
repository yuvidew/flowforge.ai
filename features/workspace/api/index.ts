import { api } from "@/lib/axios"
import type { SaveWhiteboardRequest, WhiteboardResponse } from "../types/types"

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
