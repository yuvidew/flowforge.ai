import { isAiModeId } from "../constants";
import type { ReadDiagram, SavedElement } from "../types/types";
import type { DiagramSpec } from "./diagram-schema";
import type { AiModeId } from "./prompts";

// Shapes FlowForge draws for a node; anything else in a diagram's group (backdrop, arrows, texts) is not a node.
const NODE_SHAPES = ["rectangle", "ellipse", "diamond"] as const;

// Smallest size of a label-less shape that is read as a screen frame, i.e. part of a web/mobile mockup.
const FRAME_MIN_WIDTH = 300;
const FRAME_MIN_HEIGHT = 400;

// Rebuilds every FlowForge diagram in a list of saved elements (the reverse of diagramToElements). Pure, so the server
// (saved board) and the browser (live canvas) can share it. Edges use nodeIds, not Excalidraw's element ids.
export const readDiagrams = (saved: readonly SavedElement[]): ReadDiagram[] => {
    const live = saved.filter((ele) => !ele.isDeleted);

    
  // A label (or arrow label) is a separate text element pointing at its container.
  const textOf = (containerId: string) =>
    live.find((element) => element.type === "text" && element.containerId === containerId);

  const diagramIds = new Set<string>();
  live.forEach((ele) => {
    const id = ele.customData?.diagramId;

    if(typeof id === "string") diagramIds.add(id);
  });

  return [...diagramIds].flatMap((diagramId) => {
    // Every element FlowForge drew for the diagram shares its diagramId as a group.
    const members = live.filter((ele) => ele.groupIds?.includes(diagramId));

    const shapes = members.flatMap((element) => {
      const nodeId = element.customData?.nodeId;
      const shape = NODE_SHAPES.find((type) => type === element.type);
      return typeof nodeId === "string" && shape ? [{ element, nodeId, shape }] : [];
    });

    if (shapes.length === 0) return [];

    // Excalidraw ids change on every draw, so arrows are matched back to nodes through this map.
    const nodeIdByElementId = new Map(shapes.map(({ element, nodeId }) => [element.id, nodeId]));

    const nodes: DiagramSpec["nodes"] = shapes.map(({ element, nodeId, shape }) => {
      const label = textOf(element.id);
      return {
        id: nodeId,
        label: label?.originalText ?? label?.text ?? "",
        shape,
        x: Math.round(element.x),
        y: Math.round(element.y),
        width: Math.round(element.width),
        height: Math.round(element.height),
        fill: element.backgroundColor ?? "transparent",
        stroke: element.strokeColor ?? "#1e1e1e",
        strokeStyle: element.strokeStyle === "dashed" ? "dashed" : "solid",
        fontSize: label?.fontSize,
      };
    });

    const edges: DiagramSpec["edges"] = members.flatMap((element) => {
      if (element.type !== "arrow") return [];
      const from = nodeIdByElementId.get(element.startBinding?.elementId ?? "");
      const to = nodeIdByElementId.get(element.endBinding?.elementId ?? "");
      if (!from || !to) return [];

      const label = textOf(element.id);
      return [
        {
          from,
          to,
          label: label?.originalText ?? label?.text,
          style: element.strokeStyle === "dashed" ? ("dashed" as const) : ("solid" as const),
          arrowhead: element.endArrowhead ? ("arrow" as const) : ("none" as const),
        },
      ];
    });

    // Free-standing texts of the group (not labels): the topmost one is the title, the rest are notes.
    const [title, ...notes] = members
      .filter((element) => element.type === "text" && !element.containerId)
      .sort((a, b) => a.y - b.y);

    const storedMode = shapes[0].element.customData?.mode;
    const mode = typeof storedMode === "string" && isAiModeId(storedMode) ? storedMode : null;
    // Without a stored mode, a label-less screen-sized frame is the sign of a mockup.
    const revisable = mode
      ? mode !== "web" && mode !== "mobile"
      : !shapes.some(
          ({ element }) => !textOf(element.id) && element.width >= FRAME_MIN_WIDTH && element.height >= FRAME_MIN_HEIGHT,
        );

     return [
      {
        diagramId,
        mode,
        revisable,
        spec: {
          title: title?.originalText ?? title?.text ?? "Diagram",
          nodes,
          edges,
          texts: notes.map((note) => ({
            text: note.originalText ?? note.text ?? "",
            x: Math.round(note.x),
            y: Math.round(note.y),
            fontSize: note.fontSize,
          })),
        },
      },
    ];

  });
};