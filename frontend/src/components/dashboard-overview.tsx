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
 * - Navigation to planning board available via sidebar menu
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
import { Plus, Activity, Clock } from "lucide-react"
import { useApiData } from "@/hooks/use-api-data"
import { analyticsService } from "@/lib/api-services"
import type { DashboardMetrics, ManufacturingOrder, WorkCentre } from "@/types/manufacturing"

interface DashboardOverviewProps {
  /** Calculated dashboard metrics from API data */
  metrics: DashboardMetrics
  /** Recent manufacturing orders for activity display */
  recentOrders: ManufacturingOrder[]
  /** Work centres for resolving work centre names */
  workCentres: WorkCentre[]
  /** Navigation callback for page routing */
  onNavigate?: (page: string) => void
}

export function DashboardOverview({ metrics, recentOrders, workCentres, onNavigate }: DashboardOverviewProps) {
  // Fetch real-time recent activity from audit logs
  const { data: recentActivityData, isLoading: isLoadingActivity } = useApiData(
    () => analyticsService.getRecentActivity(5),
    [],
    { autoRefresh: 30000 }
  )

  // Use real activity data if available, otherwise fall back to order-based mock data
  const recentActivity = recentActivityData?.recent_activity?.map((activity) => {
    let action = 'Unknown action'
    let location = 'Unknown location'
    
    if (activity.event_type === 'order_moved') {
      action = `Moved to`
      location = activity.to_work_centre_name || 'Unknown'
    } else if (activity.event_type === 'order_created') {
      action = 'Created at'
      location = activity.to_work_centre_name || 'Backlog'
    } else if (activity.event_type === 'order_completed') {
      action = 'Completed at'
      location = activity.to_work_centre_name || 'Complete'
    } else if (activity.event_type === 'order_status_changed') {
      action = `Status changed`
      location = activity.to_work_centre_name || 'Various'
    }
    
    return {
      id: activity.id,
      action,
      order: activity.order_number || 'Unknown Order',
      location,
      time: activity.time_ago || 'Unknown time',
    }
  }) || recentOrders.slice(0, 5).map((order) => {
    // Fallback to mock data based on orders
    const workCentre = workCentres.find(wc => wc.id === order.current_work_centre_id)
    const workCentreName = workCentre ? workCentre.name : 'No Work Centre Assigned'
    
    return {
      id: order.id,
      action: order.status === "complete" ? "Completed" : "Moved to",
      order: order.order_number,
      location: workCentreName,
      time: "2h ago", // Mock time
    }
  })

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
            {isLoadingActivity ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading activity...</p>
                </div>
              </div>
            ) : recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
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
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-600">No recent activity</p>
              </div>
            )}
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
              <span className="font-semibold">{recentOrders.filter((o) => o.status === "in_progress").length}</span>
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
                  recentOrders.reduce((acc, order) => acc + (order.quantity_completed / order.quantity_to_make) * 100, 0) /
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
