"use client"
import { notify } from "@/lib/notifications"
import { type AppError } from "@/lib/error-handling"
import { toast } from "sonner"

interface UseNotificationsReturn {
  showNotification: (message: string, type?: "info" | "warning" | "error" | "success") => void
  handleApiError: (error: AppError, context?: string) => void
}

export function useNotifications(): UseNotificationsReturn {
  const showNotification = (message: string, type: "info" | "warning" | "error" | "success" = "info") => {
    switch (type) {
      case "error":
        notify.error(message)
        break
      case "warning":
        notify.warning(message)
        break
      case "success":
        toast.success(message)
        break
      case "info":
      default:
        notify.info(message)
        break
    }
  }

  const handleApiError = (error: AppError, context = "") => {
    if (error.status === 423) {
      const lockMessage = error.details?.lockedBy && error.details?.orderNumber 
        ? `Cannot move order: ${error.details.lockedBy} is currently moving ${error.details.orderNumber}`
        : "Order is currently locked by another user"
      notify.warning(lockMessage)
    } else if (error.status === 409) {
      notify.error("Order was modified by another user. Please refresh and try again.")
    } else {
      notify.error(error, {
        operation: context || 'operation',
        entity: 'order'
      })
    }
  }

  return { showNotification, handleApiError }
}
