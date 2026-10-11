import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { isAiModeId } from "../constants";
import type { DiagramSpec } from "./diagram-schema";
import type { AiModeId } from "./prompts";

// Shapes FlowForge draws for a node; anything else in the group (backdrop panel, arrows, texts) is not a node.
const NODE_SHAPES = ["rectangle", "ellipse", "diamond"] as const;

// Mode used for diagrams drawn before the mode was stored on them; it only decides the layout direction (top-down).
const DEFAULT_MODE: AiModeId = "flowchart";

// Rebuilds the spec (nodes and edges) of one diagram on the canvas from its elements, the reverse of diagramToElements,
// so the AI can be asked to change it. Also returns the diagram's mode and the top-left corner of everything in it
// (its backdrop), where the revised diagram is drawn. Null when the diagram is no longer on the board.
export const readDiagram = async (api: ExcalidrawImperativeAPI, diagramId: string) => {
  const { getCommonBounds } = await import("@excalidraw/excalidraw");
  const elements = api.getSceneElements().filter((element) => !element.isDeleted);
  // Every element FlowForge drew for the diagram shares its diagramId as a group.
  const members = elements.filter((element) => element.groupIds.includes(diagramId));

  // A label (or arrow label) is a separate text element pointing at its container.
  const textOf = (containerId: string) => {
    const label = elements.find((element) => element.type === "text" && element.containerId === containerId);
    return label?.type === "text" ? label : null;
  };

  const shapes = members.flatMap((element) => {
    const nodeId = element.customData?.nodeId;
    const shape = NODE_SHAPES.find((type) => type === element.type);
    return typeof nodeId === "string" && shape ? [{ element, nodeId, shape }] : [];
  });
  if (shapes.length === 0) return null;

  // Excalidraw ids change on every draw, so arrows are matched back to nodes through this map.
  const nodeIdByElementId = new Map(shapes.map(({ element, nodeId }) => [element.id, nodeId]));

  const nodes: DiagramSpec["nodes"] = shapes.map(({ element, nodeId, shape }) => {
    const label = textOf(element.id);
    return {
      id: nodeId,
      label: label?.originalText ?? "",
      shape,
      x: Math.round(element.x),
      y: Math.round(element.y),
      width: Math.round(element.width),
      height: Math.round(element.height),
      fill: element.backgroundColor,
      stroke: element.strokeColor,
      strokeStyle: element.strokeStyle === "dashed" ? "dashed" : "solid",
      fontSize: label?.fontSize,
    };
  });

  const edges: DiagramSpec["edges"] = members.flatMap((element) => {
    if (element.type !== "arrow") return [];
    const from = nodeIdByElementId.get(element.startBinding?.elementId ?? "");
    const to = nodeIdByElementId.get(element.endBinding?.elementId ?? "");
    if (!from || !to) return [];

    return [
      {
        from,
        to,
        label: textOf(element.id)?.originalText,
        style: element.strokeStyle === "dashed" ? ("dashed" as const) : ("solid" as const),
        arrowhead: element.endArrowhead ? ("arrow" as const) : ("none" as const),
      },
    ];
  });

  // Free-standing texts of the group (not labels): the topmost one is the diagram's title, the rest are notes.
  const freeTexts = members
    .flatMap((element) => (element.type === "text" && !element.containerId ? [element] : []))
    .sort((a, b) => a.y - b.y);
  const [title, ...notes] = freeTexts;

  const spec: DiagramSpec = {
    title: title?.originalText ?? "Diagram",
    nodes,
    edges,
    texts: notes.map((note) => ({
      text: note.originalText,
      x: Math.round(note.x),
      y: Math.round(note.y),
      fontSize: note.fontSize,
    })),
  };

  const storedMode = shapes[0].element.customData?.mode;
  const mode = typeof storedMode === "string" && isAiModeId(storedMode) ? storedMode : DEFAULT_MODE;
  const [minX, minY] = getCommonBounds(members);

  return { spec, mode, bounds: { minX, minY } };
};
