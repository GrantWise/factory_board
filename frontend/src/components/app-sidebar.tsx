"use client"

import type React from "react"

import { LayoutDashboard, Kanban, Package, Factory, BarChart3, Settings, Users, LogOut, ChevronUp } from "lucide-react"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"

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
    title: "User Management",
    page: "users",
    icon: Users,
    requiresRole: "admin",
  },
  {
    title: "Settings",
    page: "settings",
    icon: Settings,
  },
]

export function AppSidebar({ currentPage = "dashboard", onNavigate, ...props }: AppSidebarProps) {
  const { user, logout, hasRole } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const getUserInitials = () => {
    if (!user) return "U"
    const firstName = user.first_name || ""
    const lastName = user.last_name || ""
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase()
    }
    return user.username[0].toUpperCase()
  }

  const getUserDisplayName = () => {
    if (!user) return "Unknown User"
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user.username
  }

  const getRoleDisplayName = () => {
    if (!user) return ""
    switch (user.role) {
      case 'admin': return "Administrator"
      case 'scheduler': return "Production Scheduler"
      case 'viewer': return "Viewer"
      default: return user.role
    }
  }

  // Filter navigation items based on user role
  const filteredNavigationItems = navigationItems.filter(item => {
    if (item.requiresRole) {
      return hasRole(item.requiresRole)
    }
    return true
  })

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
              {filteredNavigationItems.map((item) => (
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-medium">{getUserDisplayName()}</span>
                    <span className="text-xs text-muted-foreground">{getRoleDisplayName()}</span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-dropdown-menu-trigger-width]">
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
