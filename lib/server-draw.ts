import type { EditOp, PendingItem } from "@/features/workspace/types/types";
import type { DiagramSpec } from "@/features/workspace/ai/diagram-schema";
import { buildDiagramSkeleton, originForBackdrop } from "@/features/workspace/ai/diagram-to-elements";
import type { AiModeId } from "@/features/workspace/ai/prompts";
import { changedElements, finishLive, isLiveAvailable, mergeById, streamToRoom } from "@/lib/ai-live";
import { isBoardOpenInBrowser, loadScene, writeScene } from "@/lib/board-scene";
import { queueDiagram } from "@/lib/boards";
import { appendElements, bump, fitLabelInShape, skeletonToElements, type SceneElement } from "@/lib/scene-elements";

// Horizontal gap between existing content and a newly drawn diagram (same as the browser's findEmptyOrigin).
const PLACEMENT_GAP = 120;
// How often a write is retried after losing a version race, and the board size above which the browser draws instead.
const MAX_ATTEMPTS = 3;
const MAX_SERVER_ELEMENTS = 5000;

export type SubmitStatus = "drawn" | "queued" | "no-match";

// Top-left for new content: right of everything on the board, or a fixed spot when it is empty (the server has no viewport).
const findEmptyOrigin = (elements: SceneElement[]) => {
  const live = elements.filter((element) => !element.isDeleted);
  if (live.length === 0) return { x: 100, y: 100 };

  const minY = live.reduce((min, element) => Math.min(min, element.y), Infinity);
  const maxX = live.reduce((max, element) => Math.max(max, element.x + element.width), -Infinity);
  return { x: Math.round(maxX + PLACEMENT_GAP), y: Math.round(minY) };
};

// Adds a new diagram to the right of the existing content.
const drawDiagram = (elements: SceneElement[], spec: DiagramSpec, mode: AiModeId) =>
  appendElements(elements, skeletonToElements(buildDiagramSkeleton(spec, findEmptyOrigin(elements), mode)));

// Replaces one diagram with a redrawn one in the same place; null when the diagram is no longer on the board.
const reviseDiagram = (elements: SceneElement[], diagramId: string, spec: DiagramSpec, mode: AiModeId) => {
  const members = elements.filter((element) => !element.isDeleted && element.groupIds?.includes(diagramId));
  if (members.length === 0) return null;

  // The diagram's backdrop is its top-left-most element, which is where the redraw starts.
  const left = Math.min(...members.map((element) => element.x));
  const top = Math.min(...members.map((element) => element.y));

  // The diagram's own elements plus the text labels bound to them.
  const doomed = new Set(members.map((element) => element.id));
  elements.forEach((element) => {
    if (element.type === "text" && element.containerId && doomed.has(element.containerId)) doomed.add(element.id);
  });

  const kept = elements.map((element) => (doomed.has(element.id) ? bump(element, { isDeleted: true }) : element));
  return appendElements(kept, skeletonToElements(buildDiagramSkeleton(spec, originForBackdrop(left, top), mode)));
};

// Server twin of the browser's applyEdits. `applied` is false when no op found its shape.
const applyEditOps = (elements: SceneElement[], ops: EditOp[]) => {
  const changed = new Map<string, SceneElement>();
  // Latest version of an element (an earlier op of this batch may have changed it).
  const latest = (element: SceneElement) => changed.get(element.id) ?? element;
  let applied = 0;

  for (const op of ops) {
    const shape = elements.find(
      (element) => !element.isDeleted && element.customData?.nodeId === op.nodeId && element.customData?.diagramId === op.diagramId,
    );
    if (!shape) continue;

    // A shape's label is a separate text element that points back at the shape through containerId.
    const label = elements.find((element) => element.type === "text" && element.containerId === shape.id && !element.isDeleted);

    if (op.op === "update_text" && label) {
      const fit = fitLabelInShape(latest(shape), op.text, label.fontSize ?? 16);
      changed.set(label.id, bump(latest(label), { text: fit.text, originalText: op.text, width: fit.width, height: fit.height, x: fit.x, y: fit.y }));
      applied++;
    }

    if (op.op === "set_color") {
      changed.set(shape.id, bump(latest(shape), {
        backgroundColor: op.fill ?? shape.backgroundColor,
        strokeColor: op.stroke ?? shape.strokeColor,
      }));
      applied++;
    }

    if (op.op === "delete") {
      // The shape, its label, the arrows touching it and those arrows' labels all go.
      const arrows = elements.filter(
        (element) => element.type === "arrow" && (element.startBinding?.elementId === shape.id || element.endBinding?.elementId === shape.id),
      );
      const doomed = new Set([shape.id, label?.id, ...arrows.map((arrow) => arrow.id)]);
      elements.forEach((element) => {
        if (doomed.has(element.id) || (element.type === "text" && element.containerId && doomed.has(element.containerId))) {
          changed.set(element.id, bump(latest(element), { isDeleted: true }));
        }
      });
      applied++;
    }
  }

  return { elements: elements.map((element) => changed.get(element.id) ?? element), applied: applied > 0 };
};

// Applies one queued item (new diagram, edits or redraw) to a list of saved elements.
const applyPendingItem = (elements: SceneElement[], item: PendingItem) => {
  if ("ops" in item) return applyEditOps(elements, item.ops);

  if ("kind" in item && item.kind === "revise") {
    const next = reviseDiagram(elements, item.diagramId, item.spec, item.mode);
    return next ? { elements: next, applied: true } : { elements, applied: false };
  }

  return { elements: drawDiagram(elements, item.spec, item.mode), applied: true };
};

// Where every MCP draw / edit / revise goes. With a browser tab open the result is streamed to everyone on the board
// shape by shape (with a named AI cursor) and then saved; otherwise it is drawn on the server and saved before returning.
// Any server failure falls back to the queue, so nothing is lost.
export const submitToBoard = async (boardId: string, item: PendingItem, agentName = "AI assistant"): Promise<SubmitStatus> => {
  const open = await isBoardOpenInBrowser(boardId);
  const live = open && isLiveAvailable();

  // Without Liveblocks configured, an open tab still draws the queued item itself.
  if (open && !live) {
    await queueDiagram(boardId, item);
    return "queued";
  }

  try {
    // Set once the elements have been shown to the room, so a retry merges them instead of drawing (new ids) again.
    let streamed: SceneElement[] | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const scene = await loadScene(boardId);
      if (scene.elements.length > MAX_SERVER_ELEMENTS) break;

      let elements: SceneElement[];
      let applied = true;

      if (streamed) {
        // Lost the version race after streaming: keep what peers already saw and add it to the newer saved scene.
        elements = mergeById(scene.elements, streamed);
      } else {
        // Items queued earlier are drawn first, so the order the agent sent them in is kept.
        let next = scene.elements;
        for (const queued of scene.pending) next = applyPendingItem(next, queued).elements;
        const mine = applyPendingItem(next, item);

        if (!mine.applied && scene.pending.length === 0) return "no-match";
        elements = mine.elements;
        applied = mine.applied;

        if (live && mine.applied) {
          const changed = changedElements(scene.elements, elements);
          await streamToRoom(boardId, agentName, changed);
          streamed = changed;
        }
      }

      const result = await writeScene({
        projectId: boardId,
        elements,
        baseVersion: scene.version,
        ackPendingIds: scene.pending.map((queued) => queued.id),
      });

      if (result.ok) {
        if (live) await finishLive(boardId, agentName, result.version);
        return applied ? "drawn" : "no-match";
      }
    }
  } catch (error) {
    console.error("Server-side draw failed, queueing instead", error);
  }

  await queueDiagram(boardId, item);
  return "queued";
};
