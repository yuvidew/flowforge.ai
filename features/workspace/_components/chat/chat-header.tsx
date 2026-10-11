"use client";

import type { ReactNode } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";

/**
 * @component ChatHeader
 * @description Header of the AI chat popover: icon, title (plain text or a node such as the inline rename input),
 * optional description, view-specific action buttons and the close button.
 * @param title Heading text, or a node that replaces the heading (e.g. while renaming).
 * @param actions Buttons shown before the close button, which differ per view.
 */
export const ChatHeader = ({
  title,
  description,
  actions,
  onClose,
}: {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  onClose: () => void;
}) => (
  <div className="flex items-center gap-3 bg-linear-to-b from-primary/10 to-transparent p-4">
    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
      <Sparkles className="size-4" />
    </span>
    <div className="min-w-0 flex-1">
      {typeof title === "string" ? <PopoverTitle className="truncate text-base">{title}</PopoverTitle> : title}
      {description && <PopoverDescription className="truncate text-xs">{description}</PopoverDescription>}
    </div>
    {actions}
    <Button variant="ghost" size="icon-xs" aria-label="Close" onClick={onClose}>
      <X />
    </Button>
  </div>
);
