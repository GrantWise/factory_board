"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "./components/app-sidebar"
import { DashboardOverview } from "./components/dashboard-overview"
import { PlanningBoard } from "./components/planning-board"
import { OrdersTable } from "./components/orders-table"
import { WorkCentresManagement } from "./components/work-centres-management"
import { ThemeToggle } from "./components/theme-toggle"
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
import { useApiData } from "./hooks/use-api-data"
import { ordersService, workCentresService } from "./lib/api-services"
import { 
  adaptOrdersToLegacy, 
  adaptWorkCentresToLegacy, 
  calculateDashboardMetrics,
  transformPlanningBoardData,
  getWorkCentreIdFromCode,
} from "./lib/data-adapters"
import type { 
  ManufacturingOrder, 
  WorkCentre, 
  LegacyManufacturingOrder, 
  LegacyWorkCentre,
  DashboardMetrics 
} from "./types/manufacturing"
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

  const handleOrderMove = async (orderId: string, newWorkCentreCode: string) => {
    try {
      const orderIdNum = parseInt(orderId)
      const workCentreId = getWorkCentreIdFromCode(newWorkCentreCode, workCentres)
      
      if (!workCentreId) {
        toast.error('Invalid work centre')
        return
      }
      
      await ordersService.move(orderIdNum, workCentreId, 'Moved via planning board')
      
      // Refresh data to get updated state
      await Promise.all([refetchOrders(), refetchWorkCentres()])
      
      toast.success('Order moved successfully')
    } catch (error: any) {
      toast.error(error.error || 'Failed to move order')
    }
  }

  const handleWorkCentreUpdate = async (updatedCentres: LegacyWorkCentre[]) => {
    try {
      // Note: This is called when work centres are modified locally
      // The individual operations (create, update, delete) should handle API calls
      // This is just a refresh to get the latest state
      await refetchWorkCentres()
      toast.success('Work centres updated successfully')
    } catch (error: any) {
      toast.error(error.error || 'Failed to update work centres')
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
        return <PlanningBoard orders={legacyOrders} workCentres={legacyWorkCentres} originalWorkCentres={workCentres} onOrderMove={handleOrderMove} onNavigate={setCurrentPage} />
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
