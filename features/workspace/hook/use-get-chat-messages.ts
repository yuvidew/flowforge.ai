import { infiniteQueryOptions, useInfiniteQuery } from "@tanstack/react-query"

import { getChatMessages } from "../api"
import type { StoredChatMessage } from "../types/types"

// Messages of one chat session; shared with the mutations that invalidate it.
export const chatMessagesKey = (sessionId: string | null) => ["get-chat-messages", sessionId]

// Query options for a session's messages, newest page first from the server; older pages load with the cursor
// (oldest id loaded). `select` flattens the pages into one list ordered oldest to newest, ready to render.
// Shared so the send hook can prefetch the same query before the chat window switches to it.
export const chatMessagesOptions = (sessionId: string | null) =>
    infiniteQueryOptions({
        queryFn: ({ pageParam }) => getChatMessages({ sessionId: sessionId as string, before: pageParam }),
        queryKey: chatMessagesKey(sessionId),
        initialPageParam: undefined as number | undefined,
        getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.messages[0]?.id : undefined),
        select: (data): StoredChatMessage[] => [...data.pages].reverse().flatMap((page) => page.messages),
        enabled: !!sessionId,
    })

// A session's messages, with scrolling up loading older pages.
export const useGetChatMessages = (sessionId: string | null) => useInfiniteQuery(chatMessagesOptions(sessionId))
