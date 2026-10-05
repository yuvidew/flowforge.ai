"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { PlusIcon } from "lucide-react"

// Shape of a single top-level sidebar link.
type NavMainItem = {
  title: string
  url: string
  icon?: React.ReactNode
}

/**
 * @component NavMain
 * @description Renders the primary sidebar navigation links and highlights the one matching the current route.
 * @param items Links to render, in display order.
 */
export const NavMain = ({ items }: { items: NavMainItem[] }) => {
  // Current route, used to mark the active link.
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              tooltip={item.title}
              isActive={pathname === item.url || pathname.startsWith(`${item.url}/`)}
              render={<Link href={item.url} />}
            >
              {item.icon}
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
