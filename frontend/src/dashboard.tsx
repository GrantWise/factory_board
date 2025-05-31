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
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardOverview } from "@/components/dashboard-overview"
import { PlanningBoard } from "@/components/planning-board"
import { OrdersTable } from "@/components/orders-table"
import { WorkCentresManagement } from "@/components/work-centres-management"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { useApiData } from "@/hooks/use-api-data"
import { ordersService, workCentresService } from "@/lib/api-services"
import { 
  adaptOrdersToLegacy, 
  adaptWorkCentresToLegacy, 
  calculateDashboardMetrics,
  getWorkCentreIdFromCode,
} from "@/lib/data-adapters"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState("dashboard")
  
  // Fetch orders from API
  const {
    data: ordersResponse,
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useApiData(
    () => ordersService.getAll(),
    [],
    { autoRefresh: 30000 } // Refresh every 30 seconds
  )
  
  // Fetch work centres from API
  const {
    data: workCentresResponse,
    isLoading: workCentresLoading,
    refetch: refetchWorkCentres,
  } = useApiData(
    () => workCentresService.getAll(),
    [],
    { autoRefresh: 60000 } // Refresh every minute
  )
  
  // Extract data from API responses
  const orders = ordersResponse?.orders || []
  const workCentres = workCentresResponse?.workCentres || []
  
  // Convert to legacy format for existing components
  const legacyOrders = adaptOrdersToLegacy(orders)
  const legacyWorkCentres = adaptWorkCentresToLegacy(workCentres)
  
  // Calculate dashboard metrics from real data
  const dashboardMetrics = calculateDashboardMetrics(orders, workCentres)
  
  const isLoading = ordersLoading || workCentresLoading

  /**
   * Handles moving an order from one work centre to another
   * Coordinates with the backend API and refreshes local data
   * @param orderId - Legacy string ID of the order to move
   * @param newWorkCentreCode - Target work centre code (legacy format)
   */
  const handleOrderMove = async (orderId: string, newWorkCentreCode: string) => {
    try {
      console.log('[Dashboard] Starting order move:', { orderId, newWorkCentreCode });
      
      const orderIdNum = parseInt(orderId)
      if (isNaN(orderIdNum)) {
        console.error('[Dashboard] Invalid order ID:', orderId);
        toast.error('Invalid order ID')
        return
      }
      
      const workCentreId = getWorkCentreIdFromCode(newWorkCentreCode, workCentres)
      
      if (!workCentreId) {
        console.error('[Dashboard] Work centre not found:', newWorkCentreCode);
        toast.error('Invalid work centre')
        return
      }
      
      console.log('[Dashboard] Moving order:', { orderIdNum, workCentreId });
      await ordersService.move(orderIdNum, workCentreId, 'Moved via planning board')
      
      console.log('[Dashboard] Order moved successfully, refreshing data');
      // Refresh data to get updated state
      await Promise.all([refetchOrders(), refetchWorkCentres()])
      
      toast.success('Order moved successfully')
    } catch (error: any) {
      console.error('[Dashboard] Order move failed:', {
        orderId,
        newWorkCentreCode,
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
        return <DashboardOverview metrics={dashboardMetrics} recentOrders={legacyOrders} onNavigate={setCurrentPage} />
      case "planning":
        return <PlanningBoard orders={legacyOrders} workCentres={legacyWorkCentres} originalWorkCentres={workCentres} onOrderMove={handleOrderMove} onNavigate={setCurrentPage} onWorkCentreUpdate={refetchWorkCentres} />
      case "workcentres":
        return <WorkCentresManagement workCentres={legacyWorkCentres} originalWorkCentres={workCentres} onWorkCentreUpdate={handleWorkCentreUpdate} />
      case "orders":
        return <OrdersTable orders={legacyOrders} />
      case "analytics":
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Analytics page coming soon...</p>
          </div>
        )
      case "settings":
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Settings page coming soon...</p>
          </div>
        )
      default:
        return <DashboardOverview metrics={dashboardMetrics} recentOrders={legacyOrders} onNavigate={setCurrentPage} />
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Manufacturing</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{getPageTitle()}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">{renderCurrentPage()}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
