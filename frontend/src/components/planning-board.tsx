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
 * - Intra-column reordering of orders within work centres
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

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Plus, GripVertical } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { OrderCard } from "@/components/order-card"
import { OnlineUsersIndicator } from "@/components/online-users-indicator"
import { useWebSocket } from "@/hooks/use-websocket"
import { workCentresService, ordersService } from "@/lib/api-services"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import type { ManufacturingOrder, WorkCentre } from "@/types/manufacturing"
import { cn } from "@/lib/utils"
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder"
// import DropIndicator from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator"

// TypeScript interfaces for drag events
interface DragData {
  type: 'order' | 'work-centre'
  id: number
  sourceColumnId?: number
  sourceIndex?: number
  [key: string | symbol]: unknown
}

interface DropData {
  type: 'column' | 'card-list'
  columnId: number
  index?: number
  insertionPoint?: 'before' | 'after' | 'replace'
  [key: string | symbol]: unknown
}

interface PlanningBoardProps {
  /** Manufacturing orders in API format for display */
  orders: ManufacturingOrder[]
  /** Work centres in API format for display */
  workCentres: WorkCentre[]
  /** Callback when an order is moved between work centres */
  onOrderMove?: (orderId: number, newWorkCentreId: number, newIndex?: number) => void
  /** Callback for page navigation */
  onNavigate?: (page: string) => void
  /** Callback to refresh work centres data after reordering */
  onWorkCentreUpdate?: () => Promise<void>
  /** Callback to refresh orders data after reordering */
  onOrderUpdate?: () => Promise<void>
  /** TV Mode: display-only, high-contrast, no controls */
  tvMode?: boolean
}

// Mock current user for demo
const currentUser = {
  id: "user-1",
  name: "John Doe",
}

// DraggableWorkCentreItem - Sortable work centre item for column configuration
function DraggableWorkCentreItem({ 
  workCentre, 
  index, 
  jobCount, 
  onDragStart, 
  isDragging 
}: {
  workCentre: WorkCentre
  index: number
  jobCount: number
  onDragStart: (workCentre: WorkCentre) => void
  isDragging: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  
  useEffect(() => {
    const element = ref.current
    if (!element) return

    const cleanup = draggable({
      element,
      getInitialData: (): DragData => ({ 
        type: 'work-centre',
        id: workCentre.id 
      }),
      onDragStart: () => onDragStart(workCentre),
    })
    
    return cleanup
  }, [workCentre, onDragStart])

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between p-3 border rounded-lg bg-gray-50 cursor-grab active:cursor-grabbing transition-all",
        isDragging && "shadow-lg ring-2 ring-blue-500 opacity-75 rotate-1 scale-105"
      )}
      tabIndex={0}
      style={{ zIndex: isDragging ? 100 : undefined }}
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

// TV-only component that doesn't require authentication
function TVPlanningBoard({ orders, workCentres }: { orders: ManufacturingOrder[], workCentres: WorkCentre[] }) {
  const activeWorkCentres = workCentres
    .filter(wc => wc.is_active)
    .sort((a, b) => a.display_order - b.display_order)

  const getOrdersForWorkCentre = useCallback((workCentreId: number) => {
    return orders.filter((order) => order.current_work_centre_id === workCentreId)
  }, [orders])

  return (
    <div className="space-y-4 bg-black text-white min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-4xl font-extrabold tracking-wide">
            Manufacturing Planning Board
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-lg">
        {activeWorkCentres.map((workCentre) => (
          <div key={workCentre.id} className="rounded-lg bg-gray-900 border-2 border-gray-700 p-4">
            <div className="font-bold text-2xl mb-4 text-yellow-400">
              {workCentre.name}
            </div>
            <div className="space-y-2">
              {getOrdersForWorkCentre(workCentre.id).map((order) => (
                <div key={order.id} className="bg-gray-800 rounded p-3 text-white text-lg">
                  <OrderCard order={order} isDragging={false} isLocked={false} />
                </div>
              ))}
              {getOrdersForWorkCentre(workCentre.id).length === 0 && (
                <div className="text-gray-500 text-base">No orders</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// DraggableOrderCard - Draggable wrapper for order cards with improved UX
function DraggableOrderCard({ 
  order, 
  columnId,
  index,
  isDragging, 
  onDragStart 
}: { 
  order: ManufacturingOrder
  columnId: number
  index: number
  isDragging: boolean
  onDragStart: (order: ManufacturingOrder) => void 
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  
  useEffect(() => {
    const element = ref.current
    if (!element) return

    const cleanup = draggable({
      element,
      getInitialData: (): DragData => ({ 
        type: 'order',
        id: order.id,
        sourceColumnId: columnId,
        sourceIndex: index
      }),
      onDragStart: () => onDragStart(order),
    })
    
    return cleanup
  }, [order, columnId, index, onDragStart])

  return (
    <div
      ref={ref}
      className={cn(
        "cursor-grab active:cursor-grabbing bg-white rounded shadow-sm border transition-all duration-200",
        isDragging && "opacity-75 shadow-lg rotate-2 scale-105 ring-2 ring-blue-500"
      )}
      style={{ zIndex: isDragging ? 100 : undefined }}
      tabIndex={0}
    >
      <OrderCard order={order} isDragging={isDragging} isLocked={false} />
    </div>
  )
}

// DropZone - Enhanced drop zone with visual feedback
function DropZone({ 
  columnId, 
  index, 
  isActive, 
  children,
  insertionPoint 
}: { 
  columnId: number
  index?: number
  isActive: boolean
  children: React.ReactNode
  insertionPoint?: 'before' | 'after' | 'replace'
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [isDraggedOver, setIsDraggedOver] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const cleanup = dropTargetForElements({
      element,
      getData: (): DropData => ({ 
        type: index !== undefined ? 'card-list' : 'column',
        columnId,
        index,
        insertionPoint: insertionPoint || 'replace'
      }),
      canDrop: ({ source }) => {
        const dragData = source.data as DragData;
        return dragData.type === 'order' || dragData.type === 'work-centre';
      },
      onDragEnter: () => setIsDraggedOver(true),
      onDragLeave: () => setIsDraggedOver(false),
      onDrop: () => setIsDraggedOver(false),
    })
    
    return cleanup
  }, [columnId, index])

  const isInsertionPoint = insertionPoint === 'before' || insertionPoint === 'after'
  
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-200",
        isInsertionPoint && "min-h-[8px] flex items-center justify-center",
        isDraggedOver && isActive && isInsertionPoint && "bg-blue-200 border-2 border-blue-400 border-dashed rounded-lg",
        isDraggedOver && isActive && !isInsertionPoint && "bg-blue-50 ring-2 ring-blue-300 ring-dashed",
        !isActive && "pointer-events-none"
      )}
    >
      {isInsertionPoint && isDraggedOver ? (
        <div className="w-full h-1 bg-blue-400 rounded-full" />
      ) : (
        children
      )}
    </div>
  )
}

function MainPlanningBoard({ 
  orders, 
  workCentres, 
  onOrderMove, 
  onNavigate, 
  onWorkCentreUpdate,
  onOrderUpdate 
}: Omit<PlanningBoardProps, 'tvMode'>) {
  const { user, hasPermission } = useAuth()
  const { connectedUsers, isConnected } = useWebSocket(currentUser)
  
  // State management
  const [isConfigureDialogOpen, setIsConfigureDialogOpen] = useState(false)
  const [isAddWorkCentreDialogOpen, setIsAddWorkCentreDialogOpen] = useState(false)
  const [draggedOrderId, setDraggedOrderId] = useState<number | null>(null)
  const [draggedWorkCentreId, setDraggedWorkCentreId] = useState<number | null>(null)

  // Work centre ordering for configuration
  const [workCentreOrder, setWorkCentreOrder] = useState<WorkCentre[]>(() => 
    [...workCentres].sort((a, b) => a.display_order - b.display_order)
  )

  // Keep workCentreOrder in sync with props
  useEffect(() => {
    setWorkCentreOrder([...workCentres].sort((a, b) => a.display_order - b.display_order))
  }, [workCentres])

  // Order management within columns - with optimistic updates
  const [optimisticOrderMap, setOptimisticOrderMap] = useState<Record<number, number[]>>({})
  const [activeReorderOperations, setActiveReorderOperations] = useState<Set<number>>(new Set())
  
  const getOrdersForWorkCentre = useCallback((workCentreId: number) => {
    const allWorkCentreOrders = orders.filter(order => order.current_work_centre_id === workCentreId)
    
    // If we have an optimistic order for this work centre, use it
    if (optimisticOrderMap[workCentreId]) {
      const orderMap = new Map(allWorkCentreOrders.map(o => [o.id, o]))
      return optimisticOrderMap[workCentreId]
        .map(id => orderMap.get(id))
        .filter(Boolean) as ManufacturingOrder[]
    }
    
    // Otherwise use backend order
    return allWorkCentreOrders
  }, [orders, optimisticOrderMap])

  // Sorted and active work centres
  const activeWorkCentres = useMemo(() => 
    [...workCentres]
      .filter(wc => wc.is_active)
      .sort((a, b) => a.display_order - b.display_order),
    [workCentres]
  )

  // Drag event handlers
  const handleOrderDragStart = useCallback((order: ManufacturingOrder) => {
    setDraggedOrderId(order.id)
  }, [])

  const handleWorkCentreDragStart = useCallback((workCentre: WorkCentre) => {
    setDraggedWorkCentreId(workCentre.id)
  }, [])

  // Reorder cards within a column
  const handleReorderInColumn = useCallback(async (
    columnId: number, 
    fromIndex: number, 
    toIndex: number, 
    insertionPoint?: string
  ) => {
    console.log('🔄 Reorder Debug:', { columnId, fromIndex, toIndex, insertionPoint });
    
    // Mark this work centre as having an active reorder operation
    setActiveReorderOperations(prev => new Set(prev).add(columnId));
    
    // Get current orders in this work centre
    const workCentreOrders = orders.filter(order => order.current_work_centre_id === columnId)
    console.log('📋 Current orders:', workCentreOrders.map((o, i) => ({ index: i, id: o.id, number: o.order_number })));
    
    // Calculate the actual target index based on insertion point
    let actualTargetIndex = toIndex
    if (insertionPoint === 'before') {
      actualTargetIndex = toIndex
    } else if (insertionPoint === 'after') {
      actualTargetIndex = Math.min(workCentreOrders.length - 1, toIndex)
    } else if (insertionPoint === 'replace') {
      actualTargetIndex = toIndex
    }
    
    console.log('🎯 Target index:', actualTargetIndex);
    
    // Don't proceed if source and target are the same
    if (fromIndex === actualTargetIndex) {
      console.log('❌ Same position, skipping');
      setActiveReorderOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(columnId);
        return newSet;
      });
      return;
    }
    
    // Reorder the array locally first for immediate feedback
    const reorderedList = reorder({
      list: workCentreOrders,
      startIndex: fromIndex,
      finishIndex: actualTargetIndex
    })
    
    console.log('🔄 Reordered list:', reorderedList.map((o, i) => ({ index: i, id: o.id, number: o.order_number })));
    
    // Set optimistic order immediately for instant visual feedback
    setOptimisticOrderMap(prev => ({
      ...prev,
      [columnId]: reorderedList.map(o => o.id)
    }));
    
    // Create position updates for backend
    const orderPositions = reorderedList.map((order, index) => ({
      order_id: order.id,
      position: index
    }))
    
    console.log('📤 Sending to backend:', JSON.stringify(orderPositions, null, 2));
    
    try {
      // Call backend API to persist the reorder
      console.log('🚀 Calling backend API...');
      const result = await ordersService.reorder(columnId, orderPositions)
      console.log('✅ Backend response:', result);
      
      // Refresh to get the authoritative backend order, but keep optimistic state until refresh completes
      console.log('🔄 Refreshing backend data...');
      if (onOrderUpdate) {
        // Small delay to ensure backend transaction completes
        await new Promise(resolve => setTimeout(resolve, 300));
        await onOrderUpdate()
        
        // Only clear optimistic state AFTER refresh completes
        console.log('🔄 Clearing optimistic state after successful refresh...');
        setOptimisticOrderMap(prev => {
          const newMap = { ...prev };
          delete newMap[columnId];
          return newMap;
        });
      }
      console.log('✅ Backend order now showing');
      
      // Mark reorder operation as complete
      setActiveReorderOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(columnId);
        return newSet;
      });
      
      toast.success('Order reordered successfully')
    } catch (error: any) {
      console.error('❌ Failed to reorder orders:', error)
      // Clear optimistic state on error to revert to original order
      setOptimisticOrderMap(prev => {
        const newMap = { ...prev };
        delete newMap[columnId];
        return newMap;
      });
      
      // Mark reorder operation as complete (even on error)
      setActiveReorderOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(columnId);
        return newSet;
      });
      
      toast.error(error?.error || 'Failed to reorder orders')
    }
  }, [orders, onOrderUpdate])

  // Global drag monitor
  useEffect(() => {
    const cleanup = monitorForElements({
      onDrop: ({ source, location }) => {
        const dragData = source.data as DragData
        const dropTargets = location.current.dropTargets
        
        if (!dropTargets.length) {
          setDraggedOrderId(null)
          setDraggedWorkCentreId(null)
          return
        }

        const dropData = dropTargets[0].data as unknown as DropData

        if (dragData.type === 'order') {
          const orderId = dragData.id
          const targetColumnId = dropData.columnId
          const targetIndex = dropData.index
          const insertionPoint = dropData.insertionPoint

          if (dragData.sourceColumnId === targetColumnId && targetIndex !== undefined) {
            // Reorder within same column
            if (dragData.sourceIndex !== undefined && dragData.sourceIndex !== targetIndex) {
              handleReorderInColumn(targetColumnId, dragData.sourceIndex, targetIndex, insertionPoint)
            }
          } else {
            // Move between columns
            onOrderMove?.(orderId, targetColumnId, targetIndex)
          }
        } else if (dragData.type === 'work-centre') {
          // Handle work centre reordering in configuration dialog
          const workCentreId = dragData.id
          const targetId = dropData.columnId
          
          setWorkCentreOrder(prev => {
            const oldIndex = prev.findIndex(wc => wc.id === workCentreId)
            const newIndex = prev.findIndex(wc => wc.id === targetId)
            
            if (oldIndex === -1 || newIndex === -1) return prev
            
            const newOrder = reorder({ 
              list: prev, 
              startIndex: oldIndex, 
              finishIndex: newIndex 
            })
            
            return newOrder.map((item, idx) => ({ 
              ...item, 
              display_order: idx + 1 
            }))
          })
        }

        setDraggedOrderId(null)
        setDraggedWorkCentreId(null)
      },
    })

    return cleanup
  }, [onOrderMove, handleReorderInColumn])

  const handleSaveColumnOrder = async () => {
    try {
      if (!user) {
        toast.error('Authentication required. Please log in.')
        return
      }
      if (!hasPermission('work_centres:write')) {
        toast.error('Permission denied. You do not have access to reorder work centres.')
        return
      }

      const reorderData = workCentreOrder.map((wc) => ({ 
        id: Number(wc.id), 
        display_order: Number(wc.display_order) 
      }))

      if (reorderData.length === 0) {
        toast.error('No valid work centres to reorder')
        return
      }

      await workCentresService.reorder(reorderData)
      setIsConfigureDialogOpen(false)
      toast.success('Column order saved successfully')
      
      if (onWorkCentreUpdate) {
        await onWorkCentreUpdate()
      }
    } catch (error: unknown) {
      let errorMessage = 'Failed to save column order'
      if (error && typeof error === 'object') {
        const err = error as { status?: number; code?: string; error?: string; message?: string }
        if (err.status === 401 || err.code === 'INVALID_TOKEN') {
          errorMessage = 'Authentication required. Please log in again.'
        } else if (err.status === 403) {
          errorMessage = 'Permission denied. You do not have access to reorder work centres.'
        } else if (err.status === 0) {
          errorMessage = 'Network error. Please check your connection and try again.'
        } else if (err.error) {
          errorMessage = err.error
        } else if (err.message) {
          errorMessage = err.message
        }
      }
      toast.error(errorMessage)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-primary-blue">
            Manufacturing Planning Board
          </h2>
          {isConnected && <OnlineUsersIndicator connectedUsers={connectedUsers} />}
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => window.open('/tv', '_blank')} 
            size="sm" 
            variant="outline"
          >
            📺 TV Display
          </Button>
          <Button onClick={() => setIsAddWorkCentreDialogOpen(true)} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" /> Add Work Centre
          </Button>
          <Button onClick={() => setIsConfigureDialogOpen(true)} size="sm" variant="outline">
            <Settings className="h-4 w-4 mr-1" /> Configure Columns
          </Button>
        </div>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={isConfigureDialogOpen} onOpenChange={setIsConfigureDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Column Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Drag and drop work centres to reorder the columns on the planning board.
            </p>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {workCentreOrder.map((workCentre, index) => (
                <DropZone
                  key={workCentre.id}
                  columnId={workCentre.id}
                  isActive={true}
                >
                  <DraggableWorkCentreItem
                    workCentre={workCentre}
                    index={index}
                    jobCount={getOrdersForWorkCentre(workCentre.id).length}
                    onDragStart={handleWorkCentreDragStart}
                    isDragging={draggedWorkCentreId === workCentre.id}
                  />
                </DropZone>
              ))}
            </div>

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

      {/* Add Work Centre Dialog */}
      <Dialog open={isAddWorkCentreDialogOpen} onOpenChange={setIsAddWorkCentreDialogOpen}>
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

      {/* Main Planning Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {activeWorkCentres.map((workCentre) => {
          const workCentreOrders = getOrdersForWorkCentre(workCentre.id)
          
          return (
            <DropZone
              key={workCentre.id}
              columnId={workCentre.id}
              isActive={true}
            >
              <Card className="h-fit min-h-[400px] transition-all duration-200">
                <CardHeader className="pb-3 bg-gray-50 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      {workCentre.name} ({workCentreOrders.length} jobs)
                    </CardTitle>
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
                        <DropdownMenuItem onClick={() => console.log('View details:', workCentre)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => console.log('Clear jobs:', workCentre)}
                          disabled={workCentreOrders.length === 0}
                        >
                          Clear All Jobs
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-3">
                  {workCentreOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg transition-colors border-gray-200">
                      <p className="text-sm">No orders assigned</p>
                      <p className="text-xs">Drag orders here</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {/* Drop zone at the top */}
                      <DropZone
                        columnId={workCentre.id}
                        index={0}
                        isActive={true}
                        insertionPoint="before"
                      >
                        <div className="h-1" />
                      </DropZone>
                      
                      {workCentreOrders.map((order, index) => (
                        <React.Fragment key={order.id}>
                          <DropZone
                            columnId={workCentre.id}
                            index={index}
                            isActive={true}
                            insertionPoint="replace"
                          >
                            <DraggableOrderCard
                              order={order}
                              columnId={workCentre.id}
                              index={index}
                              isDragging={draggedOrderId === order.id}
                              onDragStart={handleOrderDragStart}
                            />
                          </DropZone>
                          
                          {/* Drop zone after each card */}
                          <DropZone
                            columnId={workCentre.id}
                            index={index + 1}
                            isActive={true}
                            insertionPoint="after"
                          >
                            <div className="h-1" />
                          </DropZone>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </DropZone>
          )
        })}
      </div>
    </div>
  )
}

export function PlanningBoard({ 
  orders, 
  workCentres, 
  onOrderMove, 
  onNavigate, 
  onWorkCentreUpdate, 
  tvMode 
}: PlanningBoardProps) {
  if (tvMode) {
    return <TVPlanningBoard orders={orders} workCentres={workCentres} />
  }

  return (
    <MainPlanningBoard 
      orders={orders} 
      workCentres={workCentres} 
      onOrderMove={onOrderMove} 
      onNavigate={onNavigate} 
      onWorkCentreUpdate={onWorkCentreUpdate} 
    />
  )
}