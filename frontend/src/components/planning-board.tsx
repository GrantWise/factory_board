"use client"

/**
 * PlanningBoard - Interactive drag-and-drop manufacturing planning interface
 * 
 * Provides a visual kanban-style board for managing manufacturing orders across
 * work centres. Supports real-time collaboration with WebSocket integration,
 * drag-and-drop order movement, and work centre configuration.
 * 
 * Key Features:
 * - Drag-and-drop order movement between work centres
 * - Real-time locking to prevent conflicts during order moves
 * - Work centre column reordering with backend persistence
 * - Live user presence indicators
 * - Responsive grid layout for different screen sizes
 * 
 * Real-time Collaboration:
 * - Orders are locked when being moved by users
 * - Visual indicators show which user is moving an order
 * - WebSocket connection displays online users
 * 
 * Data Flow:
 * - Receives legacy format data from parent Dashboard component
 * - Converts legacy IDs to numeric IDs for API calls
 * - Updates are pushed to backend and trigger data refresh
 */

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Plus, GripVertical } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { OrderCard } from "@/components/order-card"
import { OnlineUsersIndicator } from "@/components/online-users-indicator"
import { useWebSocket } from "@/hooks/use-websocket"
import { useDragAndDrop } from "@/hooks/use-drag-and-drop"
import { workCentresService } from "@/lib/api-services"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
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
  /** Manufacturing orders in API format for display */
  orders: ManufacturingOrder[]
  /** Work centres in API format for display */
  workCentres: WorkCentre[]
  /** Callback when an order is moved between work centres */
  onOrderMove?: (orderId: number, newWorkCentreId: number) => void
  /** Callback for page navigation */
  onNavigate?: (page: string) => void
  /** Callback to refresh work centres data after reordering */
  onWorkCentreUpdate?: () => Promise<void>
}

// Mock current user for demo
const currentUser = {
  id: "user-1",
  name: "John Doe",
}

/**
 * DraggableWorkCentreItem - Sortable work centre item for column configuration
 * 
 * Used within the configuration dialog to allow users to reorder work centre
 * columns via drag and drop. Shows work centre name and current job count.
 */
function DraggableWorkCentreItem({ 
  workCentre, 
  index, 
  jobCount 
}: { 
  workCentre: WorkCentre
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

/**
 * DraggableOrderCard - Individual order card with drag-and-drop capability
 * 
 * Wraps the OrderCard component with drag-and-drop functionality using dnd-kit.
 * Handles locking states to prevent movement when order is being moved by another user.
 */
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

/**
 * DroppableWorkCentre - Work centre column that can receive dropped orders
 * 
 * Represents a work centre as a vertical column containing orders.
 * Provides drop zone for order movement and displays work centre information.
 * Includes context menu for work centre actions.
 */
function DroppableWorkCentre({ 
  workCentre, 
  orders, 
  isOver,
  isOrderLocked,
  getOrderLockInfo,
  activeOrderId,
  onNavigate,
  setViewDetailsWorkCentre,
  setClearJobsWorkCentre,
  getOrdersForWorkCentre
}: {
  workCentre: WorkCentre
  orders: ManufacturingOrder[]
  isOver: boolean
  isOrderLocked: (orderId: number) => boolean
  getOrderLockInfo: (orderId: number) => string
  activeOrderId: number | null
  onNavigate?: (page: string) => void
  setViewDetailsWorkCentre: (workCentre: WorkCentre) => void
  setClearJobsWorkCentre: (workCentre: WorkCentre) => void
  getOrdersForWorkCentre: (workCentreId: number) => ManufacturingOrder[]
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
              <DropdownMenuItem onClick={() => setViewDetailsWorkCentre(workCentre)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setClearJobsWorkCentre(workCentre)}
                disabled={getOrdersForWorkCentre(workCentre.id).length === 0}
              >
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

export function PlanningBoard({ orders, workCentres, onOrderMove, onNavigate, onWorkCentreUpdate }: PlanningBoardProps) {
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
  const [viewDetailsWorkCentre, setViewDetailsWorkCentre] = useState<WorkCentre | null>(null)
  const [clearJobsWorkCentre, setClearJobsWorkCentre] = useState<WorkCentre | null>(null)
  const [workCentreOrder, setWorkCentreOrder] = useState<WorkCentre[]>(() => 
    [...workCentres].sort((a, b) => a.display_order - b.display_order)
  )

  // Sync workCentreOrder when workCentres prop changes (e.g., after reorder)
  useEffect(() => {
    setWorkCentreOrder([...workCentres].sort((a, b) => a.display_order - b.display_order))
  }, [workCentres])

  /**
   * Handles drag-and-drop reordering of work centre columns
   * Updates local state immediately for responsive UI
   * @param event - DragEndEvent from dnd-kit
   */
  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || active.id === over.id) {
      return
    }

    setWorkCentreOrder((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      
      const newItems = arrayMove(items, oldIndex, newIndex)
      
      // Update the display_order property
      return newItems.map((item, index) => ({
        ...item,
        display_order: index + 1
      }))
    })
  }


  /**
   * Persists work centre column order to backend
   * Includes comprehensive error handling and user feedback
   * Validates permissions and authentication before saving
   */
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

      console.log('User:', user)
      console.log('Has work_centres:write permission:', hasPermission('work_centres:write'))
      console.log('Work centre order:', workCentreOrder)

      // Map work centres to API format for reordering
      const reorderData = workCentreOrder
        .map((wc) => {
          console.log(`Mapping ${wc.id} (${wc.name}) order:`, wc.display_order)
          console.log('Types:', typeof wc.id, typeof wc.display_order)
          return { id: Number(wc.id), display_order: Number(wc.display_order) }
        })

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
      
      // Trigger immediate refresh of work centres data from parent
      if (onWorkCentreUpdate) {
        await onWorkCentreUpdate()
      }
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

  const getOrdersForWorkCentre = (workCentreId: number) => {
    return orders.filter((order) => order.current_work_centre_id === workCentreId)
  }

  const isOrderLocked = (orderId: number) => {
    return lockedOrders.has(orderId.toString())
  }

  const getOrderLockInfo = (orderId: number) => {
    const lockingUser = connectedUsers.find((user) => user.lockingOrder === orderId.toString())
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

  // Sort work centres by display_order
  const sortedWorkCentres = [...workCentres].sort((a, b) => a.display_order - b.display_order)
  const activeWorkCentres = sortedWorkCentres.filter((workCentre) => workCentre.is_active)
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
                      setWorkCentreOrder([...workCentres].sort((a, b) => a.display_order - b.display_order))
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

      {/* Work Centre Details Modal */}
      <Dialog open={!!viewDetailsWorkCentre} onOpenChange={() => setViewDetailsWorkCentre(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Work Centre Details</DialogTitle>
          </DialogHeader>
          {viewDetailsWorkCentre && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Basic Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-medium">{viewDetailsWorkCentre.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        viewDetailsWorkCentre.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {viewDetailsWorkCentre.is_active ? '🟢 Active' : '🔴 Inactive'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Capacity:</span>
                      <span className="font-medium">{viewDetailsWorkCentre.capacity} jobs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current Jobs:</span>
                      <span className="font-medium">{viewDetailsWorkCentre.current_jobs} jobs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Utilization:</span>
                      <span className="font-medium">
                        {Math.round((viewDetailsWorkCentre.current_jobs / viewDetailsWorkCentre.capacity) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Machines</h3>
                  <div className="space-y-1">
                    {viewDetailsWorkCentre.machines.length > 0 ? (
                      viewDetailsWorkCentre.machines.map((machine, index) => (
                        <div key={index} className="px-2 py-1 bg-gray-100 rounded text-sm">
                          {machine.name}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">No machines assigned</p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Current Orders */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Current Orders</h3>
                <div className="border rounded-lg">
                  {getOrdersForWorkCentre(viewDetailsWorkCentre.id).length > 0 ? (
                    <div className="max-h-60 overflow-y-auto">
                      {getOrdersForWorkCentre(viewDetailsWorkCentre.id).map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                          <div>
                            <p className="font-medium text-sm">{order.order_number}</p>
                            <p className="text-xs text-gray-600">{order.stock_code} - {order.description}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm">
                              {order.quantity_completed}/{order.quantity_to_make}
                            </div>
                            <div className="text-xs text-gray-500">
                              {Math.round((order.quantity_completed / order.quantity_to_make) * 100)}% complete
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      No orders currently assigned
                    </div>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  onClick={() => {
                    setViewDetailsWorkCentre(null)
                    onNavigate?.('workcentres')
                  }}
                  className="flex-1"
                >
                  Edit Work Centre
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setViewDetailsWorkCentre(null)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Clear All Jobs Confirmation Modal */}
      <Dialog open={!!clearJobsWorkCentre} onOpenChange={() => setClearJobsWorkCentre(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Jobs</DialogTitle>
          </DialogHeader>
          {clearJobsWorkCentre && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to clear all jobs from <strong>{clearJobsWorkCentre.name}</strong>?
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>This action will:</strong>
                </p>
                <ul className="text-sm text-yellow-700 mt-1 ml-4 list-disc">
                  <li>Move {getOrdersForWorkCentre(clearJobsWorkCentre.id).length} orders to &quot;Unassigned&quot; status</li>
                  <li>Remove all orders from this work centre</li>
                  <li>Allow you to reassign them later</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Orders will not be deleted, only moved to the &quot;Unassigned&quot; area 
                  where they can be reassigned to other work centres.
                </p>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="destructive"
                  onClick={async () => {
                    try {
                      const ordersToMove = getOrdersForWorkCentre(clearJobsWorkCentre.id)
                      
                      // Move all orders to "unassigned" status
                      for (const order of ordersToMove) {
                        // Use the existing onOrderMove function with null work centre ID for unassigned
                        await onOrderMove?.(order.id, 0) // 0 or null for unassigned
                      }
                      
                      setClearJobsWorkCentre(null)
                      toast.success(`Cleared ${ordersToMove.length} jobs from ${clearJobsWorkCentre.name}`)
                    } catch (error: any) {
                      console.error('Failed to clear jobs:', error)
                      toast.error('Failed to clear jobs. Please try again.')
                    }
                  }}
                  className="flex-1"
                >
                  Clear All Jobs
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setClearJobsWorkCentre(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              const isOver = overId === workCentre.id.toString()

              return (
                <DroppableWorkCentre
                  key={workCentre.id}
                  workCentre={workCentre}
                  orders={workCentreOrders}
                  isOver={isOver}
                  isOrderLocked={isOrderLocked}
                  getOrderLockInfo={getOrderLockInfo}
                  activeOrderId={activeOrderId}
                  onNavigate={onNavigate}
                  setViewDetailsWorkCentre={setViewDetailsWorkCentre}
                  setClearJobsWorkCentre={setClearJobsWorkCentre}
                  getOrdersForWorkCentre={getOrdersForWorkCentre}
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