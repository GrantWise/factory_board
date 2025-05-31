"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Plus, GripVertical } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { OrderCard } from "./order-card"
import { OnlineUsersIndicator } from "./online-users-indicator"
import { useWebSocket } from "@/hooks/use-websocket"
import { useDragAndDrop } from "@/hooks/use-drag-and-drop"
import { useNotifications } from "@/hooks/use-notifications"
import { workCentresService } from "@/lib/api-services"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import type { LegacyManufacturingOrder, LegacyWorkCentre } from "@/types/manufacturing"
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
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface PlanningBoardProps {
  orders: LegacyManufacturingOrder[]
  workCentres: LegacyWorkCentre[]
  originalWorkCentres?: any[] // API work centres data for ID mapping
  onOrderMove?: (orderId: string, newWorkCentre: string) => void
  onNavigate?: (page: string) => void
}

// Mock current user for demo
const currentUser = {
  id: "user-1",
  name: "John Doe",
}

// Draggable Work Centre Item for Configure Dialog
function DraggableWorkCentreItem({ 
  workCentre, 
  index, 
  jobCount 
}: { 
  workCentre: LegacyWorkCentre
  index: number
  jobCount: number
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: workCentre.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center justify-between p-3 border rounded-lg bg-gray-50 cursor-grab active:cursor-grabbing",
        isDragging && "shadow-lg ring-2 ring-blue-500"
      )}
    >
      <div className="flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium">{index + 1}.</span>
        <span>{workCentre.name}</span>
      </div>
      <span className="text-xs text-gray-500">
        {jobCount} jobs
      </span>
    </div>
  )
}

// Draggable Order Component
function DraggableOrderCard({ 
  order, 
  isLocked, 
  lockedBy,
  isDragging 
}: { 
  order: LegacyManufacturingOrder
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
  workCentre: LegacyWorkCentre
  orders: LegacyManufacturingOrder[]
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Settings className="h-4 w-4 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onNavigate?.('workcentres')}>
                Configure Work Centre
              </DropdownMenuItem>
              <DropdownMenuItem>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                Clear All Jobs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

export function PlanningBoard({ orders, workCentres, originalWorkCentres, onOrderMove, onNavigate }: PlanningBoardProps) {
  const { user, hasPermission } = useAuth()
  const { connectedUsers, lockedOrders, isConnected } = useWebSocket(currentUser)
  const { handleDragStart, handleDragEnd, handleDragOver, activeOrderId } = useDragAndDrop({ 
    currentUser, 
    onOrderMove 
  })
  // const { showNotification } = useNotifications()
  const [overId, setOverId] = useState<string | null>(null)
  const [isConfigureDialogOpen, setIsConfigureDialogOpen] = useState(false)
  const [isAddWorkCentreDialogOpen, setIsAddWorkCentreDialogOpen] = useState(false)
  const [workCentreOrder, setWorkCentreOrder] = useState<LegacyWorkCentre[]>(() => 
    [...workCentres].sort((a, b) => a.order - b.order)
  )

  // Handle column reordering
  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || active.id === over.id) {
      return
    }

    setWorkCentreOrder((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      
      const newItems = arrayMove(items, oldIndex, newIndex)
      
      // Update the order property
      return newItems.map((item, index) => ({
        ...item,
        order: index + 1
      }))
    })
  }

  // Helper to find numeric ID from legacy code ID
  const findNumericId = (codeId: string): number | null => {
    if (!originalWorkCentres) return null
    const workCentre = originalWorkCentres.find((wc: any) => wc.code === codeId)
    return workCentre ? workCentre.id : null
  }

  // Save column order
  const handleSaveColumnOrder = async () => {
    try {
      // Check authentication and permissions first
      if (!user) {
        toast.error('Authentication required. Please log in.')
        return
      }

      if (!hasPermission('work_centres:write')) {
        toast.error('Permission denied. You do not have access to reorder work centres.')
        return
      }

      if (!originalWorkCentres) {
        toast.error('Cannot save order - missing work centre data')
        return
      }

      console.log('User:', user)
      console.log('Has work_centres:write permission:', hasPermission('work_centres:write'))
      console.log('Original work centres:', originalWorkCentres)
      console.log('Work centre order:', workCentreOrder)

      // Map legacy work centres to API format for reordering
      const reorderData = workCentreOrder
        .map((wc) => {
          const numericId = findNumericId(wc.id)
          console.log(`Mapping ${wc.id} (${wc.name}) to numeric ID:`, numericId, 'order:', wc.order)
          console.log('Types:', typeof numericId, typeof wc.order)
          return numericId ? { id: Number(numericId), display_order: Number(wc.order) } : null
        })
        .filter(Boolean) as { id: number; display_order: number }[]

      console.log('Reorder data to send:', reorderData)
      console.log('Reorder data JSON:', JSON.stringify(reorderData, null, 2))

      if (reorderData.length === 0) {
        toast.error('No valid work centres to reorder')
        return
      }

      console.log('About to call workCentresService.reorder...')
      console.log('API base URL:', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
      
      // Test authentication by making a simple API call first
      try {
        console.log('Testing authentication with work centres list...')
        const testResult = await workCentresService.getAll()
        console.log('Auth test successful, got work centres:', testResult)
      } catch (authTestError) {
        console.error('Auth test failed:', authTestError)
        throw new Error('Authentication test failed. Please log in again.')
      }
      
      try {
        const result = await workCentresService.reorder(reorderData)
        console.log('API response:', result)
      } catch (apiError) {
        console.error('API call failed:', apiError)
        console.error('API error type:', typeof apiError)
        console.error('API error constructor:', apiError?.constructor?.name)
        if (apiError instanceof Error) {
          console.error('Error message:', apiError.message)
          console.error('Error stack:', apiError.stack)
        }
        throw apiError
      }
      
      setIsConfigureDialogOpen(false)
      toast.success('Column order saved successfully')
      
      // Optionally trigger a refresh of the work centres data
      // This would be handled by the parent component
    } catch (error: any) {
      console.error('Failed to save column order:', error)
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        error: error.error,
        code: error.code,
        stack: error.stack,
        response: error.response
      })
      
      let errorMessage = 'Failed to save column order'
      if (error.status === 401 || error.code === 'INVALID_TOKEN') {
        errorMessage = 'Authentication required. Please log in again.'
      } else if (error.status === 403) {
        errorMessage = 'Permission denied. You do not have access to reorder work centres.'
      } else if (error.status === 0) {
        errorMessage = 'Network error. Please check your connection and try again.'
      } else if (error.error) {
        errorMessage = error.error
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage)
    }
  }

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
          <Dialog open={isConfigureDialogOpen} onOpenChange={setIsConfigureDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configure Columns
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Configure Column Order</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Drag and drop work centres to reorder the columns on the planning board.
                </p>
                
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleColumnDragEnd}
                >
                  <SortableContext 
                    items={workCentreOrder.map(wc => wc.id)} 
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {workCentreOrder.map((workCentre, index) => (
                        <DraggableWorkCentreItem
                          key={workCentre.id}
                          workCentre={workCentre}
                          index={index}
                          jobCount={getOrdersForWorkCentre(workCentre.id).length}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    onClick={handleSaveColumnOrder}
                    disabled={!user || !hasPermission('work_centres:write')}
                    className="flex-1"
                  >
                    Save Order
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setWorkCentreOrder([...workCentres].sort((a, b) => a.order - b.order))
                      setIsConfigureDialogOpen(false)
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
                
                {(!user || !hasPermission('work_centres:write')) && (
                  <p className="text-xs text-red-500 mt-2">
                    You need work centre write permissions to save changes.
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isAddWorkCentreDialogOpen} onOpenChange={setIsAddWorkCentreDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Work Centre
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Work Centre</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  To add a new work centre, please use the Work Centres management page from the sidebar.
                </p>
                <Button 
                  onClick={() => {
                    setIsAddWorkCentreDialogOpen(false)
                    onNavigate?.('workcentres')
                  }}
                  className="w-full"
                >
                  Go to Work Centres Management
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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