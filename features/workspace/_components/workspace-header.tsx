"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useIsMutating } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckIcon, Share2Icon } from "lucide-react";
import { useCollaborators } from "../hook/use-collaborators";
import { useProject } from "../hook/use-project";
import { WorkspaceNameInput } from "./workspace-name-input";
import { WorkspacePresence } from "./workspace-presence";
import { WorkspaceShareDialog } from "./workspace-share-dialog";

/**
 * @component WorkspaceHeader
 * @description Top bar of the workspace: logo and board name on the left; on the right the Save status, the owner's Share button, and the avatars of everyone currently on the board.
 */
export const WorkspaceHeader = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const { data: project, isPending } = useProject(projectId);
    const { data: access } = useCollaborators(projectId);
    const [shareOpen, setShareOpen] = useState(false);
    // True while the whiteboard autosave mutation (see useSaveWhiteboard) is in flight.
    const isSaving = useIsMutating({ mutationKey: ["save-whiteboard"] }) > 0;
    // Only the owner of a personal board invites people by email; team boards are open to the whole workspace
    // (members are managed from the workspace rail), so there is nothing to share per board.
    const canShare = access?.role === "owner" && !!project && !project.orgId;

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

            <div className="flex items-center gap-3">
                {/* Autosave status — informational only, so plain text rather than a button. */}
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground" role="status" aria-live="polite">
                    {isSaving ? <Spinner className="size-4" /> : <CheckIcon className="size-4" />}
                    {isSaving ? "Saving…" : "Saved"}
                </span>

                {canShare && (
                    <Button variant="outline" onClick={() => setShareOpen(true)}>
                        <Share2Icon data-icon="inline-start" />
                        Share
                    </Button>
                )}

                <WorkspacePresence />
            </div>

            {canShare && <WorkspaceShareDialog projectId={projectId} open={shareOpen} onOpenChange={setShareOpen} />}
        </header>
    );
};
