"use client";

import type { ReactNode } from "react";
import { LiveblocksProvider, RoomProvider } from "@liveblocks/react";
import { getBoardRoomId } from "@/lib/liveblocks";

/**
 * @component WorkspaceCollabProvider
 * @description Connects the workspace to the board's Liveblocks room (one room per board) so everything inside can read who else is online and sync the canvas. Authentication goes through /api/liveblocks-auth, which only admits the owner and invited collaborators.
 * @param projectId - Public id of the board; the room id is derived from it.
 */
export const WorkspaceCollabProvider = ({ projectId, children }: { projectId: string; children: ReactNode }) => {
  return (
    // throttle=16 sends presence/events at ~60fps so remote cursors move smoothly.
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth" throttle={16}>
      <RoomProvider
        id={getBoardRoomId(projectId)}
        initialPresence={{ pointer: null, button: "up", selectedElementIds: {} }}
      >
        {children}
      </RoomProvider>
    </LiveblocksProvider>
  );
};
