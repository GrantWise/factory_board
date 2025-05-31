"use client"

/**
 * DashboardOverview - Manufacturing dashboard homepage
 * 
 * Provides a high-level overview of manufacturing operations including
 * key metrics, recent activity feed, and quick action buttons. Serves as
 * the landing page for the manufacturing system.
 * 
 * Features:
 * - Key performance metrics display via AnalyticsCards
 * - Recent activity timeline showing order movements and completions
 * - Quick action buttons for common operations
 * - Quick stats panel with real-time calculations
 * 
 * Navigation:
 * - "Add New Order" button navigates to orders page
 * - "View Planning Board" button opens planning interface
 * - Integrates with parent navigation system
 * 
 * Data Processing:
 * - Calculates real-time statistics from order data
 * - Formats recent activity from order status changes
 * - Displays completion percentages and progress metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AnalyticsCards } from "@/components/analytics-cards"
import { Plus, Eye, Activity, Clock } from "lucide-react"
import type { DashboardMetrics, LegacyManufacturingOrder } from "@/types/manufacturing"

interface DashboardOverviewProps {
  /** Calculated dashboard metrics from data adapters */
  metrics: DashboardMetrics
  /** Recent manufacturing orders for activity display */
  recentOrders: LegacyManufacturingOrder[]
  /** Navigation callback for page routing */
  onNavigate?: (page: string) => void
}

export function DashboardOverview({ metrics, recentOrders, onNavigate }: DashboardOverviewProps) {
  const recentActivity = recentOrders.slice(0, 5).map((order) => ({
    id: order.id,
    action: order.status === "complete" ? "Completed" : "Moved to",
    order: order.orderNumber,
    location: order.workCentre || 'Unknown',
    time: "2h ago", // Mock time
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Manufacturing Dashboard</h2>
          <p className="text-gray-600">Overview of your manufacturing operations</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onNavigate?.("orders")}>
            <Plus className="h-4 w-4 mr-2" />
            Add New Order
          </Button>
          <Button variant="outline" onClick={() => onNavigate?.("planning")}>
            <Eye className="h-4 w-4 mr-2" />
            View Planning Board
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <AnalyticsCards metrics={metrics} />

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div>
                    <p className="text-sm font-medium">
                      {activity.order} {activity.action} {activity.location}
                    </p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Orders in Progress</span>
              <span className="font-semibold">{recentOrders.filter((o) => o.status === "in-progress").length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Completed Today</span>
              <span className="font-semibold">{recentOrders.filter((o) => o.status === "complete").length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Overdue Orders</span>
              <span className="font-semibold text-red-600">
                {recentOrders.filter((o) => o.status === "overdue").length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Average Progress</span>
              <span className="font-semibold">
                {Math.round(
                  recentOrders.reduce((acc, order) => acc + (order.quantityCompleted / order.quantityToMake) * 100, 0) /
                    recentOrders.length,
                )}
                %
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
