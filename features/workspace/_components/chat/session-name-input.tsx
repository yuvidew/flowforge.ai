"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * @component SessionNameInput
 * @description Inline rename field shown in the chat header: Enter saves, Escape or clicking away cancels.
 * @param initialName Current session name, used as the starting text.
 * @param onSubmit Called with the trimmed new name; not called when it is empty or unchanged.
 */
export const SessionNameInput = ({
  initialName,
  disabled,
  onSubmit,
  onCancel,
}: {
  initialName: string;
  disabled: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(initialName);

  return (
    <Input
      autoFocus
      value={name}
      maxLength={60}
      disabled={disabled}
      aria-label="Session name"
      className="h-8"
      onChange={(event) => setName(event.target.value)}
      onBlur={onCancel}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          const next = name.trim();
          if (next && next !== initialName) onSubmit(next);
          else onCancel();
        }
        if (event.key === "Escape") {
          // Stops the popover from closing along with the rename.
          event.stopPropagation();
          onCancel();
        }
      }}
    />
  );
};
