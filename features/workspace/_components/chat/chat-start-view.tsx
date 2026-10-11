"use client";

import { Sparkles } from "lucide-react";
import type { AiModeId } from "../../ai/prompts";
import { CHAT_MODES, CHAT_SUGGESTIONS } from "../../constants";

/**
 * @component ChatStartView
 * @description Empty state of a new chat: a short intro and one-tap starter prompts (the picked mode's example, or
 * generic ones while the AI decides).
 * @param onPick Called with the prompt text when the user taps a suggestion.
 */
export const ChatStartView = ({
  modeId,
  disabled,
  onPick,
}: {
  modeId: AiModeId | null;
  disabled: boolean;
  onPick: (text: string) => void;
}) => {
  const mode = CHAT_MODES.find((item) => item.id === modeId);
  const suggestions = mode ? [mode.example] : CHAT_SUGGESTIONS;

  return (
    <div className="flex flex-1 flex-col justify-center gap-4 border-t px-4 py-3">
      <div className="space-y-1 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </span>
        <p className="text-sm font-medium">What should we build?</p>
        <p className="text-xs text-muted-foreground">
          Pick a diagram type below, or just describe it. I can also edit what&apos;s already on the board.
        </p>
      </div>
      <div className="space-y-2">
        {suggestions.map((text) => (
          <button
            key={text}
            type="button"
            disabled={disabled}
            onClick={() => onPick(text)}
            className="block w-full rounded-xl border p-2.5 text-left text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {text} 
          </button>
        ))}
      </div>
    </div>
  );
};
