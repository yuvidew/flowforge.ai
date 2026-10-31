"use client";

import { ErrorView } from "@/components/error-view";
import { LoadingView } from "@/components/loading-view";
import { ReactNode } from "react";
import { useParams } from "next/navigation";
import { WorkspaceCollabProvider } from "./workspace-collab-provider";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceWhiteboard } from "./workspace-whiteboard";

/**
 * @component WorkspaceLoading
 * @description Suspense fallback shown while the files list is loading.
 */
export const WorkspaceLoading = () => {
  return <LoadingView message="Loading workflows..." />;
};

/**
 * @component WorkspaceError
 * @description Fallback shown by the error boundary when loading the files list fails.
 */
export const WorkspaceError = () => {
  return <ErrorView message="Error loading workflows" />;
};

/**
 * @component WorkSpace
 * @description The board editor: header plus canvas, both inside the board's real-time room so presence and canvas edits are shared with everyone else on the board.
 */
export const WorkSpace = () => {
  const { id: projectId } = useParams<{ id: string }>();

  return (
    <WorkspaceCollabProvider projectId={projectId}>
      <div className="flex h-dvh flex-col">
        <WorkspaceHeader />
        <WorkspaceWhiteboard />
      </div>
    </WorkspaceCollabProvider>
  );
};

export const WorkspaceView = ({ children }: { children: ReactNode }) => {
  return <main>{children}</main>;
};
