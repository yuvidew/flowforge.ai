// Room id for a board's live session; one Liveblocks room per board.
export const getBoardRoomId = (projectId: string) => `board:${projectId}`;

// Inverse of getBoardRoomId; returns null for any room id that isn't a board room.
export const getBoardIdFromRoomId = (roomId: string) =>
    roomId.startsWith("board:") ? roomId.slice("board:".length) : null;
