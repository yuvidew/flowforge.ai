"use client";

import { History, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * @component ChatSessionMenu
 * @description The three-dots menu in the chat header: rename the session, open the session list, or delete it.
 */
export const ChatSessionMenu = ({
  disabled,
  onRename,
  onShowSessions,
  onDelete,
}: {
  disabled: boolean;
  onRename: () => void;
  onShowSessions: () => void;
  onDelete: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Session options" disabled={disabled} />}>
      <MoreVertical />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuItem onClick={onRename}>
        <Pencil /> Edit session name
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onShowSessions}>
        <History /> Session list
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={onDelete}>
        <Trash2 /> Delete session
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
