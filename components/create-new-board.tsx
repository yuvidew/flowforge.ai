"use client"

import { SidebarGroup, SidebarMenuButton, SidebarMenuItem } from './ui/sidebar'
import { PlusIcon } from 'lucide-react'
import { useNewBoardState } from '@/hooks/use-new-board-state'

export const CreateNewBoard = () => {
    // Opens the shared new-board dialog.
    const onOpen = useNewBoardState((state) => state.onOpen)

    return (
        <SidebarGroup>
            <SidebarMenuItem>
                <SidebarMenuButton
                    tooltip={"Create Board"}
                    isActive
                    onClick={onOpen}
                    className="bg-primary! text-white! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                >
                    <PlusIcon />
                    <span className="group-data-[collapsible=icon]:hidden">Create Board</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarGroup>
    )
}
