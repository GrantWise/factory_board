"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Package, TrendingUp, Activity, Target, AlertTriangle, Clock } from "lucide-react"
import type { DashboardMetrics } from "@/types/manufacturing"

interface AnalyticsCardsProps {
  metrics: DashboardMetrics
}

export function AnalyticsCards({ metrics }: AnalyticsCardsProps) {
  const productionPercentage = (metrics.daily_production / metrics.daily_target) * 100

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary-blue">{metrics.total_active_orders}</div>
          <p className="text-xs text-muted-foreground">Manufacturing orders</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{metrics.completion_rate}%</div>
          <Progress value={metrics.completion_rate} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Work Centre Utilization</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary-blue">{metrics.work_centre_utilization}%</div>
          <Progress value={metrics.work_centre_utilization} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Daily Production</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.daily_production}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">Target: {metrics.daily_target}</span>
            <Progress value={productionPercentage} className="flex-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overdue Orders</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{metrics.overdue_orders}</div>
          {metrics.overdue_orders > 0 && (
            <Badge variant="destructive" className="mt-2">
              Attention Required
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Cycle Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.average_cycle_time}</div>
          <p className="text-xs text-muted-foreground">days</p>
        </CardContent>
      </Card>
    </div>
  )
}
