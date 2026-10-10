import { SavedElement } from "../types/types";

// Max elements sent to an AI; a bigger board is cut off so the request/reply stays small.
const MAX_SCENE_ELEMENTS = 300;



// Turns Excalidraw elements into a compact scene for an AI: no deleted elements, and the text inside a shape or
// arrow merged into that shape as `text`. Pure (no database, no browser), so the server and the canvas share it.
export const summarizeScene = (saved: readonly SavedElement[]) => {
    const live = saved.filter((ele) => !ele.isDeleted);

    // Excalidraw stores a shape's label as a separate text element pointing at the shape via containerId.
    const labels = new Map<string, string>();
    live.forEach((ele) => {
        if (ele.type === "text" && ele.containerId && ele.text) {
            labels.set(ele.containerId, ele.text)
        }
    });

    const elements = live
        // Those label texts are merged into their shape below, so skip them as separate items.
        .filter((element) => !(element.type === "text" && element.containerId))
        .map((element) => ({
            id: element.id,
            nodeId: element.customData?.nodeId ?? null,
            diagramId: element.customData?.diagramId ?? null,
            type: element.type,
            x: Math.round(element.x),
            y: Math.round(element.y),
            width: Math.round(element.width),
            height: Math.round(element.height),
            text: element.type === "text" ? element.text : labels.get(element.id),
            fill: element.backgroundColor,
            stroke: element.strokeColor,
            // Only arrows have these: which shapes they connect.
            from: element.startBinding?.elementId,
            to: element.endBinding?.elementId,
        }));

    return {
        total: elements.length,
        truncated: elements.length > MAX_SCENE_ELEMENTS,
        elements: elements.slice(0, MAX_SCENE_ELEMENTS),
    };


}
