import { useQuery } from "@tanstack/react-query"

import { getChatSessions } from "../api"

// Chat sessions of one board, newest activity first; shared with the mutations that invalidate it.
export const chatSessionsKey = (projectId: string) => ["get-chat-sessions", projectId]

// Lists the signed-in user's chat sessions on the board; only fetched while the sessions list is on screen.
export const useGetChatSessions = (projectId: string, enabled = true) =>
    useQuery({
        queryFn: () => getChatSessions(projectId),
        queryKey: chatSessionsKey(projectId),
        select: (data) => data.sessions,
        enabled: !!projectId && enabled,
    })
