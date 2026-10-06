import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import "@excalidraw/excalidraw/index.css";
import { useTheme } from "next-themes";
import type { ExcalidrawImperativeAPI, ExcalidrawProps, ToolType } from "@excalidraw/excalidraw/types";

import { ErrorView } from "@/components/error-view";
import { LoadingView } from "@/components/loading-view";
import { useWhiteboard } from "../hook/use-whiteboard";
import { useSaveWhiteboard } from "../hook/use-save-whiteboard";
import {
  ArrowRightIcon,
  CircleIcon,
  DiamondIcon,
  EraserIcon,
  HandIcon,
  ImageIcon,
  LockIcon,
  LockOpenIcon,
  MinusIcon,
  MousePointer2Icon,
  PencilIcon,
  SquareIcon,
  TypeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingBox, type ElementPatch } from "./workspace-floating-box";
import { WorkspaceAiFloatingSidebar } from "./workspace-ai-floating-sidebar";
import { isLoadingElement } from "../ai/loading-card";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
  },
);

// Custom toolbar entries, in the same order as Excalidraw's own toolbar; `name` is the tool type each button
// activates and `shortcut` is the number key Excalidraw binds to it.
const tools: { name: ToolType; label: string; icon: typeof HandIcon; shortcut?: string }[] = [
  { name: "hand", label: "Hand", icon: HandIcon },
  { name: "selection", label: "Select", icon: MousePointer2Icon, shortcut: "1" },
  { name: "rectangle", label: "Rectangle", icon: SquareIcon, shortcut: "2" },
  { name: "diamond", label: "Diamond", icon: DiamondIcon, shortcut: "3" },
  { name: "ellipse", label: "Ellipse", icon: CircleIcon, shortcut: "4" },
  { name: "arrow", label: "Arrow", icon: ArrowRightIcon, shortcut: "5" },
  { name: "line", label: "Line", icon: MinusIcon, shortcut: "6" },
  { name: "freedraw", label: "Draw", icon: PencilIcon, shortcut: "7" },
  { name: "text", label: "Text", icon: TypeIcon, shortcut: "8" },
  { name: "image", label: "Image", icon: ImageIcon, shortcut: "9" },
  { name: "eraser", label: "Eraser", icon: EraserIcon, shortcut: "0" },
];

// Text-element fields the toolbar needs.
type TextProps = { text: string; fontSize: number; fontFamily: number; lineHeight: number };

// CSS family names for Excalidraw's numeric font ids (5 = Excalifont/hand, 6 = Nunito/normal, 3 = Cascadia/mono).
const FONT_FAMILIES: Record<number, string> = { 3: "Cascadia", 5: "Excalifont", 6: "Nunito" };

// Measures multi-line text with a canvas so the element's box matches the new font after a scene update.
const measureText = (text: string, fontSize: number, fontFamily: number, lineHeight: number) => {
  const ctx = document.createElement("canvas").getContext("2d");
  const lines = text.split("\n");
  if (ctx) ctx.font = `${fontSize}px ${FONT_FAMILIES[fontFamily] ?? "sans-serif"}`;
  const width = Math.max(...lines.map((line) => ctx?.measureText(line).width ?? line.length * fontSize * 0.6));
  return { width, height: lines.length * fontSize * lineHeight };
};

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
  // Excalidraw's imperative API, used to switch tools from the custom toolbar.
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null);
  // Mirrors Excalidraw's active tool so the toolbar highlight follows keyboard shortcuts too.
  const [activeTool, setActiveTool] = useState<ToolType>("selection");
  // Whether the active tool stays selected after drawing one shape (Excalidraw's "keep tool active" lock).
  const [toolLocked, setToolLocked] = useState(false);

  // The single selected element (null when none or several are selected), e.g. for a properties panel.
  const [selectedElement, setSelectedElement] = useState<Parameters<OnChange>[0][number] | null>(null);
  // Latest Excalidraw appState snapshot.
  const [canvasState, setCanvasState] = useState<Parameters<OnChange>[1] | null>(null);

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
    setActiveTool(appState.activeTool.type as ToolType);
    setToolLocked(appState.activeTool.locked);

    setCanvasState(appState);

    // Track the selected element only when exactly one is selected.
    const selectedIds = Object.keys(appState.selectedElementIds || {});
    setSelectedElement(
      selectedIds.length === 1 ? (elements.find((el) => el.id === selectedIds[0]) ?? null) : null,
    );

    // The temporary "Generating with AI" card must never be saved (or trigger a save while it pulses).
    const persisted = elements.filter((el) => !isLoadingElement(el.id));
    const signature = getSceneSignature(persisted, files);
    if (signature === lastSignature.current) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);

    saveTimeout.current = setTimeout(() => {
      lastSignature.current = signature;
      save({
        projectId,
        elements: persisted,
        appState: pickSavedAppState(appState),
        files,
      });
    }, SAVE_DEBOUNCE_MS);
  };

  // Applies a property patch to the selected element. Bumps version/versionNonce (as Excalidraw does internally)
  // so the canvas re-renders and autosave sees the change.
  const updateSelectedElement = (patch: ElementPatch) => {
    if (!excalidrawApi || !selectedElement) return;

    const next: Record<string, unknown> = { ...patch };
    // Excalidraw doesn't re-measure text for scene updates, so re-measure when the font changes.
    if ((patch.fontSize || patch.fontFamily) && selectedElement.type === "text") {
      const text = selectedElement as unknown as TextProps;
      Object.assign(
        next,
        measureText(text.text, patch.fontSize ?? text.fontSize, patch.fontFamily ?? text.fontFamily, text.lineHeight),
      );
    }

    excalidrawApi.updateScene({
      elements: excalidrawApi.getSceneElements().map((el) =>
        el.id === selectedElement.id
          ? ({
              ...el,
              ...next,
              version: el.version + 1,
              versionNonce: Math.floor(Math.random() * 2 ** 31),
              updated: Date.now(),
            } as typeof el)
          : el,
      ),
    });
  };

  // Pushes a rebuilt element list to the canvas and (optionally) selects one element afterwards.
  const mutateScene = (
    build: (elements: readonly { id: string; version: number }[]) => unknown[],
    selectedId?: string,
  ) => {
    if (!excalidrawApi) return;
    excalidrawApi.updateScene({
      elements: build(excalidrawApi.getSceneElements()) as never,
      appState: { selectedElementIds: selectedId ? { [selectedId]: true } : {} } as never,
    });
  };

  // Returns a copy of an element with the version fields Excalidraw needs bumped.
  const bump = <T extends { version: number }>(el: T) => ({
    ...el,
    version: el.version + 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    updated: Date.now(),
  });

  // Clones the selected element, offset slightly, and selects the copy.
  const duplicateSelected = () => {
    if (!selectedElement) return;
    const copyId = crypto.randomUUID();
    mutateScene(
      (elements) => [
        ...elements,
        {
          ...selectedElement,
          id: copyId,
          x: selectedElement.x + 16,
          y: selectedElement.y + 16,
          seed: Math.floor(Math.random() * 2 ** 31),
          version: 1,
          versionNonce: Math.floor(Math.random() * 2 ** 31),
          // The copy isn't attached to the original's container or arrows.
          boundElements: null,
          containerId: null,
        },
      ],
      copyId,
    );
  };

  // Locks the selected element; Excalidraw deselects locked elements, so the bar disappears.
  const lockSelected = () => {
    if (!selectedElement) return;
    mutateScene((elements) =>
      elements.map((el) => (el.id === selectedElement.id ? { ...bump(el), locked: true } : el)),
    );
  };

  // Moves the selected element to the top (end of the array) or bottom (start) of the z-order.
  const reorderSelected = (toFront: boolean) => {
    if (!selectedElement) return;
    mutateScene((elements) => {
      const target = elements.find((el) => el.id === selectedElement.id);
      if (!target) return [...elements];
      const rest = elements.filter((el) => el.id !== selectedElement.id);
      return toFront ? [...rest, bump(target)] : [bump(target), ...rest];
    }, selectedElement.id);
  };

  // Soft-deletes the selected element (Excalidraw keeps deleted elements in the scene).
  const deleteSelected = () => {
    if (!selectedElement) return;
    mutateScene((elements) =>
      elements.map((el) => (el.id === selectedElement.id ? { ...bump(el), isDeleted: true } : el)),
    );
  };

  // Activates a tool on the canvas; the highlight updates via onChange.
  const changeTool = (tool: ToolType) => {
    if (!excalidrawApi) return;
    excalidrawApi.setActiveTool({ type: tool, locked: toolLocked });
  };



  // The status views center themselves via h-full, so they need a parent with the canvas' height.
  if (isPending || isError) {
    return (
      <div className="flex min-h-0 flex-1">
        {isPending ? (
          <LoadingView message="Loading whiteboard..." />
        ) : (
          <ErrorView message="Error loading whiteboard" />
        )}
      </div>
    );
  }

  return (
    <div className="flowforge-whiteboard relative min-h-0 flex-1">
      <Excalidraw
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        initialData={{
          elements: data.elements as never,
          appState: data.appState as never,
          files: data.files as never,
        }}
        excalidrawAPI={setExcalidrawApi}
        onChange={handleCanvasChange}
      />

      <FloatingBox
        selectedElement={selectedElement}
        canvasState={canvasState}
        onChange={updateSelectedElement}
        onDuplicate={duplicateSelected}
        onToggleLock={lockSelected}
        onDelete={deleteSelected}
        onBringFront={() => reorderSelected(true)}
        onSendBack={() => reorderSelected(false)}
      />

      <div className="absolute left-4 top-1/2 z-50 -translate-y-1/2 flex flex-col gap-1 rounded-3xl bg-white dark:bg-accent border p-1.5 shadow-xl">
        {tools.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.name}
              type="button"
              aria-label={item.label}
              aria-pressed={activeTool === item.name}
              title={item.shortcut ? `${item.label} — ${item.shortcut}` : item.label}
              className={cn("relative flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-primary/20", activeTool === item.name && "bg-primary/20")}
              onClick={() => changeTool(item.name)}
            >
              <Icon size={16} />
              {item.shortcut && (
                <span className="absolute bottom-0.5 right-1.5 text-[9px] text-muted-foreground">{item.shortcut}</span>
              )}
            </button>
          );
        })}
      </div>

      <WorkspaceAiFloatingSidebar excalidrawApi={excalidrawApi} />
    </div>
  );
};
