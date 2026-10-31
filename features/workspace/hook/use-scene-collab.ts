import { useCallback, useEffect, useRef } from "react"
import type { Json } from "@liveblocks/client"
import { useBroadcastEvent, useEventListener, useUpdateMyPresence } from "@liveblocks/react"
import type { ExcalidrawImperativeAPI, ExcalidrawProps } from "@excalidraw/excalidraw/types"

import { isLoadingElement } from "../ai/loading-card"

// The few element fields the sync logic reads; everything else stays opaque.
type SyncElement = { id: string; version: number; type: string; fileId?: string | null }
type BinaryFiles = Record<string, unknown>

// Local changes are batched for this long before being broadcast, so a drag sends ~16 updates/s instead of one per frame.
const BROADCAST_THROTTLE_MS = 60
// Images bigger than this are not pushed over the socket; peers get them from the next autosave instead.
const MAX_FILE_BYTES = 400_000
// Keeps each broadcast comfortably below Liveblocks' message size limit.
const MAX_CHUNK_BYTES = 200_000

// Splits elements into batches of roughly MAX_CHUNK_BYTES each.
const chunkElements = (elements: SyncElement[]) => {
    const chunks: SyncElement[][] = []
    let current: SyncElement[] = []
    let size = 0

    for (const element of elements) {
        const elementSize = JSON.stringify(element).length
        if (current.length > 0 && size + elementSize > MAX_CHUNK_BYTES) {
            chunks.push(current)
            current = []
            size = 0
        }
        current.push(element)
        size += elementSize
    }
    if (current.length > 0) chunks.push(current)

    return chunks
}

/**
 * Real-time canvas sync for one board over Liveblocks. Local element changes are broadcast (throttled) and incoming
 * ones are reconciled into the canvas by Excalidraw's version rules, so concurrent edits merge instead of overwriting.
 * Persistence stays with the existing autosave; this hook only reports whether a canvas change is a *local* one.
 */
export const useSceneCollab = (
    api: ExcalidrawImperativeAPI | null,
    onRemoteSaved: (version: number) => void,
    onRemoteChange: () => void,
) => {
    const broadcast = useBroadcastEvent()
    const updateMyPresence = useUpdateMyPresence()

    // element id -> version every peer is known to have (loaded from the server, sent by us, or received from a peer).
    // An element whose version differs from this map is a local change that still has to be broadcast.
    const synced = useRef(new Map<string, number>())
    // Image file ids already pushed to peers, so each image travels once.
    const sentFileIds = useRef(new Set<string>())
    // Latest canvas snapshot waiting for the throttle timer to fire.
    const pending = useRef<{ elements: readonly SyncElement[]; files: BinaryFiles } | null>(null)
    const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Last selection pushed to presence (as a string) so unchanged selections cost nothing.
    const lastSelection = useRef("")
    // Excalidraw's runtime helpers, loaded once so applying a remote update is synchronous and keeps event order.
    const lib = useRef<typeof import("@excalidraw/excalidraw") | null>(null)
    const apiRef = useRef(api)
    apiRef.current = api
    const onRemoteSavedRef = useRef(onRemoteSaved)
    onRemoteSavedRef.current = onRemoteSaved
    const onRemoteChangeRef = useRef(onRemoteChange)
    onRemoteChangeRef.current = onRemoteChange

    useEffect(() => {
        void import("@excalidraw/excalidraw").then((module) => {
            lib.current = module
        })
        return () => {
            if (flushTimer.current) clearTimeout(flushTimer.current)
        }
    }, [])

    // Pushes elements to peers in size-limited chunks, attaching image files that peers haven't received yet.
    const send = useCallback(
        (elements: SyncElement[], files: BinaryFiles) => {
            for (const chunk of chunkElements(elements)) {
                const chunkFiles: BinaryFiles = {}
                for (const element of chunk) {
                    const fileId = element.type === "image" ? element.fileId : null
                    if (!fileId || sentFileIds.current.has(fileId) || !files[fileId]) continue
                    if (JSON.stringify(files[fileId]).length > MAX_FILE_BYTES) continue
                    chunkFiles[fileId] = files[fileId]
                    sentFileIds.current.add(fileId)
                }
                // Excalidraw elements/files are plain JSON, which Liveblocks' types can't see through our opaque types.
                broadcast({
                    type: "scene-update",
                    elements: chunk as unknown as Json[],
                    files: Object.keys(chunkFiles).length > 0 ? (chunkFiles as { [fileId: string]: Json }) : undefined,
                })
            }
        },
        [broadcast],
    )

    // Broadcasts whatever changed since the last flush and records it as synced.
    const flush = useCallback(() => {
        flushTimer.current = null
        const snapshot = pending.current
        pending.current = null
        if (!snapshot) return

        const changed = snapshot.elements.filter((element) => synced.current.get(element.id) !== element.version)
        if (changed.length === 0) return

        for (const element of changed) synced.current.set(element.id, element.version)
        send(changed, snapshot.files)
    }, [send])

    // Sends the whole scene; used to bring a peer who just opened the board up to date.
    const sendWholeScene = useCallback(() => {
        const current = apiRef.current
        if (!current) return
        // The temporary "Generating with AI" card exists only on this machine.
        const elements = current.getSceneElementsIncludingDeleted().filter((element) => !isLoadingElement(element.id))
        send(elements as unknown as SyncElement[], current.getFiles())
    }, [send])

    // Merges a peer's elements into the canvas without adding to the undo stack.
    const applyRemote = useCallback((elements: SyncElement[], files?: BinaryFiles) => {
        const current = apiRef.current
        const excalidraw = lib.current
        if (!current || !excalidraw) return

        if (files) current.addFiles(Object.values(files) as never)

        const merged = excalidraw.reconcileElements(
            current.getSceneElementsIncludingDeleted() as never,
            elements as never,
            current.getAppState(),
        )
        // Record what the peer has, so the resulting onChange isn't mistaken for a local edit and re-broadcast.
        for (const element of elements) synced.current.set(element.id, element.version)

        current.updateScene({ elements: merged, captureUpdate: excalidraw.CaptureUpdateAction.NEVER })
        onRemoteChangeRef.current()
    }, [])

    useEventListener(({ event }) => {
        if (event.type === "scene-update") applyRemote(event.elements as SyncElement[], event.files)
        else if (event.type === "scene-saved") onRemoteSavedRef.current(event.version)
        else if (event.type === "scene-request") sendWholeScene()
    })

    // Once the canvas is ready, ask whoever is already online for their live scene: the saved copy we loaded from
    // the server can be a moment behind. Queued if the socket isn't open yet.
    useEffect(() => {
        if (api) broadcast({ type: "scene-request" }, { shouldQueueEventIfNotReady: true })
    }, [api, broadcast])

    // Marks elements as already known to peers (e.g. the scene just loaded from the server).
    const markSynced = useCallback((elements: readonly SyncElement[]) => {
        for (const element of elements) synced.current.set(element.id, element.version)
    }, [])

    // Call from Excalidraw's onChange. Returns true when the scene contains edits made on this machine (and queues
    // them for broadcast); false for remote updates and pointer/selection-only changes.
    const trackChanges = useCallback(
        (elements: readonly SyncElement[], files: BinaryFiles, selectedElementIds: Record<string, true>) => {
            const selection = Object.keys(selectedElementIds).sort().join(",")
            if (selection !== lastSelection.current) {
                lastSelection.current = selection
                updateMyPresence({ selectedElementIds })
            }

            if (!elements.some((element) => synced.current.get(element.id) !== element.version)) return false

            pending.current = { elements, files }
            if (!flushTimer.current) flushTimer.current = setTimeout(flush, BROADCAST_THROTTLE_MS)
            return true
        },
        [flush, updateMyPresence],
    )

    // Shares the cursor position so peers see this person's named cursor.
    const onPointerUpdate = useCallback<NonNullable<ExcalidrawProps["onPointerUpdate"]>>(
        ({ pointer, button }) => updateMyPresence({ pointer, button }),
        [updateMyPresence],
    )

    // Tells peers the board was saved at this version so their next save doesn't conflict.
    const announceSaved = useCallback((version: number) => broadcast({ type: "scene-saved", version }), [broadcast])

    return { trackChanges, markSynced, onPointerUpdate, announceSaved }
}
