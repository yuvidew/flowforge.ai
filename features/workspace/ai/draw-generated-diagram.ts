import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { DiagramSpec } from "./diagram-schema";
import { diagramToElements } from "./diagram-to-elements";
import type { AiModeId } from "./prompts";
import { findEmptyOrigin, hideLoadingCard, insertDiagram, showLoadingCard, startLoadingPulse } from "./scene";

// Shows the loading card in empty canvas space, asks `generate` for the diagram, then swaps the card for the result.
// `generate` is passed in so this file stays free of API calls. Returns the diagram's title.
export const drawGeneratedDiagram = async (
    api: ExcalidrawImperativeAPI,
    mode: AiModeId,
    generate: () => Promise<DiagramSpec>
) => {
    const origin = await findEmptyOrigin(api);
    await showLoadingCard(api, origin);
    const stopPulse = await startLoadingPulse(api);

    try {
        const spec = await generate();
        const elements = await diagramToElements(spec, origin, mode);
        stopPulse();
        await hideLoadingCard(api);
        await insertDiagram(api, elements);

        return spec.title;
    } catch (error) {
        // On failure the card must still go away; hiding twice on success is harmless (it filters by id).
        stopPulse();
        await hideLoadingCard(api);
        // Rethrown so the caller (the mutation) reports the failure instead of announcing a diagram that was never drawn.
        throw error;
    }
}