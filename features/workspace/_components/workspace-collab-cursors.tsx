"use client";

import { useEffect } from "react";
import { useOthers } from "@liveblocks/react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * @component WorkspaceCollabCursors
 * @description Headless layer that mirrors everyone else's presence (cursor, name, colour, selection) into Excalidraw's own `collaborators` map, so Excalidraw draws each person's named cursor on the canvas. Renders nothing. Lives in its own component so cursor movement only re-renders this, not the whole whiteboard.
 * @param excalidrawApi - Imperative API of the canvas; null until Excalidraw has mounted.
 */
export const WorkspaceCollabCursors = ({ excalidrawApi }: { excalidrawApi: ExcalidrawImperativeAPI | null }) => {
  const others = useOthers();

  useEffect(() => {
    if (!excalidrawApi) return;

    // Keyed by connection (not user) so the same person in two tabs gets two cursors.
    const collaborators = new Map();
    for (const other of others) {
      collaborators.set(String(other.connectionId), {
        pointer: other.presence.pointer ?? undefined,
        button: other.presence.button,
        selectedElementIds: other.presence.selectedElementIds,
        username: other.info.name,
        color: { background: other.info.color, stroke: other.info.color },
        avatarUrl: other.info.avatar,
        id: other.id,
      });
    }

    excalidrawApi.updateScene({ collaborators });
  }, [excalidrawApi, others]);

  return null;
};
