import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ChatRequest } from "../types/types";
import { isAiModeId } from "../constants";
import { summarizeScene } from "./summarize-scene";


// The FlowForge shapes (the ones that carry ids) the user has selected on the canvas.
export const getSelectedNodes = (api: ExcalidrawImperativeAPI) => {
  const elements = api.getSceneElements();
  const byId = new Map(elements.map((element) => [element.id, element]));
  // Keyed by diagramId + nodeId so a shape selected together with its label counts once.
  const found = new Map<string, { diagramId: string; nodeId: string }>();

  Object.keys(api.getAppState().selectedElementIds).forEach((id) => {
    const element = byId.get(id);
    // Clicking a shape's label selects the text element; the ids live on the shape that holds it.
    const shape = element?.type === "text" && element.containerId ? byId.get(element.containerId) : element;
    const { nodeId, diagramId } = shape?.customData ?? {};
    if (typeof nodeId === "string" && typeof diagramId === "string") {
      found.set(`${diagramId}:${nodeId}`, { diagramId, nodeId });
    }
  });

  return [...found.values()];
};

// Smallest size of a label-less shape that is read as a screen frame, i.e. part of a web/mobile mockup
// (the same thresholds diagram-to-elements uses when it lays mockups out).
const FRAME_MIN_WIDTH = 300;
const FRAME_MIN_HEIGHT = 400;

// The board as the chat route needs it: the shapes FlowForge drew (hand-drawn shapes, arrows, backdrops and titles
// carry no ids, so the AI can't target them) and which of them are selected.
export const buildChatContext = (api: ExcalidrawImperativeAPI): Pick<ChatRequest, "scene" | "selected"> => {
  const elements = api.getSceneElements();
  // Only FlowForge shapes and the texts labelling them go through summarizeScene: its size cap counts every element
  // it is given, so a board full of arrows and hand-drawn shapes must not push FlowForge shapes out of the scene.
  const shapes = elements.filter(
    (element) =>
      !element.isDeleted &&
      typeof element.customData?.nodeId === "string" &&
      typeof element.customData?.diagramId === "string",
  );
  const shapeIds = new Set(shapes.map((shape) => shape.id));
  const labels = elements.filter(
    (element) => element.type === "text" && element.containerId && shapeIds.has(element.containerId),
  );

  const items = summarizeScene([...shapes, ...labels]).elements.flatMap((item) =>
    item.nodeId && item.diagramId ? [{ ...item, nodeId: item.nodeId, diagramId: item.diagramId }] : [],
  );

  // Diagrams drawn before the mode was stored have none. A label-less, screen-sized frame marks a mockup, which can't
  // be revised, so those are reported as "web" (only used to block revising, never to draw anything).
  const legacyMockups = new Set(
    items
      .filter(
        (item) =>
          !isAiModeId(item.mode) && !item.text && item.width >= FRAME_MIN_WIDTH && item.height >= FRAME_MIN_HEIGHT,
      )
      .map((item) => item.diagramId),
  );

  const scene = items.map((item) => ({
    diagramId: item.diagramId,
    nodeId: item.nodeId,
    type: item.type,
    text: item.text,
    fill: item.fill,
    stroke: item.stroke,
    mode: isAiModeId(item.mode) ? item.mode : legacyMockups.has(item.diagramId) ? ("web" as const) : undefined,
  }));

  return { scene, selected: getSelectedNodes(api) };
};
