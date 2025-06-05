"use client"

import type React from "react"

import { LayoutDashboard, Kanban, Package, Factory, BarChart3, Settings } from "lucide-react"
import Image from "next/image"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  currentPage?: string
  onNavigate?: (page: string) => void
}

const navigationItems = [
  {
    title: "Dashboard",
    page: "dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Planning Board",
    page: "planning",
    icon: Kanban,
  },
  {
    title: "Work Centres",
    page: "workcentres",
    icon: Factory,
  },
  {
    title: "Orders Management",
    page: "orders",
    icon: Package,
  },
  {
    title: "Analytics",
    page: "analytics",
    icon: BarChart3,
  },
  {
    title: "Settings",
    page: "settings",
    icon: Settings,
  },
]

export function AppSidebar({ currentPage = "dashboard", onNavigate, ...props }: AppSidebarProps) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-blue text-white">
            <Image src="/translution_logo.svg" alt="Factory Logo" width={32} height={32} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-primary-blue">FactoryBoard</span>
            <span className="text-xs text-sidebar-foreground/70">Manufacturing Planning</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={currentPage === item.page}
                    onClick={() => onNavigate?.(item.page)}
                  >
                    <button className="w-full">
                      <item.icon />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <Avatar className="h-6 w-6">
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left">
                <span className="text-sm font-medium">John Doe</span>
                <span className="text-xs text-muted-foreground">Production Manager</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
