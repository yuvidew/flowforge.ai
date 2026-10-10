import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { EditOp } from "../types/types";

// An element as the scene returns it (ordered, not deleted); the text variant is picked out of this union below.
type SceneElement = ReturnType<ExcalidrawImperativeAPI["getSceneElements"]>[number];

// Applies queued edits to the open canvas as one undoable step. Returns false when no edit found its shape
// (e.g. the shape was deleted or has no ids), so the caller can clear the item from the queue.
export const applyEdits = async (api: ExcalidrawImperativeAPI, ops: EditOp[]) => {
    const { newElementWith, CaptureUpdateAction } = await import("@excalidraw/excalidraw");
    const elements = api.getSceneElements();
    // Replacement per element id; everything not listed stays untouched.
    const changed = new Map<string, (typeof elements)[number]>();
    let applied = 0;

    for (const op of ops) {
        // Look at the latest version of the element (an earlier op in this batch may have changed it).
        const current = (id: string) => changed.get(id) ?? elements.find((el) => el.id === id);

        const shape = elements.find(
            (el) => !el.isDeleted && el.customData?.nodeId === op.nodeId && el.customData?.diagramId === op.diagramId,
        );
        if (!shape) continue;

        // A shape's label is a separate text element that points back at the shape through containerId.
        const label = elements.find((el) => el.type === "text" && el.containerId === shape.id && !el.isDeleted);

        if (op.op === "update_text" && label) {
            changed.set(label.id, newElementWith(current(label.id) as Extract<SceneElement, { type: "text" }>, { text: op.text, originalText: op.text }));
            applied++;
        }

        if (op.op === "set_color") {
            changed.set(shape.id, newElementWith(current(shape.id)!, {
                backgroundColor: op.fill ?? shape.backgroundColor,
                strokeColor: op.stroke ?? shape.strokeColor,
            }));
            applied++;
        }

        if (op.op === "delete") {
            // The shape, its label, the arrows touching it and those arrows' labels all go.
            const arrows = elements.filter(
                (el) => el.type === "arrow" && (el.startBinding?.elementId === shape.id || el.endBinding?.elementId === shape.id),
            );
            const doomed = new Set([shape.id, label?.id, ...arrows.map((arrow) => arrow.id)]);
            elements.forEach((el) => {
                if (doomed.has(el.id) || (el.type === "text" && el.containerId && doomed.has(el.containerId))) {
                    changed.set(el.id, newElementWith(current(el.id)!, { isDeleted: true }));
                }
            });
            applied++;
        }
    }

    if (applied === 0) return false;

    api.updateScene({
        elements: elements.map((el) => changed.get(el.id) ?? el),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    return true;

}