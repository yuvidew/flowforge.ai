import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { DiagramSpec } from "./diagram-schema";
import { diagramToElements, originForBackdrop } from "./diagram-to-elements";
import type { AiModeId } from "./prompts";
import { readDiagram } from "./read-diagram";
import { findEmptyOrigin, hideLoadingCard, showLoadingCard, startLoadingPulse } from "./scene";

// Swaps the elements of one diagram for new ones as a single undoable step (one Ctrl+Z brings the old diagram back).
const replaceDiagram = async (
  api: ExcalidrawImperativeAPI,
  diagramId: string,
  elements: ReturnType<ExcalidrawImperativeAPI["getSceneElements"]>,
) => {
  const { newElementWith, CaptureUpdateAction } = await import("@excalidraw/excalidraw");
  const scene = api.getSceneElements();

  // The diagram's own elements plus the text labels bound to them.
  const doomed = new Set(scene.filter((el) => !el.isDeleted && el.groupIds.includes(diagramId)).map((el) => el.id));
  scene.forEach((el) => {
    if (el.type === "text" && el.containerId && doomed.has(el.containerId)) doomed.add(el.id);
  });

  api.updateScene({
    elements: [...scene.map((el) => (doomed.has(el.id) ? newElementWith(el, { isDeleted: true }) : el)), ...elements],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.scrollToContent(elements, { fitToViewport: true, viewportZoomFactor: 0.8, animate: true });
};

// Re-draws an existing diagram with a change applied: reads it back from the canvas, asks `revise` for the updated
// spec, lays it out again and replaces the old diagram in the same place. A loading card shows while the AI works.
// `revise` is passed in so this file stays free of API calls. Returns false when the diagram is no longer on the board.
export const reviseDiagramOnCanvas = async (
  api: ExcalidrawImperativeAPI,
  diagramId: string,
  revise: (current: { mode: AiModeId; spec: DiagramSpec }) => Promise<DiagramSpec>,
) => {
  const current = await readDiagram(api, diagramId);
  if (!current) return false;

  // The card goes in free space (not over the diagram being revised); the diagram itself stays until the result is ready.
  await showLoadingCard(api, await findEmptyOrigin(api));
  const stopPulse = await startLoadingPulse(api);

  try {
    const spec = await revise({ mode: current.mode, spec: current.spec });
    const elements = await diagramToElements(
      spec,
      originForBackdrop(current.bounds.minX, current.bounds.minY),
      current.mode,
    );
    stopPulse();
    await hideLoadingCard(api);
    await replaceDiagram(api, diagramId, elements);

    return true;
  } catch (error) {
    stopPulse();
    await hideLoadingCard(api);
    throw error;
  }
};
