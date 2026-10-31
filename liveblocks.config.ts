import type { Json } from "@liveblocks/client";

// Types the whole Liveblocks integration (useSelf / useOthers / useEventListener ...). See the `type-liveblocks-correctly` reference.
declare global {
  interface Liveblocks {
    // What each connected person shares with the room while the board is open.
    Presence: {
      // Cursor position in Excalidraw scene coordinates; null when the pointer hasn't moved yet.
      pointer: { x: number; y: number; tool: "pointer" | "laser" } | null;
      // Whether the mouse button is held down (Excalidraw draws the cursor slightly differently).
      button: "up" | "down";
      // Elements this person has selected, so others see the selection outlined in their colour.
      selectedElementIds: Record<string, true>;
    };

    // Filled by /api/liveblocks-auth from the signed-in Clerk user.
    UserMeta: {
      id: string;
      info: {
        name: string;
        email: string;
        avatar: string;
        color: string;
      };
    };

    // Canvas sync messages. Elements/files are Excalidraw's opaque JSON; the receiver reconciles them by version.
    RoomEvent:
      | { type: "scene-update"; elements: Json[]; files?: { [fileId: string]: Json } }
      // A newly opened board asks everyone online to send their live scene.
      | { type: "scene-request" }
      // Sent after a successful autosave so everyone's next save is based on the newest server version.
      | { type: "scene-saved"; version: number };
  }
}


