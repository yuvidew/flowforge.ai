"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArchiveIcon, ArchiveRestoreIcon, GlobeIcon, MoreVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react"

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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { DEFAULT_COVER } from "@/features/all-files/constants"
import { useDeleteProject } from "@/features/all-files/hook/use-delete-project"
import { useUpdateProject } from "@/features/all-files/hook/use-update-project"
import type { Project } from "@/features/all-files/types"
import { RenameBoardDialog } from "./rename-board-dialog"

/**
 * @component BoardCard
 * @description Shared grid card for a board: cover image with the name and created date pinned to the bottom-left and a "more" menu pinned to the bottom-right on the same row, both absolutely positioned over the image. Published boards show a globe badge at the top-left of the cover. Used by the All Files and Archived pages.
 * @param project - The board row to render.
 * @param variant - "active" menu: edit name, archive, delete. "archived" menu: unarchive, delete.
 */
export const BoardCard = ({
    project,
    variant = "active",
}: {
    project: Project
    variant?: "active" | "archived"
}) => {
    const [renameOpen, setRenameOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const update = useUpdateProject()
    const remove = useDeleteProject()

    // Dims the card while an archive/unarchive/delete for this specific board is in flight.
    const isBusy =
        (update.isPending && update.variables?.projectId === project.projectId) ||
        (remove.isPending && remove.variables?.projectId === project.projectId)

    const createdOn = new Date(project.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    })

    return (
        <div className={cn("group relative overflow-hidden rounded-xl border bg-card", isBusy && "opacity-50")}>
            {/* Link covers the whole card; the menu below is a sibling so its clicks never navigate. */}
            <Link href={`/workspace/${project.projectId}`} prefetch className="block">
                <div className="relative aspect-4/3">
                    <Image
                        src={`/cover/${project.coverImage ?? DEFAULT_COVER}`}
                        alt=""
                        fill
                        sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {project.isPublished && (
                        <span
                            title="Published"
                            aria-label="Published"
                            className="absolute top-3 left-3 flex size-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                        >
                            <GlobeIcon className="size-4" />
                        </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-3 pt-10 pr-14 text-white">
                        <p className="truncate text-sm font-medium">{project.projectName}</p>
                        <p className="text-xs text-white/80">Created {createdOn}</p>
                    </div>
                </div>
            </Link>

            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button
                            size="icon"
                            variant="secondary"
                            className="absolute right-3 bottom-3 size-8 bg-transparent shadow-none hover:bg-transparent"
                            disabled={isBusy}
                            aria-label="Board options"
                        />
                    }
                >
                    <MoreVerticalIcon className="size-4 text-white" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {variant === "active" ? (
                        <>
                            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                                <PencilIcon className="size-4" />
                                Edit name
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => update.mutate({ projectId: project.projectId, isArchived: true })}
                            >
                                <ArchiveIcon className="size-4" />
                                Archive
                            </DropdownMenuItem>
                        </>
                    ) : (
                        <DropdownMenuItem
                            onClick={() => update.mutate({ projectId: project.projectId, isArchived: false })}
                        >
                            <ArchiveRestoreIcon className="size-4" />
                            Unarchive
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
                        <Trash2Icon className="size-4 text-destructive" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {variant === "active" && (
                <RenameBoardDialog
                    projectId={project.projectId}
                    currentName={project.projectName}
                    open={renameOpen}
                    onOpenChange={setRenameOpen}
                />
            )}

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete “{project.projectName}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently deletes the board and everything on its whiteboard. This can&apos;t be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={remove.isPending}
                            onClick={() =>
                                remove.mutate(
                                    { projectId: project.projectId },
                                    { onSuccess: () => setDeleteOpen(false) }
                                )
                            }
                        >
                            {remove.isPending && <Spinner />}
                            {remove.isPending ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
