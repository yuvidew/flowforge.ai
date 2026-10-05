"use client"

import * as React from "react"
import {
  ArchiveIcon,
  FilesIcon,
  HistoryIcon,
  ShapesIcon,
  Share2Icon,
} from "lucide-react"

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
import { Createds } from "./createds"
import { Logo } from "./logo"

// Top-level routes served under the (root) layout.
const navMain = [
  { title: "All Files", url: "/all-files", icon: <FilesIcon className="size-5" /> },
  { title: "Shared", url: "/shared", icon: <Share2Icon className="size-5" /> },
  { title: "Archived", url: "/archived", icon: <ArchiveIcon className="size-5" /> },
]

/**
 * @component AppSidebar
 * @description Collapsible-to-icons sidebar for signed-in pages: FlowForge brand, main navigation, and the user menu.
 */
export const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <Logo/>
              <span className="truncate font-medium">FlowForge</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <CreateNewBoard/>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <Createds/>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
