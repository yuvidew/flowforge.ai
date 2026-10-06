import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { Origin } from "./diagram-to-elements";

// Every loading-card element id starts with this, so the card can be found, pulsed, removed and kept out of autosave.
export const LOADING_ID_PREFIX = "ai-loading-";

// Size of the loading card; also used to reserve the spot where the diagram will land.
export const LOADING_CARD_SIZE = { width: 420, height: 200 };

// Ids of the skeleton bars, which the pulse animation fades in and out.
export const LOADING_BAR_IDS = [`${LOADING_ID_PREFIX}bar-1`, `${LOADING_ID_PREFIX}bar-2`, `${LOADING_ID_PREFIX}bar-3`];

// Whether an element id belongs to the temporary loading card.
export const isLoadingElement = (id: string) => id.startsWith(LOADING_ID_PREFIX);

const VIOLET = "#8b5cf6";
const VIOLET_SOFT = "#f3efff";
const VIOLET_BAR = "#ddd6fe";

// Builds the "Generating with AI" placeholder (card, title, subtitle, skeleton bars) at `origin`.
// Convert with `convertToExcalidrawElements(..., { regenerateIds: false })` so the ids above stay stable.
export const buildLoadingCard = ({ x, y }: Origin): ExcalidrawElementSkeleton[] => {
  const base = { locked: true, strokeColor: VIOLET, fillStyle: "solid" } as const;

  return [
    {
      ...base,
      type: "rectangle",
      id: `${LOADING_ID_PREFIX}card`,
      x,
      y,
      ...LOADING_CARD_SIZE,
      backgroundColor: VIOLET_SOFT,
      roundness: { type: 3 },
    },
    {
      ...base,
      type: "text",
      id: `${LOADING_ID_PREFIX}title`,
      x: x + 24,
      y: y + 24,
      text: "✨ Generating with AI",
      fontSize: 24,
    },
    {
      ...base,
      type: "text",
      id: `${LOADING_ID_PREFIX}subtitle`,
      x: x + 24,
      y: y + 64,
      text: "Preparing your diagram...",
      fontSize: 16,
      strokeColor: "#6b5b95",
    },
    ...[280, 340, 180].map(
      (width, index): ExcalidrawElementSkeleton => ({
        ...base,
        type: "rectangle",
        id: LOADING_BAR_IDS[index],
        x: x + 24,
        y: y + 104 + index * 30,
        width,
        height: 20,
        backgroundColor: VIOLET_BAR,
      }),
    ),
  ];
};
