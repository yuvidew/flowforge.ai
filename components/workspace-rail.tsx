"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useClerk, useOrganization, useOrganizationList, useUser } from "@clerk/nextjs"
import { useQueryClient } from "@tanstack/react-query"
import { PlusIcon, SettingsIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PROJECTS_QUERY_KEY } from "@/features/all-files/constants"
import { cn } from "@/lib/utils"

// Up to two initials from a workspace name, for the avatar fallback.
const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

/**
 * @component RailItem
 * @description One round button in the rail with a tooltip on the right and a pill on the left edge when it is the active workspace.
 * @param label - Tooltip text and accessible name.
 * @param active - Whether this is the workspace currently selected.
 * @param dashed - Draws a dashed border (used for pending invitations).
 */
const RailItem = ({
  label,
  active = false,
  dashed = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  dashed?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) => (
  <div className="relative flex w-full justify-center">
    {/* Active pill, flush with the rail's left edge. */}
    <span
      aria-hidden
      className={cn(
        "absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-all",
        active ? "h-5" : "h-0"
      )}
    />
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-current={active ? "true" : undefined}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              "flex size-9 items-center justify-center overflow-hidden rounded-2xl bg-sidebar-accent text-sidebar-accent-foreground transition-all hover:rounded-xl disabled:opacity-60",
              active && "rounded-xl ring-2 ring-primary",
              dashed && "border-2 border-dashed border-muted-foreground"
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  </div>
)

/**
 * @component WorkspaceRail
 * @description Fixed 56px rail on the far left listing the user's workspaces: their Personal workspace first, then every team (Clerk organization) they belong to, pending team invitations, and a button to create a team. Clicking one makes it the active organization, which scopes the boards list and new boards. Admins also get a settings button for the active team (members, invitations, roles).
 */
export const WorkspaceRail = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useUser()
  const { organization } = useOrganization()
  const { openCreateOrganization, openOrganizationProfile } = useClerk()
  const { isLoaded, setActive, userMemberships, userInvitations } = useOrganizationList({
    userMemberships: { infinite: true },
    userInvitations: { infinite: true, status: "pending" },
  })
  // Id being switched to ("personal" for no organization), to show a spinner and ignore double clicks.
  const [switchingTo, setSwitchingTo] = React.useState<string | null>(null)

  // Makes an organization (or null = Personal) the active workspace, drops the previous workspace's cached boards, and goes to its board list.
  const switchTo = async (organizationId: string | null) => {
    if (!setActive || switchingTo) return
    setSwitchingTo(organizationId ?? "personal")
    try {
      await setActive({ organization: organizationId })
      queryClient.removeQueries({ queryKey: [PROJECTS_QUERY_KEY] })
      router.push("/all-files")
      router.refresh()
    } finally {
      setSwitchingTo(null)
    }
  }

  // Accepts a pending invitation, refreshes the lists, and opens that team.
  const acceptInvitation = async (invitation: NonNullable<typeof userInvitations.data>[number]) => {
    setSwitchingTo(invitation.id)
    try {
      await invitation.accept()
      await Promise.all([userMemberships.revalidate?.(), userInvitations.revalidate?.()])
      await switchTo(invitation.publicOrganizationData.id)
    } finally {
      setSwitchingTo(null)
    }
  }

  return (
    <nav
      aria-label="Workspaces"
      className="fixed inset-y-0 left-0 z-20 flex w-[56px] flex-col items-center gap-2 border-r bg-sidebar py-2"
    >
      <RailItem
        label="Personal"
        active={isLoaded && !organization}
        disabled={!isLoaded}
        onClick={() => switchTo(null)}
      >
        {switchingTo === "personal" ? (
          <Spinner />
        ) : (
          <Avatar className="size-full rounded-none after:hidden">
            <AvatarImage src={user?.imageUrl} alt="" className="rounded-none" />
            <AvatarFallback className="rounded-none">{getInitials(user?.fullName ?? "Me")}</AvatarFallback>
          </Avatar>
        )}
      </RailItem>

      <Separator className="w-6" />

      <div className="flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto">
        {userMemberships.data?.map(({ organization: team }) => (
          <RailItem
            key={team.id}
            label={team.name}
            active={organization?.id === team.id}
            onClick={() => switchTo(team.id)}
          >
            {switchingTo === team.id ? (
              <Spinner />
            ) : (
              <Avatar className="size-full rounded-none after:hidden">
                <AvatarImage src={team.imageUrl} alt="" className="rounded-none" />
                <AvatarFallback className="rounded-none">{getInitials(team.name)}</AvatarFallback>
              </Avatar>
            )}
          </RailItem>
        ))}

        {userMemberships.hasNextPage && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => userMemberships.fetchNext?.()}
          >
            More
          </button>
        )}

        {userInvitations.data?.map((invitation) => (
          <RailItem
            key={invitation.id}
            label={`Join ${invitation.publicOrganizationData.name}`}
            dashed
            onClick={() => acceptInvitation(invitation)}
          >
            {switchingTo === invitation.id ? (
              <Spinner />
            ) : (
              <Avatar className="size-full rounded-none after:hidden">
                <AvatarImage src={invitation.publicOrganizationData.imageUrl} alt="" className="rounded-none" />
                <AvatarFallback className="rounded-none">
                  {getInitials(invitation.publicOrganizationData.name)}
                </AvatarFallback>
              </Avatar>
            )}
          </RailItem>
        ))}
      </div>

      <RailItem
        label="Create a team workspace"
        onClick={() =>
          // Clerk makes the new organization active when it is created.
          openCreateOrganization({ afterCreateOrganizationUrl: "/all-files" })
        }
      >
        <PlusIcon className="size-4" />
      </RailItem>

      {organization && (
        <RailItem
          label={`${organization.name} settings`}
          onClick={() => openOrganizationProfile({ afterLeaveOrganizationUrl: "/all-files" })}
        >
          <SettingsIcon className="size-4" />
        </RailItem>
      )}
    </nav>
  )
}
