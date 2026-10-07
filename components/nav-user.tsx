"use client"

import { useClerk, useUser } from "@clerk/nextjs"
import { useState } from "react"
import { ChevronsUpDownIcon, LogOutIcon, PlugIcon, SettingsIcon } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SettingsDialog } from "@/components/settings-dialog"
import { ConnectMcpDialog } from "@/features/connect-mcp/_components/connect-mcp-dialog"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

// Extracts up to two initials from a full name for the avatar fallback.
const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U"

/**
 * @component NavUser
 * @description Renders the signed-in Clerk user's avatar and account dropdown (with sign-out) in the sidebar footer.
 */
export const NavUser = () => {
  const { isMobile } = useSidebar()
  const { user } = useUser()
  const { signOut } = useClerk()

  // Controls the settings dialog; it lives outside the dropdown so it survives the menu closing.
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Controls the Connect to MCP dialog; same reason as above.
  const [connectOpen, setConnectOpen] = useState(false)

  // Display values derived from the Clerk user, with safe fallbacks while loading.
  const name = user?.fullName ?? user?.username ?? "User"
  const email = user?.primaryEmailAddress?.emailAddress ?? ""
  const avatar = user?.imageUrl

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarImage src={avatar} alt={name} />
              <AvatarFallback>{getInitials(name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs">{email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarImage src={avatar} alt={name} />
                    <AvatarFallback>{getInitials(name)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    <span className="truncate text-xs">{email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <SettingsIcon />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConnectOpen(true)}>
              <PlugIcon />
              Connect to MCP
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut({ redirectUrl: "/sign-in" })}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        <ConnectMcpDialog open={connectOpen} onOpenChange={setConnectOpen} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
