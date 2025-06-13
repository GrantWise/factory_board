"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Package, Wrench, Lock, ChevronDown, ChevronUp } from "lucide-react"
import type { ManufacturingOrder, UserCharacteristicSettings } from "@/types/manufacturing"
import { cn } from "@/lib/utils"
import { getStatusBadgeConfig, getProgressBarColor, getDueDays } from "@/lib/order-utils"

interface OrderCardProps {
  order: ManufacturingOrder
  isDragging?: boolean
  isLocked?: boolean
  lockedBy?: string
  onClick?: () => void
  characteristicSettings?: UserCharacteristicSettings
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function OrderCard({ order, isDragging, isLocked, lockedBy, onClick, characteristicSettings, isCollapsed = false, onToggleCollapse }: OrderCardProps) {
  const completionPercentage = (order.quantity_completed / order.quantity_to_make) * 100
  
  // Get characteristics for visual display
  const characteristics = order.job_characteristics || []
  const primaryChar = characteristics.find(c => 
    c.type === characteristicSettings?.primaryCharacteristic
  )
  const secondaryChar = characteristics.find(c => 
    c.type === characteristicSettings?.secondaryCharacteristic
  )
  
  const showCharacteristics = characteristicSettings?.enabled && (primaryChar || secondaryChar)

  return (
    <Card
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md bg-white border border-gray-200 relative",
        isDragging && "opacity-50 rotate-1 shadow-lg",
        isLocked && "opacity-60 cursor-not-allowed border-red-300 bg-red-50",
      )}
      style={{
        // Primary characteristic as card background tint
        backgroundColor: primaryChar ? `${primaryChar.color}08` : undefined
      }}
    >
      {/* Primary characteristic color stripe at top */}
      {showCharacteristics && primaryChar && (
        <div 
          className="h-2 w-full rounded-t-md"
          style={{ backgroundColor: primaryChar.color }}
        />
      )}
      
      {/* Secondary characteristic color band on left edge */}
      {showCharacteristics && secondaryChar && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
          style={{ backgroundColor: secondaryChar.color }}
        />
      )}
      
      <CardContent className={cn(
        "p-4 space-y-3",
        showCharacteristics && secondaryChar && "ml-1" // Add margin if secondary char band is shown
      )}>
        {/* Header with Order Number and Status */}
        <div className="flex items-start justify-between">
          <h3 
            className={cn(
              "font-semibold text-gray-900",
              onClick && "cursor-pointer hover:text-blue-600 transition-colors"
            )}
            onClick={onClick ? (e) => {
              e.stopPropagation()
              onClick()
            } : undefined}
          >
            {order.order_number}
          </h3>
          <div className="flex items-center gap-1">
            {isLocked ? (
              <div className="flex items-center gap-1 text-red-600">
                <Lock className="h-3 w-3" />
                <span className="text-xs">{lockedBy}</span>
              </div>
            ) : (
              (() => {
                const config = getStatusBadgeConfig(order.status)
                return (
                  <Badge variant={config.variant} className={config.className}>
                    {config.label}
                  </Badge>
                )
              })()
            )}
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleCollapse()
                }}
                className="h-6 w-6 p-0 ml-1"
                title={isCollapsed ? "Expand card" : "Collapse card"}
              >
                {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              </Button>
            )}
          </div>
        </div>

        {/* Essential info in collapsed state: Priority and Due Date */}
        {isCollapsed ? (
          <div className="flex items-center justify-between text-sm">
            <Badge variant={
              order.priority === 'high' ? 'destructive' :
              order.priority === 'medium' ? 'secondary' : 'outline'
            } className="text-xs">
              {order.priority}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>Due: {getDueDays(order.due_date)}</span>
            </div>
          </div>
        ) : (
          <>
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

            {/* Characteristic badges (when enabled) */}
            {showCharacteristics && (primaryChar || secondaryChar) && (
              <div className="flex gap-1 flex-wrap">
                {primaryChar && (
                  <Badge 
                    variant="secondary" 
                    className="text-xs"
                    style={{ 
                      backgroundColor: `${primaryChar.color}20`,
                      color: primaryChar.color,
                      borderColor: primaryChar.color
                    }}
                  >
                    {primaryChar.display_name || primaryChar.value}
                  </Badge>
                )}
                {secondaryChar && (
                  <Badge 
                    variant="outline" 
                    className="text-xs"
                    style={{ 
                      borderColor: secondaryChar.color,
                      color: secondaryChar.color
                    }}
                  >
                    {secondaryChar.display_name || secondaryChar.value}
                  </Badge>
                )}
              </div>
            )}

            {/* Time indicator */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>Due: {getDueDays(order.due_date)}</span>
            </div>
          </>
        )}

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
