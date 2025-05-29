"use client"
import { toast } from "@/components/ui/use-toast"

interface UseNotificationsReturn {
  showNotification: (message: string, type?: "info" | "warning" | "error" | "success") => void
  handleApiError: (error: any, context?: string) => void
}

export function useNotifications(): UseNotificationsReturn {
  const showNotification = (message: string, type: "info" | "warning" | "error" | "success" = "info") => {
    toast({
      title: type.charAt(0).toUpperCase() + type.slice(1),
      description: message,
      variant: type === "error" ? "destructive" : "default",
    })
  }

  const handleApiError = (error: any, context = "") => {
    if (error.status === 423) {
      showNotification(
        `Cannot move order: ${error.data.lockedBy} is currently moving ${error.data.orderNumber}`,
        "warning",
      )
    } else if (error.status === 409) {
      showNotification("Order was modified by another user. Please refresh and try again.", "error")
    } else {
      showNotification(`Failed to ${context}: ${error.message}`, "error")
    }
  }

  return { showNotification, handleApiError }
}
