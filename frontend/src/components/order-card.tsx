"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Package, Wrench, Lock } from "lucide-react"
import type { ManufacturingOrder } from "@/types/manufacturing"
import { cn } from "@/lib/utils"

interface OrderCardProps {
  order: ManufacturingOrder
  isDragging?: boolean
  isLocked?: boolean
  lockedBy?: string
}

export function OrderCard({ order, isDragging, isLocked, lockedBy }: OrderCardProps) {
  const completionPercentage = (order.quantity_completed / order.quantity_to_make) * 100

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "not_started":
        return (
          <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-100">
            Not Started
          </Badge>
        )
      case "in_progress":
        return <Badge className="text-xs bg-blue-500 hover:bg-blue-500">In Progress</Badge>
      case "complete":
        return <Badge className="text-xs bg-green-500 hover:bg-green-500">Complete</Badge>
      case "overdue":
        return <Badge className="text-xs bg-red-500 hover:bg-red-500">Delayed</Badge>
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            Unknown
          </Badge>
        )
    }
  }

  const getProgressBarColor = (status: string, percentage: number) => {
    if (status === "overdue") return "bg-red-500"
    if (status === "complete") return "bg-green-500"
    if (percentage > 75) return "bg-green-500"
    if (percentage > 50) return "bg-yellow-500"
    if (percentage > 25) return "bg-orange-500"
    return "bg-gray-300"
  }

  const getDueDays = () => {
    const today = new Date()
    const dueDate = new Date(order.due_date || '')
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return "Overdue"
    if (diffDays === 0) return "Due today"
    if (diffDays === 1) return "Due tomorrow"
    return `${diffDays} days`
  }

  return (
    <Card
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md bg-white border border-gray-200 relative",
        isDragging && "opacity-50 rotate-1 shadow-lg",
        isLocked && "opacity-60 cursor-not-allowed border-red-300 bg-red-50",
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header with Order Number and Status */}
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-gray-900">{order.order_number}</h3>
          {isLocked ? (
            <div className="flex items-center gap-1 text-red-600">
              <Lock className="h-3 w-3" />
              <span className="text-xs">{lockedBy}</span>
            </div>
          ) : (
            getStatusBadge(order.status)
          )}
        </div>

        {/* Description */}
        <div>
          <p className="text-sm font-medium text-gray-700">{order.description}</p>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              <span>{order.stock_code}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>
                {order.quantity_completed} / {order.quantity_to_make}
              </span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium text-gray-900">{Math.round(completionPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                getProgressBarColor(order.status, completionPercentage),
              )}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Current Operation */}
        <div className="flex items-center gap-1 text-sm">
          <Wrench className="h-3 w-3 text-gray-500" />
          <span className="text-gray-600">Op:</span>
          <span className="font-medium text-gray-900">{order.current_operation}</span>
        </div>

        {/* Time indicator */}
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          <span>Due: {getDueDays()}</span>
        </div>

        {/* Lock overlay when order is being moved by someone else */}
        {isLocked && (
          <div className="absolute inset-0 bg-red-100 bg-opacity-75 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <Lock className="mx-auto mb-1 text-red-600" size={20} />
              <div className="text-xs text-red-800 font-medium">{lockedBy} is moving this</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
