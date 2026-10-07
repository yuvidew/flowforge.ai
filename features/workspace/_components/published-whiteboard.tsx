"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useTheme } from "next-themes";
import "@excalidraw/excalidraw/index.css";

import { ErrorView } from "@/components/error-view";
import { Logo } from "@/components/logo";
import { LoadingView } from "@/components/loading-view";
import { Badge } from "@/components/ui/badge";
import { usePublicWhiteboard } from "../hook/use-public-whiteboard";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false },
);

/**
 * @component PublishedWhiteboard
 * @description Public, read-only view of a published board (`/view/[id]`). Shows a loading state, an "isn't available" state for unpublished/unknown boards, and otherwise the board in Excalidraw's view mode.
 */
export const PublishedWhiteboard = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { resolvedTheme } = useTheme();
  const { data, isPending, isError } = usePublicWhiteboard(projectId);

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
    <div className="flex h-dvh flex-col">
      <header className="p-3 border-b flex items-center gap-2">
        <Logo />
        <h2>{data.projectName}</h2>
      </header>

      <div className="flowforge-whiteboard relative min-h-0 flex-1">
        <Excalidraw
          viewModeEnabled
          zenModeEnabled
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          initialData={{
            elements: data.elements as never,
            appState: data.appState as never,
            files: data.files as never,
          }}
        />
      </div>
    </div>
  );
};
