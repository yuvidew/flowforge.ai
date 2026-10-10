import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import { autoLayout, usesAutoLayout, type EdgeRoute } from "./auto-layout";
import type { DiagramSpec } from "./diagram-schema";
import type { AiModeId } from "./prompts";

// Top-left corner on the canvas where the diagram's own (0, 0) is placed.
export type Origin = { x: number; y: number };

type Box = { x: number; y: number; width: number; height: number };

// Picks where an arrow leaves one node and enters the next: the facing edge midpoints, on the axis (horizontal or
// vertical) along which the two nodes are furthest apart relative to their size. Returns diagram-space points.
const getEdgeEndpoints = (from: Box, to: Box) => {
  const fromCx = from.x + from.width / 2;
  const fromCy = from.y + from.height / 2;
  const toCx = to.x + to.width / 2;
  const toCy = to.y + to.height / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  const horizontal =
    Math.abs(dx) / (from.width / 2 + to.width / 2) >= Math.abs(dy) / (from.height / 2 + to.height / 2);

  if (horizontal) {
    // When the source's height falls inside the target's (a button pointing at a screen frame), run straight across.
    const toY = fromCy >= to.y && fromCy <= to.y + to.height ? fromCy : toCy;
    return {
      start: { x: dx >= 0 ? from.x + from.width : from.x, y: fromCy },
      end: { x: dx >= 0 ? to.x : to.x + to.width, y: toY },
    };
  }

  return {
    start: { x: fromCx, y: dy >= 0 ? from.y + from.height : from.y },
    end: { x: toCx, y: dy >= 0 ? to.y : to.y + to.height },
  };
};

// Picks a readable label colour for a shape's fill: white on dark/saturated fills, near-black otherwise.
// Excalidraw would otherwise reuse the shape's stroke colour, which can match the fill (invisible text).
const getLabelColor = (fill: string) => {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(fill)?.[1];
  if (!hex) return "#1e1e1e";
  const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5 ? "#ffffff" : "#1e1e1e";
};

// Rough text metrics for Excalidraw's hand-drawn fonts, and how much of an ellipse/diamond is usable for text.
const CHAR_WIDTH = 0.6;
const LINE_HEIGHT = 1.25;
const LABEL_PADDING = 24;
const SHAPE_TEXT_FACTOR = { rectangle: 1, ellipse: 1.45, diamond: 2 } as const;

// Grows a node just enough that its label fits: wide enough to avoid breaking words mid-word, tall enough for the
// wrapped lines. Never shrinks a node, so deliberately large frames and cards are left alone.
const fitNodeToLabel = <T extends DiagramSpec["nodes"][number]>(node: T): T => {
  if (!node.label.trim()) return node;

  const fontSize = node.fontSize ?? 16;
  const factor = SHAPE_TEXT_FACTOR[node.shape];
  const lines = node.label.split("\n");
  const longestWord = Math.max(...lines.flatMap((line) => line.split(/\s+/)).map((word) => word.length));

  const width = Math.max(node.width, Math.ceil(longestWord * fontSize * CHAR_WIDTH * factor + LABEL_PADDING));
  const usable = (width - LABEL_PADDING) / factor;
  const wrappedLines = lines.reduce((total, line) => total + Math.max(1, Math.ceil((line.length * fontSize * CHAR_WIDTH) / usable)), 0);
  const height = Math.max(node.height, Math.ceil((wrappedLines * fontSize * LINE_HEIGHT + LABEL_PADDING) * factor));

  return { ...node, width, height };
};

// Empty gap kept between neighbouring phone screens; wide enough for a "Tap ..." arrow label.
const SCREEN_GAP = 140;

type SpecNode = DiagramSpec["nodes"][number];

// A screen frame: a big shape with no label that other shapes are drawn inside.
const isFrame = (node: SpecNode) => !node.label.trim() && node.width >= 300 && node.height >= 400;

// The smallest frame whose area contains the centre of `node` (null if it isn't inside any frame).
const getFrameOf = (node: SpecNode, nodes: SpecNode[]) => {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  return (
    nodes
      .filter((other) => isFrame(other) && cx >= other.x && cx <= other.x + other.width && cy >= other.y && cy <= other.y + other.height)
      .sort((a, b) => a.width * a.height - b.width * b.height)[0] ?? null
  );
};

// Models often place phone screens edge to edge, leaving no room for navigation arrows. Re-spaces the frames
// left to right with a fixed gap and moves every shape inside a frame along with it.
const spaceScreens = (nodes: SpecNode[]) => {
  const frames = nodes.filter(isFrame).sort((a, b) => a.x - b.x);
  if (frames.length < 2) return nodes;

  const shifts = new Map<string, number>();
  let cursor = frames[0].x;
  frames.forEach((frame) => {
    shifts.set(frame.id, cursor - frame.x);
    cursor += frame.width + SCREEN_GAP;
  });

  return nodes.map((node) => {
    const owner = isFrame(node) ? node : getFrameOf(node, frames);
    const dx = owner ? (shifts.get(owner.id) ?? 0) : 0;
    return dx ? { ...node, x: node.x + dx } : node;
  });
};

// For "Tap X" navigation (a control inside one screen pointing at another screen), a straight arrow across the gap
// between the two frames at the control's height; null when the edge isn't that kind of navigation.
const getScreenCrossing = (from: SpecNode, to: SpecNode, nodes: SpecNode[]) => {
  const fromFrame = getFrameOf(from, nodes);
  if (!isFrame(to) || !fromFrame || fromFrame.id === to.id) return null;

  const y = Math.min(Math.max(from.y + from.height / 2, to.y + 20), to.y + to.height - 20);
  return to.x >= fromFrame.x
    ? { start: { x: fromFrame.x + fromFrame.width, y }, end: { x: to.x, y } }
    : { start: { x: fromFrame.x, y }, end: { x: to.x + to.width, y } };
};

// Colours for the generated diagram's arrows and its backdrop panel (violet matches the loading card).
const NAVIGATION_COLOR = "#8b5cf6";
const NEUTRAL_ROUTE_COLOR = "#6b7280";
const BACKDROP_FILL = "#f5f3ff";
const BACKDROP_TITLE_COLOR = "#5b21b6";
// Space between the diagram and its backdrop edge, and the extra room at the top for the title.
const BACKDROP_PADDING = 48;
const BACKDROP_TITLE_HEIGHT = 56;

// Route (arrow) colour: the source shape's own stroke so flows are colour-coded, falling back to grey when that
// stroke is near-white (borderless shapes) and would be invisible.
const getRouteColor = (node: SpecNode) => {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(node.stroke)?.[1];
  if (!hex) return NEUTRAL_ROUTE_COLOR;
  const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.8 ? NEUTRAL_ROUTE_COLOR : node.stroke;
};

// Backdrop panel + title behind the whole diagram, sized from every shape, text and arrow point; empty array if there is nothing to frame.
const buildBackdrop = (
  spec: DiagramSpec,
  routes: Record<number, EdgeRoute>,
  origin: Origin,
  groupIds: string[],
): ExcalidrawElementSkeleton[] => {
  const xs: number[] = [];
  const ys: number[] = [];
  spec.nodes.forEach((node) => {
    xs.push(node.x, node.x + node.width);
    ys.push(node.y, node.y + node.height);
  });
  (spec.texts ?? []).forEach((item) => {
    const size = item.fontSize ?? 20;
    xs.push(item.x, item.x + item.text.length * size * CHAR_WIDTH);
    ys.push(item.y, item.y + size * 1.4);
  });
  Object.values(routes).forEach((route) =>
    route.forEach((point) => {
      xs.push(point.x);
      ys.push(point.y);
    }),
  );
  if (xs.length === 0) return [];

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const left = origin.x + minX - BACKDROP_PADDING;
  const top = origin.y + minY - BACKDROP_PADDING - BACKDROP_TITLE_HEIGHT;

  return [
    {
      type: "rectangle",
      x: left,
      y: top,
      width: Math.max(...xs) - minX + BACKDROP_PADDING * 2,
      height: Math.max(...ys) - minY + BACKDROP_PADDING * 2 + BACKDROP_TITLE_HEIGHT,
      backgroundColor: BACKDROP_FILL,
      strokeColor: NAVIGATION_COLOR,
      fillStyle: "solid",
      roundness: { type: 3 },
      groupIds,
    },
    {
      type: "text",
      text: spec.title,
      x: left + BACKDROP_PADDING,
      y: top + 20,
      fontSize: 24,
      strokeColor: BACKDROP_TITLE_COLOR,
      groupIds,
    },
  ];
};

// Converts a validated diagram spec into Excalidraw elements positioned from `origin`.
// Graph-style modes (diagram, flowchart, architecture) are laid out automatically; mockups keep the model's coordinates.
// Excalidraw regenerates element ids (keeping arrow bindings intact), so repeated generations never collide.
// Async because the Excalidraw bundle is browser-only and must be imported lazily (never during SSR).
export const diagramToElements = async (rawSpec: DiagramSpec, origin: Origin, mode?: AiModeId) => {
  const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
  // Size nodes to their labels first so both the layout and the drawn shapes use the final dimensions.
  const sized = rawSpec.nodes.map(fitNodeToLabel);
  const fitted = { ...rawSpec, nodes: mode === "mobile" ? spaceScreens(sized) : sized };
  const { spec, routes } =
    mode && usesAutoLayout(mode) ? autoLayout(fitted, mode) : { spec: fitted, routes: {} as Record<number, EdgeRoute> };
  const nodesById = new Map(spec.nodes.map((node) => [node.id, node]));

  // One id per generated diagram: used as the shared group and stored on every node so edits can find it later.
  const diagramId = `diagram-${crypto.randomUUID().slice(0, 8)}`;
  const groupIds = [diagramId];


  const nodes: ExcalidrawElementSkeleton[] = spec.nodes.map((node) => ({
    type: node.shape,
    id: node.id,
    x: origin.x + node.x,
    y: origin.y + node.y,
    width: node.width,
    height: node.height,
    backgroundColor: node.fill === "transparent" ? "transparent" : node.fill,
    strokeColor: node.stroke,
    strokeStyle: node.strokeStyle ?? "solid",
    fillStyle: "solid",
    groupIds,
    // Survives id regeneration and autosave; lets MCP tools target "node n3 of this diagram" later.
    customData: { nodeId: node.id, diagramId },
    // Empty labels (decorative containers) must not create an empty text element.
    ...(node.label
      ? { label: { text: node.label, fontSize: node.fontSize ?? 16, strokeColor: getLabelColor(node.fill) } }
      : {}),
  }));

  // Edges referencing unknown nodes are dropped rather than failing the whole diagram.
  const edges: ExcalidrawElementSkeleton[] = spec.edges.flatMap((edge, index) => {
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    if (!from || !to) return [];

    // Routed polyline from the layout when available, otherwise a straight line between facing edge midpoints.
    const route = routes[index];
    const crossing = route ? null : getScreenCrossing(from, to, spec.nodes);
    const { start, end } = crossing ?? getEdgeEndpoints(from, to);
    const path = route ?? [start, end];
    const routeColor = crossing ? NAVIGATION_COLOR : getRouteColor(from);
    const first = path[0];
    const xs = path.map((point) => point.x);
    const ys = path.map((point) => point.y);

    return [
      {
        type: "arrow",
        x: origin.x + first.x,
        y: origin.y + first.y,
        // Excalidraw only records the binding; it doesn't resize the arrow, so give it real geometry.
        points: path.map((point) => [point.x - first.x, point.y - first.y]),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
        // A screen-to-screen arrow starts at the screen edge, so it is only bound at the target end.
        ...(crossing ? {} : { start: { id: from.id } }),
        end: { id: to.id },
        strokeStyle: edge.style ?? "solid",
        strokeColor: routeColor,
        strokeWidth: crossing ? 3 : 2,
        groupIds,
        endArrowhead: edge.arrowhead === "none" ? null : "arrow",
        ...(edge.label ? { label: { text: edge.label, fontSize: 14, strokeColor: routeColor } } : {}),
      } as ExcalidrawElementSkeleton,
    ];
  });

  const texts: ExcalidrawElementSkeleton[] = (spec.texts ?? []).map((item) => ({
    type: "text",
    text: item.text,
    x: origin.x + item.x,
    y: origin.y + item.y,
    fontSize: item.fontSize ?? 20,
    groupIds,
  }));

  // Backdrop first, then nodes (containers sit behind what follows); arrows and texts draw on top.
  return convertToExcalidrawElements([...buildBackdrop(spec, routes, origin, groupIds), ...nodes, ...edges, ...texts]);
};
