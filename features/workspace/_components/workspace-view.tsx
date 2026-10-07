"use client";

import { ErrorView } from "@/components/error-view";
import { LoadingView } from "@/components/loading-view";
import { ReactNode } from "react";
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

export const WorkSpace = () => {
  return (
    <div className="flex h-dvh flex-col">
      <WorkspaceHeader  />
      <WorkspaceWhiteboard/> 
    </div>
  );
};

export const WorkspaceView = ({ children }: { children: ReactNode }) => {
  return <main>{children}</main>;
};
