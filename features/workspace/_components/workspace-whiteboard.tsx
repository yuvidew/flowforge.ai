import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import "@excalidraw/excalidraw/index.css";
import { useTheme } from "next-themes";
import type { ExcalidrawProps } from "@excalidraw/excalidraw/types";

import { ErrorView } from "@/components/error-view";
import { LoadingView } from "@/components/loading-view";
import { useWhiteboard } from "../hook/use-whiteboard";
import { useSaveWhiteboard } from "../hook/use-save-whiteboard";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
  },
);

// Delay after the last canvas change before autosaving.
const SAVE_DEBOUNCE_MS = 1000;

type OnChange = NonNullable<ExcalidrawProps["onChange"]>;

// Cheap fingerprint of the scene, so pointer-only changes (selection, zoom) don't trigger a save.
const getSceneSignature = (
  elements: readonly { id: string; version: number }[],
  files: object,
) => `${elements.map((el) => `${el.id}:${el.version}`).join(",")}|${Object.keys(files).join(",")}`;

// Keeps only the serialisable appState we want to restore (the full object holds Maps/Sets and transient UI state).
const pickSavedAppState = (appState: Parameters<OnChange>[1]) => ({
  viewBackgroundColor: appState.viewBackgroundColor,
  gridSize: appState.gridSize,
});

/**
 * @component WorkspaceWhiteboard
 * @description Excalidraw canvas themed with the app's design tokens (see `.flowforge-whiteboard` in globals.css).
 * Loads the saved board for the project in the URL and autosaves changes (debounced).
 */
export const WorkspaceWhiteboard = () => {
  // resolvedTheme collapses "system" to light/dark, which is all Excalidraw accepts.
  const { resolvedTheme } = useTheme();
  const { id: projectId } = useParams<{ id: string }>();
  const { data, isPending, isError } = useWhiteboard(projectId);
  const { mutate: save } = useSaveWhiteboard();

  // Debounce timer id — cleared on unmount to avoid saving after leaving the page.
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Signature of the last saved/loaded scene; null until the board has loaded.
  const lastSignature = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  // Excalidraw fires onChange on mount, so seed the signature from the loaded board to skip that first call.
  if (data && lastSignature.current === null) {
    lastSignature.current = getSceneSignature(
      data.elements as { id: string; version: number }[],
      data.files,
    );
  }

  // Debounced autosave; only saves when the scene actually changed.
  const handleCanvasChange: OnChange = (elements, appState, files) => {
    const signature = getSceneSignature(elements, files);
    if (signature === lastSignature.current) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);

    saveTimeout.current = setTimeout(() => {
      lastSignature.current = signature;
      save({
        projectId,
        elements: [...elements],
        appState: pickSavedAppState(appState),
        files,
      });
    }, SAVE_DEBOUNCE_MS);
  };

  // The status views center themselves via h-full, so they need a parent with the canvas' height.
  if (isPending || isError) {
    return (
      <div className="flex" style={{ height: "90vh" }}>
        {isPending ? (
          <LoadingView message="Loading whiteboard..." />
        ) : (
          <ErrorView message="Error loading whiteboard" />
        )}
      </div>
    );
  }

  return (
    <div className="flowforge-whiteboard" style={{ height: "90vh" }}>
      <Excalidraw
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        initialData={{
          elements: data.elements as never,
          appState: data.appState as never,
          files: data.files as never,
        }}
        onChange={handleCanvasChange}
      />
    </div>
  );
};
