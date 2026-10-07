"use client"

import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { newBoardSchema, type NewBoardValues } from "@/features/all-files/schema"
import { useUpdateProject } from "@/features/all-files/hook/use-update-project"

/**
 * @component RenameBoardDialog
 * @description Dialog with a validated form that renames a board via `useUpdateProject`.
 * @param projectId - Public id of the board being renamed.
 * @param currentName - Name used to prefill the input each time the dialog opens.
 */
export const RenameBoardDialog = ({
    projectId,
    currentName,
    open,
    onOpenChange,
}: {
    projectId: string
    currentName: string
    open: boolean
    onOpenChange: (open: boolean) => void
}) => {
    const { mutate, isPending } = useUpdateProject()

    const form = useForm<NewBoardValues>({
        resolver: zodResolver(newBoardSchema),
        defaultValues: { name: currentName },
    })

    // Resets to the latest saved name whenever the dialog opens or closes.
    const handleOpenChange = (next: boolean) => {
        form.reset({ name: currentName })
        onOpenChange(next)
    }

    // Dialog only closes on success, so a failed request keeps the typed name for a retry.
    const handleSubmit = form.handleSubmit((values) => {
        mutate({ projectId, name: values.name }, { onSuccess: () => onOpenChange(false) })
    })

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rename board</DialogTitle>
                    <DialogDescription>Choose a new name for this board.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`rename-board-${projectId}`}>Board name</FieldLabel>
                                    <Input
                                        {...field}
                                        id={`rename-board-${projectId}`}
                                        autoComplete="off"
                                        aria-invalid={fieldState.invalid}
                                    />
                                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => handleOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Spinner />}
                            {isPending ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
