
import { SidebarGroup, SidebarMenuButton, SidebarMenuItem } from './ui/sidebar'
import { PlusIcon } from 'lucide-react'

export const CreateNewBoard = () => {
    return (
        <SidebarGroup>
            <SidebarMenuItem>
                <SidebarMenuButton
                    tooltip={"Create Board"}
                    isActive
                    className="bg-primary! text-white! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                >
                    <PlusIcon />
                    <span className="group-data-[collapsible=icon]:hidden">Create Board</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarGroup>
    )
}
