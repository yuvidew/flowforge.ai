"use client"

import * as React from "react"
import {
  ArchiveIcon,
  FilesIcon,
  PinIcon,
} from "lucide-react"

import { useOrganization } from "@clerk/nextjs"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { CreateNewBoard } from "./create-new-board"
import { Logo } from "./logo"

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
  // Active team workspace (Clerk organization); null means the user's Personal workspace.
  const { organization } = useOrganization()

  return (
    // left-[56px]: the sidebar is position:fixed, so it must be offset past the workspace rail explicitly.
    <Sidebar collapsible="icon" className="data-[side=left]:left-[56px]" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              {/* Not interactive: it already sits inside a SidebarMenuButton (a <button>). */}
              <Logo interactive={false} />
              <span className="truncate font-medium">{organization?.name ?? "Personal"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
