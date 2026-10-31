"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useClerk, useOrganization, useOrganizationList, useUser } from "@clerk/nextjs"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronsUpDownIcon, LogOutIcon, PlusIcon, UserPlusIcon, UsersIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { PROJECTS_QUERY_KEY } from "@/features/all-files/constants"
import { getErrorMessage } from "@/lib/get-error-message"

/**
 * @component WorkspaceSwitcher
 * @description Sidebar header showing only the active workspace's name as a dropdown. Team workspaces offer invite/manage members (admins), create a new workspace, and leave; the Personal workspace only offers create.
 */
export const WorkspaceSwitcher = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isMobile } = useSidebar()
  const { user } = useUser()
  const { organization, membership } = useOrganization()
  const { setActive } = useOrganizationList()
  const { openCreateOrganization, openOrganizationProfile } = useClerk()
  const [confirmLeave, setConfirmLeave] = React.useState(false)
  const [leaving, setLeaving] = React.useState(false)

  // Inviting and managing members needs the admin role on the team.
  const isAdmin = membership?.role === "org:admin"

  // Leaves the active team, falls back to Personal, drops cached team boards and returns to the board list.
  const leaveWorkspace = async () => {
    if (!user || !organization || !setActive) return
    setLeaving(true)
    try {
      await user.leaveOrganization(organization.id)
      await setActive({ organization: null })
      queryClient.removeQueries({ queryKey: [PROJECTS_QUERY_KEY] })
      setConfirmLeave(false)
      toast.add({ title: "You left the workspace", type: "success" })
      router.push("/all-files")
      router.refresh()
    } catch (error) {
      toast.add({
        title: "Couldn't leave workspace",
        description: getErrorMessage(error, "Please try again."),
        type: "error",
      })
    } finally {
      setLeaving(false)
    }
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}>
              <span className="truncate font-medium">{organization?.name ?? "Personal"}</span>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-56" side={isMobile ? "bottom" : "right"} align="start" sideOffset={4}>
              <DropdownMenuGroup>
                <DropdownMenuLabel>{organization?.name ?? "Personal"}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {organization && isAdmin && (
                <>
                  {/* Clerk's profile opens on Members, where invitations are sent too. */}
                  <DropdownMenuItem onClick={() => openOrganizationProfile()}>
                    <UserPlusIcon />
                    Invite members
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openOrganizationProfile()}>
                    <UsersIcon />
                    Manage members
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => openCreateOrganization({ afterCreateOrganizationUrl: "/all-files" })}>
                <PlusIcon />
                Create new workspace
              </DropdownMenuItem>
              {organization && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirmLeave(true)}>
                    <LogOutIcon />
                    Leave workspace
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {organization?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to this workspace&apos;s boards until an admin invites you again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={leaving} onClick={leaveWorkspace}>
              {leaving && <Spinner data-icon="inline-start" />}
              {leaving ? "Leaving…" : "Leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
