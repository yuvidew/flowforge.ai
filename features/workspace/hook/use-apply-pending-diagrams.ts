import { useEffect, useRef, useState } from "react"
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"

import { diagramToElements } from "../ai/diagram-to-elements"
import { findEmptyOrigin, insertDiagram } from "../ai/scene"
import { useAckPendingDiagrams } from "./use-ack-pending-diagrams"
import { usePendingDiagrams } from "./use-pending-diagrams"

// Draws diagrams queued by the MCP server onto the open canvas.
// `onDrawn` receives the ids now on the canvas; the caller sends them with the next autosave, so a diagram only
// leaves the server queue once the scene containing it is saved. Diagrams that can't be drawn are cleared right away.
export const useApplyPendingDiagrams = (
    projectId: string,
    excalidrawApi: ExcalidrawImperativeAPI | null,
    onDrawn: (ids: string[]) => void,
) => {
    const { data } = usePendingDiagrams(projectId)
    const { mutate: ack } = useAckPendingDiagrams()
    // Ids already handled this session; polling keeps returning them until the autosave clears them server-side.
    const handled = useRef(new Set<string>())
    // True while a batch is drawing, so two effect runs never place diagrams at the same origin.
    const running = useRef(false)
    // Bumped when a batch ends so diagrams that arrived mid-run are picked up without waiting for a new poll result.
    const [round, setRound] = useState(0)

    useEffect(() => {
        const queue = data?.pending.filter((item) => !handled.current.has(item.id)) ?? []
        if (!excalidrawApi || queue.length === 0 || running.current) return

        running.current = true

        const drawAll = async () => {
            const drawn: string[] = []
            const failed: string[] = []

            // Sequential on purpose: each diagram is placed to the right of the previous one.
            for (const item of queue) {
                try {
                    const origin = await findEmptyOrigin(excalidrawApi)
                    const elements = await diagramToElements(item.spec, origin, item.mode)
                    await insertDiagram(excalidrawApi, elements)
                    drawn.push(item.id)
                } catch (error) {
                    console.error("Couldn't draw a queued diagram", item.id, error)
                    failed.push(item.id)
                }
                handled.current.add(item.id)
            }

            if (drawn.length > 0) onDrawn(drawn)
            // A spec that can't be drawn is not in the scene, so no save will clear it; remove it now or it is retried forever.
            if (failed.length > 0) ack({ projectId, ids: failed })
        }

        drawAll().finally(() => {
            running.current = false
            setRound((value) => value + 1)
        })
    }, [data, excalidrawApi, projectId, ack, onDrawn, round])
}
