"use client";

import { ErrorView } from "@/components/error-view";
import { LoadingView } from "@/components/loading-view";
import { ReactNode, useState } from "react";
import { WorkspaceHeader } from "./workspace-header";
import { TabsType } from "../types/types";
import { WorkspaceWhiteboard } from "./workspace-whiteboard";
import { WorkspaceSmartDoc } from "./workspace-smartdoc";

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
  const [activeTab, setActiveTab] = useState<TabsType>("whiteboard");
  // Fills the viewport: header keeps its natural height, the active tab takes the rest.
  return (
    <div className="flex h-dvh flex-col">
      <WorkspaceHeader selectTab={activeTab} onSelectTab={setActiveTab} />
      {activeTab == "whiteboard" ? <WorkspaceWhiteboard/> : <WorkspaceSmartDoc/>}
    </div>
  );
};

export const WorkspaceView = ({ children }: { children: ReactNode }) => {
  return <main>{children}</main>;
};
