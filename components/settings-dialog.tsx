"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ModeToggle } from "./mode-toggle"


/**
 * @component SettingsDialog
 * @description Modal with app settings; currently lets the user switch the theme between light, dark and system.
 * @param open Whether the dialog is visible.
 * @param onOpenChange Called when the dialog requests to open or close.
 */
export const SettingsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Choose how FlowForge looks to you.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          <ModeToggle/>
        </div>
      </DialogContent>
    </Dialog>
  )
}
