"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, UserPlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useAddCollaborator } from "../hook/use-add-collaborator";
import { useCollaborators } from "../hook/use-collaborators";
import { useRemoveCollaborator } from "../hook/use-remove-collaborator";

/**
 * @component WorkspaceShareDialog
 * @description Owner-only dialog for inviting people to edit the board live. Lists the owner and invited collaborators (with remove), takes an email to invite, and offers a link to copy; invited people sign in with that email and open the link.
 * @param projectId - Public id of the board; also the id in the `/workspace/[id]` link.
 */
export const WorkspaceShareDialog = ({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { data, isPending, isError } = useCollaborators(projectId);
  const { mutate: add, isPending: isAdding } = useAddCollaborator(projectId);
  const { mutate: remove, isPending: isRemoving, variables: removingEmail } = useRemoveCollaborator(projectId);
  // Email being typed in the invite box.
  const [email, setEmail] = useState("");
  // Briefly true after copying so the icon shows a check.
  const [copied, setCopied] = useState(false);

  // Invites the typed email and clears the box once the server accepts it.
  const handleInvite = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    add(email, { onSuccess: () => setEmail("") });
  };

  // Copies the board link; collaborators open it after signing in with the invited email.
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/workspace/${projectId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure context / permissions); nothing useful to do.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share board</DialogTitle>
          <DialogDescription>
            People you invite can draw on this board with you in real time. They must sign in with the invited email.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="flex gap-2">
          <Input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isAdding}
            aria-label="Collaborator email"
          />
          <Button type="submit" disabled={isAdding || !email.trim()}>
            {isAdding ? <Spinner /> : <UserPlusIcon />}
            {isAdding ? "Inviting…" : "Invite"}
          </Button>
        </form>

        <div className="flex flex-col gap-1">
          {isPending ? (
            <Skeleton className="h-8 w-full" />
          ) : isError ? (
            <p className="text-sm text-destructive">Couldn&apos;t load collaborators.</p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm">
                <span className="truncate">{data.owner}</span>
                <span className="text-xs text-muted-foreground">Owner</span>
              </div>

              {data.collaborators.map((collaborator) => (
                <div key={collaborator} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm">
                  <span className="truncate">{collaborator}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${collaborator}`}
                    disabled={isRemoving && removingEmail === collaborator}
                    onClick={() => remove(collaborator)}
                  >
                    {isRemoving && removingEmail === collaborator ? <Spinner /> : <XIcon />}
                  </Button>
                </div>
              ))}

              {data.collaborators.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No one else has been invited yet.</p>
              )}
            </>
          )}
        </div>

        <Button variant="outline" onClick={handleCopy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Link copied" : "Copy board link"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
