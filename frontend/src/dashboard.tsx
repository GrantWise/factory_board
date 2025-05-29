"use client"

import { useState } from "react"
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
import { sampleOrders, workCentres, dashboardMetrics } from "./data/sample-data"
import type { ManufacturingOrder, WorkCentre } from "./types/manufacturing"

export default function Dashboard() {
  const [orders, setOrders] = useState<ManufacturingOrder[]>(sampleOrders)
  const [centres, setCentres] = useState<WorkCentre[]>(workCentres)
  const [currentPage, setCurrentPage] = useState("dashboard")

  const handleOrderMove = (orderId: string, newWorkCentre: string) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) => (order.id === orderId ? { ...order, workCentre: newWorkCentre } : order)),
    )

    // Update work centre job counts
    setCentres((prevCentres) =>
      prevCentres.map((centre) => ({
        ...centre,
        currentJobs: orders.filter((order) => order.workCentre === centre.id).length,
      })),
    )
  }

  const handleWorkCentreUpdate = (updatedCentres: WorkCentre[]) => {
    setCentres(updatedCentres)
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
    switch (currentPage) {
      case "dashboard":
        return <DashboardOverview metrics={dashboardMetrics} recentOrders={orders} onNavigate={setCurrentPage} />
      case "planning":
        return <PlanningBoard orders={orders} workCentres={centres} onOrderMove={handleOrderMove} />
      case "workcentres":
        return <WorkCentresManagement workCentres={centres} onWorkCentreUpdate={handleWorkCentreUpdate} />
      case "orders":
        return <OrdersTable orders={orders} />
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
        return <DashboardOverview metrics={dashboardMetrics} recentOrders={orders} onNavigate={setCurrentPage} />
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
