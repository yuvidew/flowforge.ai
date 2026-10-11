"use client";

import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AiModeId } from "../../ai/prompts";
import { CHAT_MODES } from "../../constants";

/**
 * @component ChatComposer
 * @description Message box of the AI chat: a textarea (Enter sends, Shift+Enter adds a line), a row of mode icons
 * that hint what kind of diagram to create, and the send button.
 * @param modeId Currently picked mode, or null when the AI should decide.
 * @param pending True while a message is being processed; locks the box.
 * @param disabled True when the canvas isn't ready yet.
 */
export const ChatComposer = ({
  value,
  onChange,
  onSend,
  modeId,
  onModeChange,
  pending,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  modeId: AiModeId | null;
  onModeChange: (modeId: AiModeId | null) => void;
  pending: boolean;
  disabled: boolean;
}) => {
  const mode = CHAT_MODES.find((item) => item.id === modeId);

  return (
    <div className="border-t p-3">
      <div className="rounded-xl border bg-muted/30 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter adds a new line.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={mode?.placeholder ?? "Describe a diagram, or ask me to change what's on the board…"}
          maxLength={2000}
          className="min-h-16 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center justify-between gap-2 p-2">
          {/* Mode picker: click to pick, click again to let the AI decide. */}
          <div className="flex items-center gap-0.5" role="group" aria-label="Diagram type">
            {CHAT_MODES.map((item) => {
              const Icon = item.icon;
              const selected = item.id === modeId;

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant={selected ? "secondary" : "ghost"}
                        size="icon-sm"
                        aria-pressed={selected}
                        aria-label={item.label}
                        disabled={pending}
                        className={cn(!selected && "text-muted-foreground")}
                        onClick={() => onModeChange(selected ? null : item.id)}
                      />
                    }
                  >
                    <Icon />
                  </TooltipTrigger>
                  <TooltipContent side="top">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <Button size="sm" onClick={onSend} disabled={pending || disabled || !value.trim()}>
            {pending ? <Spinner /> : <ArrowUp />}
            {pending ? "Working…" : "Send"}
          </Button>
        </div>
      </div>
      {mode && <p className="mt-1.5 px-1 text-xs text-muted-foreground">Creating as: {mode.label}</p>}
    </div>
  );
};
