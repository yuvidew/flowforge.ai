"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { newBoardSchema } from "@/features/all-files/schema";
import { useAutosaveProjectName } from "../hook/use-autosave-project-name";

// Pause after the last keystroke before the name is saved.
const SAVE_DEBOUNCE_MS = 800;

/**
 * @component WorkspaceNameInput
 * @description Inline input in the workspace header that edits the board's name and autosaves it (debounced, and immediately on blur). Invalid values (empty / over 50 chars) are never sent and revert on blur.
 * @param projectId - Public id of the board being renamed.
 * @param savedName - The name currently stored on the server.
 */
export const WorkspaceNameInput = ({ projectId, savedName }: { projectId: string; savedName: string }) => {
    const { mutate, isPending } = useAutosaveProjectName(projectId);
    const [name, setName] = useState(savedName);
    // Briefly true after a successful save so a check mark confirms it.
    const [justSaved, setJustSaved] = useState(false);

    // Debounce timer id — flushed/cleared on unmount.
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Timer id for hiding the "saved" check.
    const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Latest typed value and last server value, readable from timers/cleanup without stale closures.
    const nameRef = useRef(name);
    const savedRef = useRef(savedName);
    // True while the user is editing, so a refetch doesn't overwrite what they're typing.
    const dirtyRef = useRef(false);

    // Follows the server value (e.g. after a refetch) unless the user has unsaved edits.
    useEffect(() => {
        savedRef.current = savedName;
        if (!dirtyRef.current) {
            setName(savedName);
            nameRef.current = savedName;
        }
    }, [savedName]);

    // Saves the current value if it is valid and actually changed.
    const flush = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = null;

        const next = nameRef.current.trim();
        if (next === savedRef.current || !newBoardSchema.safeParse({ name: next }).success) return;

        mutate(next, {
            onSuccess: () => {
                dirtyRef.current = false;
                setJustSaved(true);
                if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
                savedTimeoutRef.current = setTimeout(() => setJustSaved(false), 1500);
            },
        });
    };

    // Keep the latest flush reachable from the unmount cleanup so a pending edit isn't lost on navigation.
    const flushRef = useRef(flush);
    flushRef.current = flush;

    useEffect(() => {
        return () => {
            if (timeoutRef.current) flushRef.current();
            if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        };
    }, []);

    const handleChange = (value: string) => {
        setName(value);
        nameRef.current = value;
        dirtyRef.current = true;
        setJustSaved(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    };

    // Saves right away, or reverts an invalid (empty) name back to the last saved one.
    const handleBlur = () => {
        if (!newBoardSchema.safeParse({ name: nameRef.current.trim() }).success) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
            dirtyRef.current = false;
            setName(savedRef.current);
            nameRef.current = savedRef.current;
            return;
        }
        flush();
    };

    return (
        <div className="relative flex items-center">
            <Input
                value={name}
                maxLength={50}
                aria-label="Board name"
                autoComplete="off"
                onChange={(e) => handleChange(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="h-8 w-48 border-0 bg-transparent px-1 pr-7 font-medium shadow-none outline-none ring-0 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent sm:w-64"
            />
            <span className="pointer-events-none absolute right-2 text-muted-foreground">
                {isPending ? <Spinner className="size-3.5" /> : justSaved ? <CheckIcon className="size-3.5" /> : null}
            </span>
        </div>
    );
};
