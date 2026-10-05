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
import { useCreateProject } from "@/features/all-files/hook/use-create-project"
import { useNewBoardState } from "@/hooks/use-new-board-state"

/**
 * @component NewBoardDialog
 * @description Dialog with a validated form (react-hook-form + zod) that creates a board via `useCreateProject`. Visibility comes from `useNewBoardState`, so mount it once and open it from any button.
 */
export const NewBoardDialog = () => {
    const { isOpen, setOpen } = useNewBoardState()
    const { mutate, isPending } = useCreateProject()

    const form = useForm<NewBoardValues>({
        resolver: zodResolver(newBoardSchema),
        defaultValues: { name: "" },
    })

    // Closes the dialog and clears the form so a reopen starts empty.
    const handleOpenChange = (next: boolean) => {
        if (!next) form.reset()
        setOpen(next)
    }

    // Dialog only closes on success, so a failed request keeps the typed name for a retry.
    const handleSubmit = form.handleSubmit((values) => {
        mutate(values, { onSuccess: () => handleOpenChange(false) })
    })

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create new board</DialogTitle>
                    <DialogDescription>
                        Give your whiteboard workspace a name. You can change it later.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="new-board-name">Workspace name</FieldLabel>
                                    <Input
                                        {...field}
                                        id="new-board-name"
                                        placeholder="e.g. Product roadmap"
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
                            {isPending ? "Creating…" : "Create board"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
