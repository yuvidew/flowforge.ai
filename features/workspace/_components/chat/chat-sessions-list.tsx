"use client";

import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useGetChatSessions } from "../../hook/use-get-chat-sessions";

// Short date + time for a session row, in the viewer's locale.
const formatUpdatedAt = (iso: string) =>
  new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/**
 * @component ChatSessionsList
 * @description The current board's chat sessions, newest activity first. Picking one opens its conversation;
 * "New chat" goes back to an empty chat.
 * @param activeId Id of the session currently open, highlighted in the list.
 * @param disabled True while a message is being processed, so the user can't switch chats mid-turn.
 */
export const ChatSessionsList = ({
  projectId,
  activeId,
  disabled,
  onSelect,
  onNewChat,
}: {
  projectId: string;
  activeId: string | null;
  disabled: boolean;
  onSelect: (session: { id: string; name: string }) => void;
  onNewChat: () => void;
}) => {
  const { data: sessions, isPending, isError, refetch } = useGetChatSessions(projectId);

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t">
      <div className="p-3 pb-0">
        <Button variant="outline" size="sm" className="w-full" disabled={disabled} onClick={onNewChat}>
          <Plus /> New chat
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {isPending ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Spinner className="mr-2" /> Loading sessions…
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-8 text-sm">
            <p className="text-muted-foreground">Couldn&apos;t load your sessions.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No sessions on this board yet. Start a chat and it will show up here.
          </p>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect({ id: session.id, name: session.name })}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
                session.id === activeId && "border-primary/60 bg-primary/5",
              )}
            >
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{session.name}</span>
                <span className="block text-xs text-muted-foreground">{formatUpdatedAt(session.updatedAt)}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
