"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";

/**
 * @component DeleteSessionDialog
 * @description Confirmation before a chat session and all its messages are deleted for good.
 * @param sessionName Name shown in the confirmation text.
 * @param pending True while the delete request is running; locks the buttons.
 */
export const DeleteSessionDialog = ({
  open,
  onOpenChange,
  sessionName,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionName: string;
  pending: boolean;
  onConfirm: () => void;
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this session?</AlertDialogTitle>
        <AlertDialogDescription>
          &ldquo;{sessionName}&rdquo; and all its messages will be deleted. Shapes already on the board stay as they
          are. This can&apos;t be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogAction variant="destructive" disabled={pending} onClick={onConfirm}>
          {pending ? (
            <>
              <Spinner /> Deleting…
            </>
          ) : (
            "Delete"
          )}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
