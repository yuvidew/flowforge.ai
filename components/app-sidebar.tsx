"use client"

import * as React from "react"
import {
  ArchiveIcon,
  FilesIcon,
  PinIcon,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { CreateNewBoard } from "./create-new-board"
import { WorkspaceSwitcher } from "./workspace-switcher"

// Top-level routes served under the (root) layout.
const navMain = [
  { title: "All Files", url: "/all-files", icon: <FilesIcon className="size-5" /> },
  { title: "Favorites", url: "/favorites", icon: <PinIcon className="size-5" /> },
  { title: "Archived", url: "/archived", icon: <ArchiveIcon className="size-5" /> },
]

/**
 * @component AppSidebar
 * @description Collapsible-to-icons sidebar for signed-in pages: the active workspace's name, main navigation, and the user menu. It sits to the right of the 56px WorkspaceRail.
 */
export const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  return (
    // left-[56px]: the sidebar is position:fixed, so it must be offset past the workspace rail explicitly.
    <Sidebar collapsible="icon" className="data-[side=left]:left-[56px]" {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <CreateNewBoard/>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
