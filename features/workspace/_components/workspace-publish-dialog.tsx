"use client"

import { useEffect, useRef, useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { usePublishProject } from "../hook/use-publish-project"

/**
 * @component WorkspacePublishDialog
 * @description Publish flow for a board. Unpublished: asks to confirm publishing. Published: shows the public link with a copy icon and an Unpublish action (with its own confirm).
 * @param projectId - Public id of the board; also the id in the `/view/[id]` link.
 * @param isPublished - Current published state from the board record.
 */
export const WorkspacePublishDialog = ({
    projectId,
    isPublished,
    open,
    onOpenChange,
}: {
    projectId: string
    isPublished: boolean
    open: boolean
    onOpenChange: (open: boolean) => void
}) => {
    const { mutate, isPending } = usePublishProject(projectId)
    const [unpublishOpen, setUnpublishOpen] = useState(false)
    // Briefly true after a successful copy so the icon flips to a check mark.
    const [copied, setCopied] = useState(false)
    // Timer id for resetting `copied` — cleared on unmount.
    const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (copyTimeout.current) clearTimeout(copyTimeout.current)
        }
    }, [])

    // Built in the browser so it matches whatever host the app is served from.
    const url = typeof window === "undefined" ? "" : `${window.location.origin}/view/${projectId}`

    // Copies the public link to the clipboard.
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            toast.add({ title: "Link copied", type: "success" })
            if (copyTimeout.current) clearTimeout(copyTimeout.current)
            copyTimeout.current = setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.add({ title: "Couldn't copy link", description: "Copy it manually from the box.", type: "error" })
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent>
                    {isPublished ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Board is live</DialogTitle>
                                <DialogDescription>
                                    Anyone with this link can view the board (read-only). It always shows your latest saved changes.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex items-center gap-2">
                                <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Public link" />
                                <Button type="button" size="icon" variant="outline" onClick={handleCopy} aria-label="Copy link">
                                    {copied ? <CheckIcon /> : <CopyIcon />}
                                </Button>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setUnpublishOpen(true)} disabled={isPending}>
                                    Unpublish
                                </Button>
                                <Button onClick={() => onOpenChange(false)}>Done</Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>Publish this board?</DialogTitle>
                                <DialogDescription>
                                    Anyone with the link will be able to view it (read-only). You can unpublish at any time.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
                                    Cancel
                                </Button>
                                <Button disabled={isPending} onClick={() => mutate(true)}>
                                    {isPending && <Spinner />}
                                    {isPending ? "Publishing…" : "Publish"}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={unpublishOpen} onOpenChange={setUnpublishOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unpublish this board?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The public link will stop working. You can publish again later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={isPending}
                            onClick={() =>
                                mutate(false, {
                                    onSuccess: () => {
                                        setUnpublishOpen(false)
                                        onOpenChange(false)
                                    },
                                })
                            }
                        >
                            {isPending && <Spinner />}
                            {isPending ? "Unpublishing…" : "Unpublish"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
