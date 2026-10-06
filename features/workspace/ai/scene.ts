import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { Origin } from "./diagram-to-elements";
import {
  buildLoadingCard,
  isLoadingElement,
  LOADING_BAR_IDS,
  LOADING_CARD_SIZE,
} from "./loading-card";

// Horizontal gap between existing content and a newly generated diagram.
const PLACEMENT_GAP = 120;
// How often the loading bars fade in/out.
const PULSE_INTERVAL_MS = 700;

// Elements that are really on the board (soft-deleted ones and the loading card don't count).
const getContentElements = (api: ExcalidrawImperativeAPI) =>
  api.getSceneElements().filter((el) => !el.isDeleted && !isLoadingElement(el.id));

// Picks the top-left for new content: right of everything on the board, or the middle of the view when it's empty.
export const findEmptyOrigin = async (
  api: ExcalidrawImperativeAPI,
  size = LOADING_CARD_SIZE,
): Promise<Origin> => {
  const { getCommonBounds } = await import("@excalidraw/excalidraw");
  const elements = getContentElements(api);

  if (elements.length === 0) {
    const { scrollX, scrollY, zoom, width, height } = api.getAppState();
    return {
      x: Math.round(width / 2 / zoom.value - scrollX - size.width / 2),
      y: Math.round(height / 2 / zoom.value - scrollY - size.height / 2),
    };
  }

  const [, minY, maxX] = getCommonBounds(elements);
  return { x: Math.round(maxX + PLACEMENT_GAP), y: Math.round(minY) };
};

// Adds the loading card at `origin` (not undoable, not saved) and brings it into view.
export const showLoadingCard = async (api: ExcalidrawImperativeAPI, origin: Origin) => {
  const { convertToExcalidrawElements, CaptureUpdateAction } = await import("@excalidraw/excalidraw");
  const card = convertToExcalidrawElements(buildLoadingCard(origin), { regenerateIds: false });

  api.updateScene({
    elements: [...api.getSceneElements(), ...card],
    captureUpdate: CaptureUpdateAction.NEVER,
  });
  api.scrollToContent(card, { fitToViewport: true, viewportZoomFactor: 0.5, animate: true });
};

// Fades the skeleton bars in and out so the card feels alive; returns a function that stops the animation.
export const startLoadingPulse = async (api: ExcalidrawImperativeAPI) => {
  const { CaptureUpdateAction } = await import("@excalidraw/excalidraw");
  let dim = false;

  const timer = setInterval(() => {
    dim = !dim;
    api.updateScene({
      elements: api.getSceneElements().map((el) =>
        LOADING_BAR_IDS.includes(el.id)
          ? ({ ...el, opacity: dim ? 45 : 100, version: el.version + 1, versionNonce: Math.floor(Math.random() * 2 ** 31) } as typeof el)
          : el,
      ),
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, PULSE_INTERVAL_MS);

  return () => clearInterval(timer);
};

// Removes the loading card from the scene entirely (filtered out, not soft-deleted).
export const hideLoadingCard = async (api: ExcalidrawImperativeAPI) => {
  const { CaptureUpdateAction } = await import("@excalidraw/excalidraw");
  api.updateScene({
    elements: api.getSceneElements().filter((el) => !isLoadingElement(el.id)),
    captureUpdate: CaptureUpdateAction.NEVER,
  });
};

// Adds generated elements as a single undoable step and scrolls them into view.
export const insertDiagram = async (
  api: ExcalidrawImperativeAPI,
  elements: ReturnType<ExcalidrawImperativeAPI["getSceneElements"]>,
) => {
  const { CaptureUpdateAction } = await import("@excalidraw/excalidraw");
  api.updateScene({
    elements: [...api.getSceneElements(), ...elements],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.scrollToContent(elements, { fitToViewport: true, viewportZoomFactor: 0.8, animate: true });
};
