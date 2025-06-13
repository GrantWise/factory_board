/**
 * Utility functions for order-related operations
 * Extracted from order-card.tsx for better separation of concerns
 */

import type { ManufacturingOrder } from "@/types/manufacturing"

/**
 * Get the appropriate status badge variant and classes for an order status
 */
export function getStatusBadgeConfig(status: string) {
  switch (status) {
    case "not_started":
      return {
        variant: "secondary" as const,
        className: "text-xs bg-gray-100 text-gray-700 hover:bg-gray-100",
        label: "Not Started"
      }
    case "in_progress":
      return {
        variant: "default" as const,
        className: "text-xs bg-blue-500 hover:bg-blue-500",
        label: "In Progress"
      }
    case "complete":
      return {
        variant: "default" as const,
        className: "text-xs bg-green-500 hover:bg-green-500",
        label: "Complete"
      }
    case "overdue":
      return {
        variant: "default" as const,
        className: "text-xs bg-red-500 hover:bg-red-500",
        label: "Delayed"
      }
    default:
      return {
        variant: "secondary" as const,
        className: "text-xs",
        label: "Unknown"
      }
  }
}

/**
 * Get the appropriate progress bar color based on status and completion percentage
 */
export function getProgressBarColor(status: string, percentage: number): string {
  if (status === "overdue") return "bg-red-500"
  if (status === "complete") return "bg-green-500"
  if (percentage > 75) return "bg-green-500"
  if (percentage > 50) return "bg-yellow-500"
  if (percentage > 25) return "bg-orange-500"
  return "bg-gray-300"
}

/**
 * Calculate and format due date display text
 */
export function getDueDays(dueDate: string | null | undefined): string {
  if (!dueDate) return "No due date"
  
  const today = new Date()
  const due = new Date(dueDate)
  const diffTime = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "Overdue"
  if (diffDays === 0) return "Due today"
  if (diffDays === 1) return "Due tomorrow"
  return `${diffDays} days`
}

/**
 * Priority mapping for consistent ordering
 */
export const PRIORITY_ORDER: Record<ManufacturingOrder['priority'], number> = {
  'urgent': 4,
  'high': 3,
  'medium': 2,
  'low': 1
}

/**
 * Status order for consistent display
 */
export const STATUS_ORDER: Record<string, number> = {
  'not_started': 1,
  'in_progress': 2,
  'complete': 3,
  'overdue': 4,
  'on_hold': 5,
  'cancelled': 6
}