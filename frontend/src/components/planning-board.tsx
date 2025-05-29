"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OrderCard } from "./order-card"
import { OnlineUsersIndicator } from "./online-users-indicator"
import { useWebSocket } from "@/hooks/use-websocket"
import { useDragAndDrop } from "@/hooks/use-drag-and-drop"
import { useNotifications } from "@/hooks/use-notifications"
import type { ManufacturingOrder, WorkCentre } from "@/types/manufacturing"
import { cn } from "@/lib/utils"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface PlanningBoardProps {
  orders: ManufacturingOrder[]
  workCentres: WorkCentre[]
  onOrderMove?: (orderId: string, newWorkCentre: string) => void
}

// Mock current user for demo
const currentUser = {
  id: "user-1",
  name: "John Doe",
}

// Draggable Order Component
function DraggableOrderCard({ 
  order, 
  isLocked, 
  lockedBy,
  isDragging 
}: { 
  order: ManufacturingOrder
  isLocked: boolean
  lockedBy?: string
  isDragging: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: order.id,
    data: order,
    disabled: isLocked,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isLocked && "cursor-not-allowed"
      )}
    >
      <OrderCard
        order={order}
        isDragging={isDragging || isSortableDragging}
        isLocked={isLocked}
        lockedBy={lockedBy}
      />
    </div>
  )
}

// Droppable Work Centre Column
function DroppableWorkCentre({ 
  workCentre, 
  orders, 
  isOver,
  isOrderLocked,
  getOrderLockInfo,
  activeOrderId
}: {
  workCentre: WorkCentre
  orders: ManufacturingOrder[]
  isOver: boolean
  isOrderLocked: (orderId: string) => boolean
  getOrderLockInfo: (orderId: string) => string
  activeOrderId: string | null
}) {
  const {
    setNodeRef,
  } = useSortable({
    id: workCentre.id,
  })

  const orderIds = orders.map(order => order.id)

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "h-fit min-h-[400px] transition-all duration-200",
        isOver && "ring-2 ring-green-500 bg-green-50",
      )}
    >
      <CardHeader className="pb-3 bg-gray-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900">
              {workCentre.name} ({orders.length} jobs)
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Settings className="h-4 w-4 text-gray-500" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {orders.length === 0 ? (
          <div
            className={cn(
              "text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg transition-colors",
              isOver ? "border-green-400 bg-green-50" : "border-gray-200",
            )}
          >
            <p className="text-sm">No orders assigned</p>
            <p className="text-xs">Drag orders here</p>
          </div>
        ) : (
          <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
            {orders.map((order) => {
              const orderLocked = isOrderLocked(order.id)
              const lockedByUser = orderLocked ? getOrderLockInfo(order.id) : undefined

              return (
                <DraggableOrderCard
                  key={order.id}
                  order={order}
                  isLocked={orderLocked}
                  lockedBy={lockedByUser}
                  isDragging={activeOrderId === order.id}
                />
              )
            })}
          </SortableContext>
        )}
      </CardContent>
    </Card>
  )
}

export function PlanningBoard({ orders, workCentres, onOrderMove }: PlanningBoardProps) {
  const { connectedUsers, lockedOrders, isConnected } = useWebSocket(currentUser)
  const { handleDragStart, handleDragEnd, handleDragOver, activeOrderId } = useDragAndDrop({ 
    currentUser, 
    onOrderMove 
  })
  // const { showNotification } = useNotifications()
  const [overId, setOverId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const getOrdersForWorkCentre = (workCentreId: string) => {
    return orders.filter((order) => order.workCentre === workCentreId)
  }

  const isOrderLocked = (orderId: string) => {
    return lockedOrders.has(orderId)
  }

  const getOrderLockInfo = (orderId: string) => {
    const lockingUser = connectedUsers.find((user) => user.lockingOrder === orderId)
    return lockingUser ? lockingUser.userName : "Another user"
  }

  const handleDragOverLocal = (event: DragOverEvent) => {
    const { over } = event
    setOverId(over?.id ? String(over.id) : null)
    handleDragOver(event)
  }

  const handleDragEndLocal = (event: DragEndEvent) => {
    setOverId(null)
    handleDragEnd(event)
  }

  // Sort work centres by order
  const sortedWorkCentres = [...workCentres].sort((a, b) => a.order - b.order)
  const activeWorkCentres = sortedWorkCentres.filter((workCentre) => workCentre.status === "active")
  const workCentreIds = activeWorkCentres.map(wc => wc.id)

  // Find the active order for drag overlay
  const activeOrder = activeOrderId ? orders.find(order => order.id === activeOrderId) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-primary-blue">Manufacturing Planning Board</h2>
          {isConnected && <OnlineUsersIndicator connectedUsers={connectedUsers} />}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configure Columns
          </Button>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Work Centre
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOverLocal}
        onDragEnd={handleDragEndLocal}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <SortableContext items={workCentreIds} strategy={verticalListSortingStrategy}>
            {activeWorkCentres.map((workCentre) => {
              const workCentreOrders = getOrdersForWorkCentre(workCentre.id)
              const isOver = overId === workCentre.id

              return (
                <DroppableWorkCentre
                  key={workCentre.id}
                  workCentre={workCentre}
                  orders={workCentreOrders}
                  isOver={isOver}
                  isOrderLocked={isOrderLocked}
                  getOrderLockInfo={getOrderLockInfo}
                  activeOrderId={activeOrderId}
                />
              )
            })}
          </SortableContext>
        </div>

        <DragOverlay>
          {activeOrder && (
            <div className="opacity-90 transform rotate-3 shadow-lg">
              <OrderCard
                order={activeOrder}
                isDragging={true}
                isLocked={false}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}