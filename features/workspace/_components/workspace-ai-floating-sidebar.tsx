"use client";

import { useEffect, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AiModeId } from "../ai/prompts";
import { readSessionParam, writeSessionParam } from "../chat-session-url";
import { useDeleteChatSession } from "../hook/use-delete-chat-session";
import { useGetChatSessions } from "../hook/use-get-chat-sessions";
import { useRenameChatSession } from "../hook/use-rename-chat-session";
import { useSendChatMessage } from "../hook/use-send-chat-message";
import { ChatComposer } from "./chat/chat-composer";
import { ChatHeader } from "./chat/chat-header";
import { ChatMessageList } from "./chat/chat-message-list";
import { ChatSessionMenu } from "./chat/chat-session-menu";
import { ChatSessionsList } from "./chat/chat-sessions-list";
import { ChatStartView } from "./chat/chat-start-view";
import { DeleteSessionDialog } from "./chat/delete-session-dialog";
import { SessionNameInput } from "./chat/session-name-input";

/**
 * @component WorkspaceAiFloatingSidebar
 * @description Bottom-right AI button on the whiteboard that opens the AI chat. The assistant answers questions,
 * edits shapes on the canvas or draws a new diagram. Conversations are saved as sessions per board: the popover
 * shows a start screen, the open conversation, or the board's session list.
 * @param excalidrawApi Imperative API of the whiteboard canvas (null until Excalidraw has mounted).
 * @param projectId Id of the board the chat belongs to; sessions are scoped to it.
 */
export const WorkspaceAiFloatingSidebar = ({
  excalidrawApi,
  projectId,
}: {
  excalidrawApi: ExcalidrawImperativeAPI | null;
  projectId: string;
}) => {
  // Controlled so the header close button can dismiss the popover.
  const [open, setOpen] = useState(false);
  // Which screen is showing: the conversation (or start screen) or the list of sessions.
  const [view, setView] = useState<"chat" | "sessions">("chat");
  // The open session; null means a new chat that is saved on its first message.
  // Lives here (not in the popover content) so closing the popover keeps the chat and any running request.
  const [activeSession, setActiveSession] = useState<{ id: string; name: string } | null>(null);
  const [draft, setDraft] = useState("");
  // Diagram type hint picked in the composer; null lets the AI decide. Cleared after each send.
  const [modeId, setModeId] = useState<AiModeId | null>(null);
  // The message being sent, shown in the transcript until the saved version arrives.
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Session id found in the URL when the page loaded, and whether it has been dealt with (restored or dropped).
  const [urlSessionId, setUrlSessionId] = useState<string | null>(null);
  const [restoreDone, setRestoreDone] = useState(false);

  const { mutate: sendMessage, isPending: sending } = useSendChatMessage();
  const { mutate: renameSession, isPending: renamePending } = useRenameChatSession(projectId);
  const { mutate: deleteSession, isPending: deletePending } = useDeleteChatSession(projectId);
  // Looked up only while restoring from the URL: the URL has the id, the list has the name.
  const restoring = !!urlSessionId && !restoreDone;
  const { data: sessions, isSuccess: sessionsLoaded, isError: sessionsFailed } = useGetChatSessions(projectId, restoring);

  // Makes `session` the open one (null = new chat) and mirrors it in the URL, so a reload opens the same conversation.
  const changeSession = (session: { id: string; name: string } | null) => {
    setActiveSession(session);
    setRenaming(false);
    writeSessionParam(session?.id ?? null);
  };

  // On first load, read the session id from the URL (window isn't available while rendering on the server).
  useEffect(() => {
    const id = readSessionParam();
    setUrlSessionId(id);
    if (!id) setRestoreDone(true);
  }, []);

  // Reopens the conversation named in the URL, once, as soon as the board's sessions are known. An id that isn't one
  // of this board's sessions (deleted, or from another board) is dropped from the URL.
  useEffect(() => {
    if (!restoring) return;
    if (sessionsFailed) {
      setRestoreDone(true);
      return;
    }
    if (!sessionsLoaded) return;

    const found = sessions.find((session) => session.id === urlSessionId);
    if (found) {
      setActiveSession({ id: found.id, name: found.name });
      setView("chat");
      setOpen(true);
    } else {
      writeSessionParam(null);
    }
    setRestoreDone(true);
  }, [restoring, sessionsFailed, sessionsLoaded, sessions, urlSessionId]);

  // Sends the text (or the draft); the input and mode are given back if the request fails so the user can retry.
  const handleSend = (text: string) => {
    const message = text.trim();
    if (!excalidrawApi || sending || !message) return;

    const mode = modeId ?? undefined;
    setPendingMessage(message);
    setDraft("");
    setModeId(null);

    sendMessage(
      { excalidrawApi, projectId, sessionId: activeSession?.id, message, mode },
      {
        // A new chat gets its id and name from the server; an existing one keeps its (maybe renamed) name.
        onSuccess: ({ sessionId, sessionName }) => {
          if (activeSession?.id !== sessionId) changeSession({ id: sessionId, name: sessionName });
        },
        onError: () => {
          setDraft(message);
          setModeId(mode ?? null);
        },
        onSettled: () => setPendingMessage(null),
      },
    );
  };

  // Opens a saved conversation from the session list.
  const openSession = (session: { id: string; name: string }) => {
    changeSession(session);
    setView("chat");
  };

  // Goes back to an empty chat; nothing is saved until the first message.
  const startNewChat = () => {
    changeSession(null);
    setView("chat");
  };

  const showSessions = () => {
    setRenaming(false);
    setView("sessions");
  };

  const hasConversation = !!activeSession || !!pendingMessage;

  return (
    // Pinned to the canvas' bottom-right corner.
    <div className="absolute right-15 bottom-10 z-50">
      <Popover
        open={open}
        onOpenChange={(next, eventDetails) => {
          // Clicking elsewhere on the page (or tabbing away) must not close the chat; only the X button, the AI
          // button or Escape do. The popover is controlled, so ignoring the event keeps it open.
          if (!next && (eventDetails.reason === "outside-press" || eventDetails.reason === "focus-out")) return;
          setOpen(next);
        }}
      >
        <PopoverTrigger render={<Button />}>
          <Sparkles />
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          className="flex h-[70vh] max-h-160 w-104 flex-col gap-0 overflow-hidden rounded-2xl p-0"
        >
          {view === "sessions" ? (
            <>
              <ChatHeader
                title="Chat sessions"
                description="Conversations on this board"
                onClose={() => setOpen(false)}
              />
              <ChatSessionsList
                projectId={projectId}
                activeId={activeSession?.id ?? null}
                disabled={sending}
                onSelect={openSession}
                onNewChat={startNewChat}
              />
            </>
          ) : (
            <>
              <ChatHeader
                title={
                  renaming && activeSession ? (
                    <SessionNameInput
                      initialName={activeSession.name}
                      disabled={renamePending}
                      onCancel={() => setRenaming(false)}
                      onSubmit={(name) =>
                        renameSession(
                          { sessionId: activeSession.id, name },
                          {
                            onSuccess: () => {
                              setActiveSession({ id: activeSession.id, name });
                              setRenaming(false);
                            },
                          },
                        )
                      }
                    />
                  ) : (
                    (activeSession?.name ?? (hasConversation ? "New chat" : "AI Helper"))
                  )
                }
                description={hasConversation ? undefined : "Create diagrams or edit what's on the board"}
                onClose={() => setOpen(false)}
                actions={
                  activeSession ? (
                    <ChatSessionMenu
                      disabled={sending}
                      onRename={() => setRenaming(true)}
                      onShowSessions={showSessions}
                      onDelete={() => setDeleting(true)}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Session list"
                      title="Session list"
                      disabled={sending}
                      onClick={showSessions}
                    >
                      <History />
                    </Button>
                  )
                }
              />

              {hasConversation ? (
                <ChatMessageList
                  sessionId={activeSession?.id ?? null}
                  pendingMessage={pendingMessage}
                  thinking={sending}
                />
              ) : (
                <ChatStartView modeId={modeId} disabled={sending || !excalidrawApi} onPick={handleSend} />
              )}

              <ChatComposer
                value={draft}
                onChange={setDraft}
                onSend={() => handleSend(draft)}
                modeId={modeId}
                onModeChange={setModeId}
                pending={sending}
                disabled={!excalidrawApi}
              />
            </>
          )}

          {/* Inside the popover's React tree so clicking the dialog doesn't count as an outside click. */}
          <DeleteSessionDialog
            open={deleting}
            onOpenChange={setDeleting}
            sessionName={activeSession?.name ?? ""}
            pending={deletePending}
            onConfirm={() => {
              if (!activeSession) return;
              deleteSession(activeSession.id, {
                onSuccess: () => {
                  setDeleting(false);
                  changeSession(null);
                },
              });
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
