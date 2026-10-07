import { Graph, layout } from "@dagrejs/dagre";
import type { DiagramSpec } from "./diagram-schema";
import type { AiModeId } from "./prompts";

// Modes whose positions are computed here; the model only supplies nodes, sizes and edges.
// Mockups (web/mobile) are spatial layouts, so they keep the model's own coordinates.
const AUTO_LAYOUT_MODES: AiModeId[] = ["diagram", "flowchart", "architecture"];

// Whether this mode's diagram is laid out automatically.
export const usesAutoLayout = (mode: AiModeId) => AUTO_LAYOUT_MODES.includes(mode);

// Points of one routed edge, in diagram coordinates (first = leaves the source, last = enters the target).
export type EdgeRoute = { x: number; y: number }[];

// Gaps between nodes in the same row, and between rows.
const NODE_GAP = 70;
const RANK_GAP = 90;
// Approximate size of an edge label so the layout leaves room for it.
const LABEL_CHAR_WIDTH = 8;
const LABEL_HEIGHT = 24;
// Space left between the diagram and any free-floating text placed under it.
const TEXT_GAP = 40;

// Decorative containers (empty label, transparent fill) can't be laid out as graph nodes, so they are dropped.
const isContainer = (node: DiagramSpec["nodes"][number]) => !node.label.trim() && node.fill === "transparent";

// Positions nodes in layers with dagre (no overlaps, edges routed around nodes) and returns the new spec plus a
// polyline route per edge, keyed by the edge's index in `spec.edges`. Origin of the result is (0, 0).
export const autoLayout = (spec: DiagramSpec, mode: AiModeId) => {
  const nodes = spec.nodes.filter((node) => !isContainer(node));
  const nodeIds = new Set(nodes.map((node) => node.id));

  const graph = new Graph({ multigraph: true });
  // Left-to-right reads better for wide architecture tiers; everything else flows top-down.
  graph.setGraph({
    rankdir: mode === "architecture" ? "LR" : "TB",
    nodesep: NODE_GAP,
    ranksep: RANK_GAP,
    marginx: 0,
    marginy: 0,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => graph.setNode(node.id, { width: node.width, height: node.height }));

  // Edges to unknown nodes are ignored; the index is kept so routes can be matched back to `spec.edges`.
  spec.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) return;
    graph.setEdge(
      edge.from,
      edge.to,
      edge.label
        ? { width: edge.label.length * LABEL_CHAR_WIDTH + 16, height: LABEL_HEIGHT, labelpos: "c" }
        : {},
      String(index),
    );
  });

  layout(graph);

  // dagre reports node centres; Excalidraw wants top-left corners.
  const placed = nodes.map((node) => {
    const { x, y } = graph.node(node.id);
    return { ...node, x: x - node.width / 2, y: y - node.height / 2 };
  });

  const routes: Record<number, EdgeRoute> = {};
  spec.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) return;
    const points = graph.edge(edge.from, edge.to, String(index))?.points;
    if (points && points.length >= 2) routes[index] = points.map(({ x, y }: { x: number; y: number }) => ({ x, y }));
  });

  // Free-floating texts have no meaningful position any more; stack them under the diagram (legend / notes).
  const bottom = Math.max(0, ...placed.map((node) => node.y + node.height));
  const left = Math.min(0, ...placed.map((node) => node.x));
  const texts = (spec.texts ?? []).map((item, index) => ({
    ...item,
    x: left,
    y: bottom + TEXT_GAP + index * ((item.fontSize ?? 20) + 8),
  }));

  return { spec: { ...spec, nodes: placed, texts }, routes };
};
