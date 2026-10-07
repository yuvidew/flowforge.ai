"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useIsMutating } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe2Icon, SaveIcon } from "lucide-react";
import { useProject } from "../hook/use-project";
import { WorkspaceNameInput } from "./workspace-name-input";
import { WorkspacePublishDialog } from "./workspace-publish-dialog";

/**
 * @component WorkspaceHeader
 * @description Top bar of the workspace: logo, the board's name, and the Save / Publish actions. Publish opens the publish dialog and reflects the board's published state.
 */
export const WorkspaceHeader = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const { data: project, isPending } = useProject(projectId);
    const [publishOpen, setPublishOpen] = useState(false);
    // True while the whiteboard autosave mutation (see useSaveWhiteboard) is in flight.
    const isSaving = useIsMutating({ mutationKey: ["save-whiteboard"] }) > 0;

    return (
        <header className="p-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Logo />

                {isPending || !project ? (
                    <Skeleton className="h-8 w-48" />
                ) : (
                    <WorkspaceNameInput projectId={projectId} savedName={project.projectName} />
                )}
            </div>

            {/* extra button */}
            <div className="flex items-center gap-2">
                <Button disabled={isSaving}>
                   {isSaving ? <Spinner /> : <SaveIcon />}
                   {isSaving ? "Saving…" : "Save"}
                </Button>

                <Button variant={"outline"} disabled={!project} onClick={() => setPublishOpen(true)}>
                   <Globe2Icon className={project?.isPublished ? "text-green-600" : undefined} />
                   {project?.isPublished ? "Published" : "Publish"}
                </Button>
            </div>

            {project && (
                <WorkspacePublishDialog
                    projectId={projectId}
                    isPublished={project.isPublished}
                    open={publishOpen}
                    onOpenChange={setPublishOpen}
                />
            )}
        </header>
    );
};
