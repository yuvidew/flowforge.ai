"use client";

import type { UIEvent } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
import { useGetChatMessages } from "../../hook/use-get-chat-messages";

// How close to the top (in px) the user must scroll before the next page of older messages is requested.
const LOAD_OLDER_THRESHOLD = 80;

/**
 * @component ChatMessageList
 * @description Scrollable transcript of a chat session. Opens at the newest message and loads older pages (50 at a
 * time) when the user scrolls to the top. While a message is being sent it shows the user's text and a "Thinking…" row.
 * @param sessionId Session to show; null for a brand-new chat that has no saved messages yet.
 * @param pendingMessage Text of the message being sent, shown right away before it is saved.
 * @param thinking True while waiting for the AI's answer.
 */
export const ChatMessageList = ({
  sessionId,
  pendingMessage,
  thinking,
}: {
  sessionId: string | null;
  pendingMessage: string | null;
  thinking: boolean;
}) => {
  const { data: messages, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useGetChatMessages(sessionId);

  // Loads the next (older) page once the user is near the top.
  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (event.currentTarget.scrollTop < LOAD_OLDER_THRESHOLD && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  };

  // A saved session that is still loading (a new chat has no query, so it skips this).
  if (sessionId && isPending) {
    return (
      <div className="flex flex-1 items-center justify-center border-t text-sm text-muted-foreground">
        <Spinner className="mr-2" /> Loading messages…
      </div>
    );
  }

  if (sessionId && isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 border-t text-sm">
        <p className="text-muted-foreground">Couldn&apos;t load this conversation.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 border-t">
      {/* Keyed by session so switching chats re-opens at the newest message. */}
      <MessageScrollerProvider key={sessionId ?? "new"} defaultScrollPosition="end">
        <MessageScroller>
          <MessageScrollerViewport preserveScrollOnPrepend onScroll={handleScroll} className="px-4 py-3">
            <MessageScrollerContent className="gap-3">
              {isFetchingNextPage && (
                <div className="flex justify-center py-1">
                  <Spinner />
                </div>
              )}
              {messages?.map((message) => (
                <MessageScrollerItem key={message.id} messageId={String(message.id)}>
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>
                      <Bubble variant={message.role === "user" ? "default" : "muted"}>
                        <BubbleContent className="whitespace-pre-wrap">{message.content}</BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
              {pendingMessage && (
                <MessageScrollerItem messageId="pending">
                  <Message align="end">
                    <MessageContent>
                      <Bubble variant="default">
                        <BubbleContent className="whitespace-pre-wrap">{pendingMessage}</BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}
              {thinking && (
                <MessageScrollerItem messageId="thinking">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Spinner /> Thinking…
                  </div>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  );
};
