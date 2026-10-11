import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import { generateNKeysBetween } from "fractional-indexing";

// An Excalidraw element as stored in the database. Only the fields the server reads are typed; the rest passes through.
export type SceneElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  index: string | null;
  version: number;
  versionNonce: number;
  updated: number;
  isDeleted: boolean;
  groupIds: string[];
  backgroundColor: string;
  strokeColor: string;
  boundElements: { id: string; type: "arrow" | "text" }[] | null;
  containerId?: string | null;
  text?: string;
  originalText?: string;
  fontSize?: number;
  startBinding?: { elementId: string; focus: number; gap: number } | null;
  endBinding?: { elementId: string; focus: number; gap: number } | null;
  customData?: Record<string, unknown>;
  [key: string]: unknown;
};

// What buildDiagramSkeleton produces: only the skeleton fields FlowForge actually uses.
type SkeletonItem = {
  type: string;
  id?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[][];
  text?: string;
  fontSize?: number;
  label?: { text: string; fontSize?: number; strokeColor?: string };
  start?: { id: string };
  end?: { id: string };
  endArrowhead?: string | null;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeStyle?: string;
  strokeWidth?: number;
  roundness?: { type: number } | null;
  groupIds?: string[];
  customData?: Record<string, unknown>;
};

// Text metrics are estimates (no canvas on the server). Keep these in sync with diagram-to-elements.ts, which sizes
// nodes with the same numbers, so wrapped labels fit their shapes.
const CHAR_WIDTH = 0.6;
const LINE_HEIGHT = 1.25;
const LABEL_PADDING = 24;
const SHAPE_TEXT_FACTOR: Record<string, number> = { rectangle: 1, ellipse: 1.45, diamond: 2 };
// 5 = Excalifont, Excalidraw's default hand-drawn font.
const FONT_FAMILY = 5;

// Random integer for seeds and versionNonce, same range Excalidraw uses.
export const randomInt = () => Math.floor(Math.random() * 2 ** 31);

// Returns a copy of an element with the change tracking Excalidraw needs (same effect as its newElementWith).
export const bump = (element: SceneElement, patch: Partial<SceneElement> = {}): SceneElement => ({
  ...element,
  ...patch,
  version: element.version + 1,
  versionNonce: randomInt(),
  updated: Date.now(),
});

// Greedy word wrap with the estimated glyph width; a word longer than the line stays on its own line.
const wrapText = (text: string, maxWidth: number, fontSize: number) =>
  text
    .split("\n")
    .flatMap((paragraph) => {
      const lines: string[] = [];
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && candidate.length * fontSize * CHAR_WIDTH > maxWidth) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      lines.push(current);
      return lines;
    })
    .join("\n");

// Estimated size of a block of text.
const measure = (text: string, fontSize: number) => {
  const lines = text.split("\n");
  return {
    width: Math.max(...lines.map((line) => line.length)) * fontSize * CHAR_WIDTH,
    height: lines.length * fontSize * LINE_HEIGHT,
  };
};

// Wraps `rawText` to fit inside a shape and centres it there; returns the text and its box. Also used when a label is edited.
export const fitLabelInShape = (
  shape: Pick<SceneElement, "type" | "x" | "y" | "width" | "height">,
  rawText: string,
  fontSize: number,
) => {
  const factor = SHAPE_TEXT_FACTOR[shape.type] ?? 1;
  const text = wrapText(rawText, (shape.width - LABEL_PADDING) / factor, fontSize);
  const { width, height } = measure(text, fontSize);
  return {
    text,
    width,
    height,
    x: shape.x + (shape.width - width) / 2,
    y: shape.y + (shape.height - height) / 2,
  };
};

// Fields every Excalidraw element has, with Excalidraw's own defaults.
const makeBase = (item: Partial<SkeletonItem>) => ({
  angle: 0,
  strokeColor: item.strokeColor ?? "#1e1e1e",
  backgroundColor: item.backgroundColor ?? "transparent",
  fillStyle: item.fillStyle ?? "solid",
  strokeWidth: item.strokeWidth ?? 2,
  strokeStyle: item.strokeStyle ?? "solid",
  roughness: 1,
  opacity: 100,
  roundness: item.roundness ?? null,
  groupIds: item.groupIds ?? [],
  frameId: null,
  index: null,
  seed: randomInt(),
  version: 1,
  versionNonce: randomInt(),
  isDeleted: false,
  boundElements: null,
  updated: Date.now(),
  link: null,
  locked: false,
  ...(item.customData ? { customData: item.customData } : {}),
});

type TextOptions = {
  text: string;
  originalText: string;
  fontSize: number;
  x: number;
  y: number;
  width: number;
  height: number;
  containerId: string | null;
  strokeColor?: string;
  groupIds?: string[];
};

// A text element: a shape/arrow label (centred, bound to its container) or a free-standing text.
const makeText = (o: TextOptions): SceneElement => ({
  ...makeBase({ strokeColor: o.strokeColor, groupIds: o.groupIds }),
  type: "text",
  id: crypto.randomUUID(),
  x: o.x,
  y: o.y,
  width: o.width,
  height: o.height,
  text: o.text,
  originalText: o.originalText,
  fontSize: o.fontSize,
  fontFamily: FONT_FAMILY,
  textAlign: o.containerId ? "center" : "left",
  verticalAlign: o.containerId ? "middle" : "top",
  containerId: o.containerId,
  autoResize: true,
  lineHeight: LINE_HEIGHT,
});

// Point halfway along a polyline, where an arrow's label sits.
const midpointOf = (points: number[][]) => {
  const lengths = points.slice(1).map((point, i) => Math.hypot(point[0] - points[i][0], point[1] - points[i][1]));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] === 0 ? 0 : remaining / lengths[i];
      return [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t];
    }
    remaining -= lengths[i];
  }
  return points[0];
};

// Server-side stand-in for Excalidraw's convertToExcalidrawElements, for the element types FlowForge diagrams use
// (rectangle, ellipse, diamond, arrow, text). Fresh ids are generated (so two diagrams never collide) and arrow
// bindings are remapped; customData.nodeId keeps the spec's own ids.
export const skeletonToElements = (skeleton: ExcalidrawElementSkeleton[]): SceneElement[] => {
  const items = skeleton as unknown as SkeletonItem[];
  const freshIds = new Map<string, string>();
  items.forEach((item) => {
    if (item.id) freshIds.set(item.id, crypto.randomUUID());
  });

  const out: SceneElement[] = [];
  const shapesById = new Map<string, SceneElement>();
  const arrows: { arrow: SceneElement; start?: string; end?: string }[] = [];

  const addBound = (element: SceneElement, ref: { id: string; type: "arrow" | "text" }) => {
    element.boundElements = [...(element.boundElements ?? []), ref];
  };

  for (const item of items) {
    if (item.type === "text") {
      const text = item.text ?? "";
      const fontSize = item.fontSize ?? 20;
      out.push(
        makeText({ ...measure(text, fontSize), text, originalText: text, fontSize, x: item.x, y: item.y, containerId: null, strokeColor: item.strokeColor, groupIds: item.groupIds }),
      );
      continue;
    }

    if (item.type === "arrow") {
      const points = item.points ?? [[0, 0], [item.width ?? 0, item.height ?? 0]];
      const arrow: SceneElement = {
        ...makeBase(item),
        type: "arrow",
        id: (item.id && freshIds.get(item.id)) || crypto.randomUUID(),
        x: item.x,
        y: item.y,
        width: item.width ?? 0,
        height: item.height ?? 0,
        points,
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: item.endArrowhead === undefined ? "arrow" : item.endArrowhead,
        elbowed: false,
      };
      out.push(arrow);
      arrows.push({ arrow, start: item.start?.id, end: item.end?.id });

      if (item.label?.text) {
        const fontSize = item.label.fontSize ?? 20;
        const { width, height } = measure(item.label.text, fontSize);
        const [mx, my] = midpointOf(points);
        const label = makeText({
          text: item.label.text,
          originalText: item.label.text,
          fontSize,
          width,
          height,
          x: arrow.x + mx - width / 2,
          y: arrow.y + my - height / 2,
          containerId: arrow.id,
          strokeColor: item.label.strokeColor ?? item.strokeColor,
          groupIds: item.groupIds,
        });
        addBound(arrow, { id: label.id, type: "text" });
        out.push(label);
      }
      continue;
    }

    // rectangle / ellipse / diamond
    const shape: SceneElement = {
      ...makeBase(item),
      type: item.type,
      id: (item.id && freshIds.get(item.id)) || crypto.randomUUID(),
      x: item.x,
      y: item.y,
      width: item.width ?? 0,
      height: item.height ?? 0,
    };
    out.push(shape);
    shapesById.set(shape.id, shape);

    if (item.label?.text) {
      const fontSize = item.label.fontSize ?? 20;
      const fit = fitLabelInShape(shape, item.label.text, fontSize);
      const label = makeText({
        ...fit,
        originalText: item.label.text,
        fontSize,
        containerId: shape.id,
        strokeColor: item.label.strokeColor ?? item.strokeColor,
        groupIds: item.groupIds,
      });
      addBound(shape, { id: label.id, type: "text" });
      out.push(label);
    }
  }

  // Bind arrows to their shapes once every shape exists, so the order of the skeleton doesn't matter.
  arrows.forEach(({ arrow, start, end }) => {
    const link = (key: "startBinding" | "endBinding", ref?: string) => {
      const target = ref ? shapesById.get(freshIds.get(ref) ?? "") : undefined;
      if (!target) return;
      arrow[key] = { elementId: target.id, focus: 0, gap: 1 };
      addBound(target, { id: arrow.id, type: "arrow" });
    };
    link("startBinding", start);
    link("endBinding", end);
  });

  return out;
};

// Appends new elements after the existing ones, giving them fractional indices that sort after the last one.
export const appendElements = (existing: SceneElement[], created: SceneElement[]) => {
  const last = [...existing].reverse().find((element) => typeof element.index === "string")?.index ?? null;
  const keys = generateNKeysBetween(last, null, created.length);
  return [...existing, ...created.map((element, i) => ({ ...element, index: keys[i] }))];
};
