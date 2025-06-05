"use client"

/**
 * Dashboard - Main application container and router
 * 
 * Manages the overall application state, navigation between pages, and coordinates
 * data fetching for orders and work centres. Acts as the primary orchestrator
 * for all manufacturing operations interfaces.
 * 
 * Features:
 * - Real-time data fetching with auto-refresh
 * - Page navigation and routing
 * - Order movement coordination between work centres
 * - Loading states and error handling
 * - Legacy data format adaptation for existing components
 */

import { useState } from "react"
import { useTheme } from "next-themes"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardOverview } from "@/components/dashboard-overview"
import { PlanningBoard } from "@/components/planning-board"
import { OrdersTable } from "@/components/orders-table"
import { WorkCentresManagement } from "@/components/work-centres-management"
import { UsersManagement } from "@/components/users-management"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { useApiData } from "@/hooks/use-api-data"
import { ordersService, workCentresService } from "@/lib/api-services"
import type { DashboardMetrics } from "@/types/manufacturing"
import { Loader2, Sun, Moon, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState("dashboard")
  const { theme, setTheme } = useTheme()
  const { hasRole } = useAuth()
  
  // Fetch orders from API
  const {
    data: ordersResponse,
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useApiData(
    () => ordersService.getAll(),
    [],
    { 
      autoRefresh: 30000, // Refresh every 30 seconds
      onError: (error) => {
        // Silently handle auth errors - don't spam user
        if (error.status === 401 || error.status === 429) {
          return;
        }
      }
    }
  )
  
  // Fetch work centres from API
  const {
    data: workCentresResponse,
    isLoading: workCentresLoading,
    refetch: refetchWorkCentres,
  } = useApiData(
    () => workCentresService.getAll(),
    [],
    { 
      autoRefresh: 60000, // Refresh every minute
      onError: (error) => {
        // Silently handle auth errors - don't spam user
        if (error.status === 401 || error.status === 429) {
          return;
        }
      }
    }
  )
  
  // Extract data from API responses
  const orders = ordersResponse?.orders || []
  const workCentres = workCentresResponse?.work_centres || []
  
  // Calculate dashboard metrics from real data
  const dashboardMetrics: DashboardMetrics = {
    total_active_orders: orders.filter(o => o.status === 'in_progress' || o.status === 'not_started').length,
    completion_rate: orders.length > 0 ? (orders.filter(o => o.status === 'complete').length / orders.length) * 100 : 0,
    work_centre_utilization: workCentres.length > 0 ? (workCentres.reduce((sum, wc) => sum + wc.current_jobs, 0) / workCentres.reduce((sum, wc) => sum + wc.capacity, 0)) * 100 : 0,
    daily_production: orders.filter(o => o.completion_date?.startsWith(new Date().toISOString().split('T')[0])).reduce((sum, o) => sum + o.quantity_completed, 0),
    daily_target: 300,
    overdue_orders: orders.filter(o => o.status === 'overdue').length,
    average_cycle_time: 12.5
  }
  
  const isLoading = ordersLoading || workCentresLoading

  /**
   * Handles moving an order from one work centre to another
   * Coordinates with the backend API and refreshes local data
   * @param orderId - Numeric ID of the order to move
   * @param newWorkCentreId - Target work centre ID
   */
  const handleOrderMove = async (orderId: number, newWorkCentreId: number) => {
    try {
      await ordersService.move(orderId, newWorkCentreId, 'Moved via planning board')
      
      // Refresh data to get updated state
      await Promise.all([refetchOrders(), refetchWorkCentres()])
      
      toast.success('Order moved successfully')
    } catch (error: any) {
      // Handle auth errors gracefully
      if (error.status === 401 || error.status === 429) {
        toast.error('Please log in to move orders')
        return
      }
      
      console.error('[Dashboard] Order move failed:', {
        orderId,
        newWorkCentreId,
        error: error.message || error.error,
        status: error.status,
        code: error.code
      });
      
      let errorMessage = 'Failed to move order';
      if (error.status === 401) {
        errorMessage = 'Authentication required. Please log in again.';
      } else if (error.status === 403) {
        errorMessage = 'Permission denied. You do not have access to move orders.';
      } else if (error.status === 404) {
        errorMessage = 'Order or work centre not found.';
      } else if (error.status === 0) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.error) {
        errorMessage = error.error;
      }
      
      toast.error(errorMessage)
    }
  }

  /**
   * Handles work centre updates by refreshing data from API
   * Called when work centres are modified (create, update, delete operations)
   */
  const handleWorkCentreUpdate = async () => {
    try {
      console.log('[Dashboard] Refreshing work centres data after update');
      // Note: This is called when work centres are modified locally
      // The individual operations (create, update, delete) should handle API calls
      // This is just a refresh to get the latest state
      await refetchWorkCentres()
      console.log('[Dashboard] Work centres data refreshed successfully');
      toast.success('Work centres updated successfully')
    } catch (error: any) {
      console.error('[Dashboard] Work centre refresh failed:', {
        error: error.message || error.error,
        status: error.status,
        code: error.code
      });
      
      let errorMessage = 'Failed to update work centres';
      if (error.status === 401) {
        errorMessage = 'Authentication required. Please log in again.';
      } else if (error.status === 403) {
        errorMessage = 'Permission denied. You do not have access to work centres.';
      } else if (error.status === 0) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.error) {
        errorMessage = error.error;
      }
      
      toast.error(errorMessage)
    }
  }

  const getPageTitle = () => {
    switch (currentPage) {
      case "dashboard":
        return "Dashboard"
      case "planning":
        return "Planning Board"
      case "workcentres":
        return "Work Centres"
      case "orders":
        return "Orders Management"
      case "analytics":
        return "Analytics"
      case "users":
        return "User Management"
      case "settings":
        return "Settings"
      default:
        return "Dashboard"
    }
  }

  /**
   * Renders the current page component based on navigation state
   * Handles loading states and passes appropriate data to each page
   * @returns JSX element for the current page
   */
  const renderCurrentPage = () => {
    // Show loading spinner for initial data load
    if (isLoading && orders.length === 0 && workCentres.length === 0) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading factory data...</p>
          </div>
        </div>
      )
    }
    
    switch (currentPage) {
      case "dashboard":
        return <DashboardOverview metrics={dashboardMetrics} recentOrders={orders} onNavigate={setCurrentPage} />
      case "planning":
        return <PlanningBoard orders={orders} workCentres={workCentres} onOrderMove={handleOrderMove} onNavigate={setCurrentPage} onWorkCentreUpdate={refetchWorkCentres} onOrderUpdate={refetchOrders} />
      case "workcentres":
        return <WorkCentresManagement workCentres={workCentres} onWorkCentreUpdate={handleWorkCentreUpdate} />
      case "orders":
        return <OrdersTable orders={orders} workCentres={workCentres} />
      case "analytics":
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Analytics page coming soon...</p>
          </div>
        )
      case "users":
        if (!hasRole("admin")) {
          return (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">Access denied. Admin role required.</p>
            </div>
          )
        }
        return <UsersManagement />
      case "settings":
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Settings page coming soon...</p>
          </div>
        )
      default:
        return <DashboardOverview metrics={dashboardMetrics} recentOrders={orders} onNavigate={setCurrentPage} />
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-4 bg-sidebar text-sidebar-foreground">
          <SidebarTrigger className="-ml-1 text-sidebar-foreground hover:bg-sidebar-accent" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-sidebar-foreground/20" />
          <Breadcrumb>
            <BreadcrumbList className="text-sidebar-foreground">
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#" className="text-sidebar-foreground/70 hover:text-sidebar-foreground">Manufacturing</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block text-sidebar-foreground/50" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-sidebar-foreground font-medium">{getPageTitle()}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            {(ordersLoading || workCentresLoading) && (
              <div className="flex items-center gap-1 text-xs text-sidebar-foreground/70">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="hidden sm:inline">Refreshing...</span>
              </div>
            )}
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">{renderCurrentPage()}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
