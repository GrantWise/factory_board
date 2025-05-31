"use client"

import { useState } from "react"
import { useWebSocket } from "@/hooks/use-websocket"
import { useNotifications } from "@/hooks/use-notifications"
import type { ManufacturingOrder } from "@/types/manufacturing"
import { DragStartEvent, DragEndEvent, DragOverEvent } from "@dnd-kit/core"

interface UseDragAndDropProps {
  currentUser: { id: string; name: string }
  onOrderMove?: (orderId: string, newWorkCentre: string) => void
}

interface UseDragAndDropReturn {
  handleDragStart: (event: DragStartEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
  handleDragOver: (event: DragOverEvent) => void
  isDragging: boolean
  draggedOrder: ManufacturingOrder | null
  activeOrderId: string | null
}

export function useDragAndDrop({ currentUser, onOrderMove }: UseDragAndDropProps): UseDragAndDropReturn {
  const { socket, lockedOrders } = useWebSocket(currentUser)
  const { showNotification } = useNotifications()
  const [isDragging, setIsDragging] = useState(false)
  const [draggedOrder, setDraggedOrder] = useState<ManufacturingOrder | null>(null)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)

  const handleDragStart = (event: DragStartEvent): void => {
    const { active } = event
    const orderId = active.id as string
    const orderData = active.data.current as ManufacturingOrder

    // Check if order is locked by another user
    if (lockedOrders.has(orderId)) {
      showNotification("This order is being moved by another user", "warning")
      return
    }

    try {
      // In a real implementation, this would call the API
      // For demo purposes, we'll simulate the API call
      console.log(`Locking order ${orderId} for user ${currentUser.name}`)

      // Simulate WebSocket notification to other users
      if (socket) {
        // socket.emit('start_drag', {
        //   orderId: orderId,
        //   orderNumber: orderData.orderNumber,
        //   userName: currentUser.name
        // });
      }

      setIsDragging(true)
      setDraggedOrder(orderData)
      setActiveOrderId(orderId)
    } catch (error) {
      console.error("Failed to lock order:", error)
      showNotification("Failed to start moving order", "error")
    }
  }

  const handleDragOver = (_event: DragOverEvent): void => {
    // Handle drag over logic if needed
    // This is useful for visual feedback during drag
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    
    try {
      if (over && active.id !== over.id) {
        const orderId = active.id as string
        const targetWorkCentreId = over.id as string
        
        // Call the order move callback
        if (onOrderMove) {
          onOrderMove(orderId, targetWorkCentreId)
        }

        console.log(`Moving order ${orderId} to work centre ${targetWorkCentreId}`)
        
        showNotification("Order moved successfully", "success")
      }

      // Always release the lock and reset state
      console.log(`Unlocking order ${activeOrderId}`)

      // Simulate WebSocket notification to other users
      if (socket) {
        // socket.emit('end_drag', {
        //   orderId: activeOrderId,
        //   completed: !!over
        // });
      }

    } catch (error: unknown) {
      const err = error as { status?: number }
      if (err.status === 423) {
        showNotification("This order is currently being moved by another user", "error")
      } else {
        console.error("Failed to move order:", error)
        showNotification("Failed to complete order move", "error")
      }
    } finally {
      // Always reset drag state
      setIsDragging(false)
      setDraggedOrder(null)
      setActiveOrderId(null)
    }
  }

  return { 
    handleDragStart, 
    handleDragEnd, 
    handleDragOver,
    isDragging, 
    draggedOrder,
    activeOrderId
  }
}