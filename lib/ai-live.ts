import { Liveblocks } from "@liveblocks/node";
import type { Json } from "@liveblocks/client";

import { getBoardRoomId } from "@/lib/liveblocks";
import type { SceneElement } from "@/lib/scene-elements";

// Server-side Liveblocks client; null when the secret isn't configured, in which case drawing falls back to the browser queue.
const liveblocks = process.env.LIVEBLOCKS_SECRET_KEY ? new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY }) : null;

// Cursor colour for AI collaborators, so they stand apart from people.
const AI_COLOR = "#7c3aed";
// Elements revealed per step, and the pause between steps; the whole reveal is capped near MAX_REVEAL_MS.
const BATCH_SIZE = 4;
const MIN_STEP_MS = 60;
const MAX_STEP_MS = 220;
const MAX_REVEAL_MS = 4000;
// The AI cursor disappears on its own this many seconds after the last move (Liveblocks presence TTL).
const PRESENCE_TTL_S = 20;

// Whether live streaming to open tabs is possible at all.
export const isLiveAvailable = () => liveblocks !== null;

// Friendly names for the `clientInfo.name` values common MCP clients send.
const KNOWN_CLIENTS: Record<string, string> = {
  "claude-code": "Claude Code",
  "claude-ai": "Claude",
  "cursor-vscode": "Cursor",
  cursor: "Cursor",
  "visual-studio-code": "VS Code",
  vscode: "VS Code",
  opencode: "OpenCode",
  "openai-mcp": "ChatGPT",
  chatgpt: "ChatGPT",
};

// Picks the AI tool's display name: the MCP client's own name if known, else what the model said it is, else a generic label.
export const resolveAgentName = (clientName?: string | null, claimed?: string | null) => {
  const known = clientName ? KNOWN_CLIENTS[clientName.toLowerCase()] : undefined;
  const name = known ?? claimed?.trim() ?? clientName?.trim() ?? "AI assistant";
  return name.slice(0, 40) || "AI assistant";
};

// Presence is best-effort: a failure must never break the draw itself.
const safely = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    console.error("Live collaboration update failed", error);
  }
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Moves the named AI cursor on the board (or hides it when pointer is null). Shows up in useOthers() like any collaborator.
const setAiCursor = (boardId: string, agentName: string, pointer: { x: number; y: number } | null, ttl = PRESENCE_TTL_S) =>
  safely(() =>
    liveblocks!.setPresence(getBoardRoomId(boardId), {
      userId: `ai:${agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      data: { pointer: pointer ? { ...pointer, tool: "pointer" } : null, button: "up", selectedElementIds: {} },
      userInfo: { name: agentName, avatar: "", color: AI_COLOR },
      ttl,
    }),
  );

// Elements that are new or newer in `after` than in `before`, in `after`'s order.
export const changedElements = (before: SceneElement[], after: SceneElement[]) => {
  const versions = new Map(before.map((element) => [element.id, element.version]));
  return after.filter((element) => versions.get(element.id) !== element.version);
};

// Combines the stored scene with the elements we streamed: the higher version of each id wins, unknown ids are added.
export const mergeById = (base: SceneElement[], ours: SceneElement[]) => {
  const byId = new Map(base.map((element) => [element.id, element]));
  for (const element of ours) {
    const existing = byId.get(element.id);
    if (!existing || existing.version < element.version) byId.set(element.id, element);
  }
  // Keeps the stored order, with brand-new elements at the end.
  const seen = new Set(base.map((element) => element.id));
  return [...base.map((element) => byId.get(element.id)!), ...ours.filter((element) => !seen.has(element.id))];
};

// Reveals `elements` to everyone on the board a few at a time while the named AI cursor moves along, so people watch the
// diagram being built instead of seeing it appear at once.
export const streamToRoom = async (boardId: string, agentName: string, elements: SceneElement[]) => {
  if (!liveblocks || elements.length === 0) return;

  const room = getBoardRoomId(boardId);
  const batches: SceneElement[][] = [];
  for (let i = 0; i < elements.length; i += BATCH_SIZE) batches.push(elements.slice(i, i + BATCH_SIZE));
  const step = Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, Math.floor(MAX_REVEAL_MS / batches.length)));

  for (const batch of batches) {
    await safely(() => liveblocks.broadcastEvent(room, { type: "scene-update", elements: batch as unknown as Json[] }));
    // The cursor rests on the last element of the batch.
    const last = batch[batch.length - 1];
    await setAiCursor(boardId, agentName, { x: Math.round(last.x + last.width / 2), y: Math.round(last.y + last.height / 2) });
    await pause(step);
  }
};

// Tells open tabs the board was saved at this version (so their next autosave isn't a conflict) and fades the AI cursor out.
export const finishLive = async (boardId: string, agentName: string, version: number) => {
  if (!liveblocks) return;
  await safely(() => liveblocks.broadcastEvent(getBoardRoomId(boardId), { type: "scene-saved", version }));
  await setAiCursor(boardId, agentName, null, 2);
};
