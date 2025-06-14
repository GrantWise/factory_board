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
import { Badge } from "@/components/ui/badge"
import { Settings, Plus, GripVertical, Tablet, AlertTriangle, ChevronUp, ChevronDown, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OrderCard } from "@/components/order-card"
import { OnlineUsersIndicator } from "@/components/online-users-indicator"
import { CharacteristicLegend } from "@/components/characteristic-legend"
import { CharacteristicSelector } from "@/components/characteristic-selector"
import { CharacteristicEditor } from "@/components/characteristic-editor"
import { useWebSocket } from "@/hooks/use-websocket"
import { workCentresService, ordersService, userSettingsService, characteristicsService } from "@/lib/api-services"
import { notify } from "@/lib/notifications"
import { type AppError } from "@/lib/error-handling"
import { useAuth } from "@/contexts/auth-context"
import type { ManufacturingOrder, WorkCentre, UserCharacteristicSettings, JobCharacteristic } from "@/types/manufacturing"
import { cn } from "@/lib/utils"
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder"
import { toast } from "sonner"
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
  onOrderUpdate?: (orderId: number, update: Partial<ManufacturingOrder>) => Promise<void>
  /** Callback when orders are reordered within a work centre */
  onOrderReorder?: (workCentreId: number, orderPositions: Array<{ order_id: number; position: number }>) => Promise<void>
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
  onDragStart,
  onClick,
  characteristicSettings,
  isCollapsed,
  onToggleCollapse
}: { 
  order: ManufacturingOrder
  columnId: number
  index: number
  isDragging: boolean
  onDragStart: (order: ManufacturingOrder) => void 
  onClick?: (order: ManufacturingOrder) => void
  characteristicSettings?: UserCharacteristicSettings
  isCollapsed?: boolean
  onToggleCollapse?: () => void
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
      <OrderCard 
        order={order} 
        isDragging={isDragging} 
        isLocked={false} 
        onClick={onClick ? () => onClick(order) : undefined}
        characteristicSettings={characteristicSettings}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
      />
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
  }, [columnId, index, insertionPoint])

  const isInsertionPoint = insertionPoint === 'before' || insertionPoint === 'after'
  
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-200",
        isInsertionPoint && "min-h-[12px] flex items-center justify-center",
        isDraggedOver && isActive && isInsertionPoint && "bg-blue-200 border-2 border-blue-400 border-dashed rounded-lg",
        isDraggedOver && isActive && !isInsertionPoint && "bg-blue-50 ring-2 ring-blue-300 ring-dashed",
        !isActive && "pointer-events-none"
      )}
    >
      {isInsertionPoint && isDraggedOver ? (
        <div className="w-full h-2 bg-blue-400 rounded-full" />
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
  onOrderUpdate,
  onOrderReorder
}: Omit<PlanningBoardProps, 'tvMode'>) {
  const { user, hasPermission } = useAuth()
  const { connectedUsers, isConnected } = useWebSocket(currentUser)
  
  // State management
  const [isConfigureDialogOpen, setIsConfigureDialogOpen] = useState(false)
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false)
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<ManufacturingOrder | null>(null)
  const [isCharacteristicEditorOpen, setIsCharacteristicEditorOpen] = useState(false)
  const [draggedOrderId, setDraggedOrderId] = useState<number | null>(null)
  const [draggedWorkCentreId, setDraggedWorkCentreId] = useState<number | null>(null)
  
  // Characteristics settings state - ENABLE BY DEFAULT for testing
  const [characteristicSettings, setCharacteristicSettings] = useState<UserCharacteristicSettings>({
    enabled: true,
    enabledTypes: ['customer_order'],
    primaryCharacteristic: 'customer_order',
    secondaryCharacteristic: undefined,
    colorAssignment: 'automatic'
  })
  const [allCharacteristics, setAllCharacteristics] = useState<JobCharacteristic[]>([])
  const [showLegend, setShowLegend] = useState(true)
  const [legendCollapsed, setLegendCollapsed] = useState(true)
  
  // Card collapse state - maps order ID to collapse state
  const [collapsedCards, setCollapsedCards] = useState<Record<number, boolean>>({})

  // Order creation form state
  const [newOrderForm, setNewOrderForm] = useState({
    order_number: '',
    stock_code: '',
    description: '',
    quantity_to_make: '',
    quantity_completed: '0',
    current_work_centre_id: '',
    current_operation: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    status: 'not_started' as 'not_started' | 'in_progress' | 'complete' | 'on_hold' | 'cancelled',
    due_date: '',
    start_date: '',
    completion_date: ''
  })
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  
  // Characteristics for new order
  const [newOrderCharacteristics, setNewOrderCharacteristics] = useState<Array<{
    type: string
    value: string
    color?: string
    display_name?: string
  }>>([])
  
  // Add characteristic to new order
  const addCharacteristicToNewOrder = (characteristic: {
    type: string
    value: string
    color?: string
    display_name?: string
  }) => {
    // Check for duplicates
    const exists = newOrderCharacteristics.some(
      char => char.type === characteristic.type && char.value === characteristic.value
    )
    
    if (exists) {
      notify.error('This characteristic already exists for this order')
      return
    }
    
    setNewOrderCharacteristics(prev => [...prev, characteristic])
    notify.success({
      operation: 'add_characteristic',
      entity: 'characteristic'
    })
  }
  
  // Remove characteristic from new order
  const removeCharacteristicFromNewOrder = (index: number) => {
    setNewOrderCharacteristics(prev => prev.filter((_, i) => i !== index))
  }

  // Work centre ordering for configuration
  const [workCentreOrder, setWorkCentreOrder] = useState<WorkCentre[]>(() => 
    [...workCentres].sort((a, b) => a.display_order - b.display_order)
  )

  // Keep workCentreOrder in sync with props
  useEffect(() => {
    setWorkCentreOrder([...workCentres].sort((a, b) => a.display_order - b.display_order))
  }, [workCentres])

  // Load user characteristics settings
  useEffect(() => {
    const loadCharacteristicsSettings = async () => {
      if (!user) {
        console.log('DEBUG: User not available for loading characteristics settings')
        return
      }
      
      console.log('DEBUG: Loading characteristics settings for user:', user.id)
      
      try {
        const settings = await userSettingsService.getVisualCharacteristics(user.id)
        console.log('DEBUG: Loaded characteristics settings:', settings)
        setCharacteristicSettings(settings)
      } catch (error) {
        console.error('Failed to load characteristics settings:', error)
        console.error('Error details:', error)
        // Fallback to defaults
        try {
          const defaults = await userSettingsService.getDefaults()
          console.log('DEBUG: Using default settings:', defaults.visual_characteristics)
          setCharacteristicSettings(defaults.visual_characteristics)
        } catch (defaultError) {
          console.error('Failed to load default settings:', defaultError)
        }
      }
    }

    loadCharacteristicsSettings()
  }, [user])

  // Collect unique characteristics from orders for legend display
  useEffect(() => {
    const allChars = orders.flatMap(order => order.job_characteristics || [])
    
    // Deduplicate characteristics by type-value combination
    // Keep the first occurrence of each unique type-value pair
    const uniqueCharacteristics = allChars.filter((char, index, arr) => 
      arr.findIndex(c => c.type === char.type && c.value === char.value) === index
    )
    
    setAllCharacteristics(uniqueCharacteristics)
  }, [orders])

  // Order management within columns - with optimistic updates
  const [optimisticOrderMap, setOptimisticOrderMap] = useState<Record<number, number[]>>({})
  const [activeReorderOperations, setActiveReorderOperations] = useState<Set<number>>(new Set())
  
  const getOrdersForWorkCentre = useCallback((workCentreId: number | null) => {
    // Handle unassigned orders (workCentreId === null)
    const allWorkCentreOrders = orders.filter(order => 
      workCentreId === null 
        ? (order.current_work_centre_id === null || order.current_work_centre_id === undefined)
        : order.current_work_centre_id === workCentreId
    )
    
    // Use workCentreId || 0 for unassigned to avoid optimistic map issues
    const mapKey = workCentreId || 0
    
    // If we have an optimistic order for this work centre, use it
    if (optimisticOrderMap[mapKey]) {
      const orderMap = new Map(allWorkCentreOrders.map(o => [o.id, o]))
      return optimisticOrderMap[mapKey]
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
    toIndex: number
  ) => {
    if (activeReorderOperations.has(columnId)) {
      console.warn('Reorder operation already in progress for column', columnId);
      return;
    }

    try {
      setActiveReorderOperations(prev => new Set(prev).add(columnId));

      // Get current orders in the column
      const columnOrders = getOrdersForWorkCentre(columnId);
      
      // Reorder the array
      const reorderedOrders = reorder({
        list: columnOrders,
        startIndex: fromIndex,
        finishIndex: toIndex
      });
      
      // Calculate new positions
      const newPositions = reorderedOrders.map((order, index) => ({
        order_id: order.id,
        position: index + 1
      }));

      // Update optimistic state
      setOptimisticOrderMap(prev => ({
        ...prev,
        [columnId]: reorderedOrders.map(o => o.id)
      }));

      // Send update to backend through parent component
      await onOrderReorder?.(columnId, newPositions);
    } catch (error) {
      console.error('Failed to reorder orders:', error);
      notify.error(error as AppError, {
        operation: 'reorder_orders',
        entity: 'orders'
      });
    } finally {
      setActiveReorderOperations(prev => {
        const next = new Set(prev);
        next.delete(columnId);
        return next;
      });
    }
  }, [getOrdersForWorkCentre, onOrderReorder, activeReorderOperations]);

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

          if (dragData.sourceColumnId === targetColumnId && targetIndex !== undefined) {
            // Reorder within same column
            if (dragData.sourceIndex !== undefined && dragData.sourceIndex !== targetIndex) {
              handleReorderInColumn(targetColumnId, dragData.sourceIndex, targetIndex)
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
        notify.error('Authentication required. Please log in.')
        return
      }
      if (!hasPermission('work_centres:write')) {
        notify.error('Permission denied. You do not have access to reorder work centres.')
        return
      }

      const reorderData = workCentreOrder.map((wc) => ({ 
        id: Number(wc.id), 
        display_order: Number(wc.display_order) 
      }))

      if (reorderData.length === 0) {
        notify.error('No valid work centres to reorder')
        return
      }

      await workCentresService.reorder(reorderData)
      setIsConfigureDialogOpen(false)
      notify.success({
        operation: 'reorder_work_centres',
        entity: 'work centres'
      })
      
      if (onWorkCentreUpdate) {
        await onWorkCentreUpdate()
      }
    } catch (error: unknown) {
      notify.error(error as AppError, {
        operation: 'reorder_work_centres',
        entity: 'work centres'
      })
    }
  }

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      notify.error('Authentication required. Please log in.')
      return
    }
    if (!hasPermission('orders:write')) {
      notify.error('Permission denied. You do not have access to create orders.')
      return
    }

    setIsCreatingOrder(true)
    
    try {
      const orderData = {
        ...newOrderForm,
        quantity_to_make: parseInt(newOrderForm.quantity_to_make),
        quantity_completed: parseInt(newOrderForm.quantity_completed) || 0,
        current_work_centre_id: newOrderForm.current_work_centre_id && newOrderForm.current_work_centre_id !== "unassigned" 
          ? parseInt(newOrderForm.current_work_centre_id) 
          : undefined,
        current_operation: newOrderForm.current_operation || undefined,
        due_date: newOrderForm.due_date || undefined,
        start_date: newOrderForm.start_date || undefined,
        completion_date: newOrderForm.completion_date || undefined
      }
      
      // Backend automatically sets created_by from authenticated user
      const createdOrderResponse = await ordersService.create(orderData)
      const newOrderId = createdOrderResponse.order.id
      
      // Add characteristics to the new order if any were specified
      if (newOrderCharacteristics.length > 0 && newOrderId) {
        for (const characteristic of newOrderCharacteristics) {
          try {
            await characteristicsService.createForOrder(newOrderId, characteristic)
          } catch (charError) {
            console.error('Failed to add characteristic:', charError)
            // Don't fail the entire order creation, just log the error
            notify.error(`Failed to add characteristic: ${characteristic.value}`)
          }
        }
      }
      
      // Reset form
      setNewOrderForm({
        order_number: '',
        stock_code: '',
        description: '',
        quantity_to_make: '',
        quantity_completed: '0',
        current_work_centre_id: '',
        current_operation: '',
        priority: 'medium',
        status: 'not_started',
        due_date: '',
        start_date: '',
        completion_date: ''
      })
      setNewOrderCharacteristics([])
      
      setIsCreateOrderDialogOpen(false)
      notify.success({
        operation: 'create_order',
        entity: 'order'
      })
    } catch (error: unknown) {
      notify.error(error as AppError, {
        operation: 'create_order',
        entity: 'order'
      })
    } finally {
      setIsCreatingOrder(false)
    }
  }

  const handleOrderClick = (order: ManufacturingOrder) => {
    setSelectedOrder(order)
    setIsOrderDetailsDialogOpen(true)
  }

  const handleToggleCardCollapse = useCallback((orderId: number) => {
    setCollapsedCards(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }))
  }, [])

  const handleCollapseAll = useCallback(() => {
    const allOrderIds = orders.map(order => order.id)
    const newState = allOrderIds.reduce((acc, id) => {
      acc[id] = true
      return acc
    }, {} as Record<number, boolean>)
    setCollapsedCards(newState)
  }, [orders])

  const handleExpandAll = useCallback(() => {
    setCollapsedCards({})
  }, [])

  // Handle characteristic updates for selected order
  const handleCharacteristicUpdate = useCallback((updatedCharacteristics: JobCharacteristic[]) => {
    if (selectedOrder) {
      setSelectedOrder(prev => prev ? { 
        ...prev, 
        job_characteristics: updatedCharacteristics 
      } : null)
    }
  }, [selectedOrder])


  return (
    <div className="space-y-4">
      {/* Mobile/Small Screen Warning */}
      <div className="block md:hidden bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-md">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-amber-800">
              Planning Board Not Available on Mobile
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              The manufacturing planning board requires a tablet or desktop screen for optimal use. 
              Please use a device with a larger screen or rotate your tablet to landscape mode.
            </p>
            <div className="mt-3 flex">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = '/orders'}
                className="border-amber-300 text-amber-800 hover:bg-amber-100"
              >
                View Orders Table Instead
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Planning Board Content - Hidden on mobile */}
      <div className="hidden md:block space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl md:text-2xl font-bold text-primary-blue">
              Manufacturing Planning Board
            </h2>
            {isConnected && <OnlineUsersIndicator connectedUsers={connectedUsers} />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => setIsCreateOrderDialogOpen(true)} 
              size="sm" 
              variant="default"
              disabled={!user || !hasPermission('orders:write')}
              className="md:h-8 h-10 touch-manipulation"
            >
              <Plus className="h-4 w-4 mr-1" /> Create Order
            </Button>
            <Button 
              onClick={() => window.open('/tv', '_blank')} 
              size="sm" 
              variant="outline"
              className="md:h-8 h-10 touch-manipulation"
            >
              <Tablet className="h-4 w-4 mr-1" /> TV Display
            </Button>
            <Button 
              onClick={handleCollapseAll}
              size="sm" 
              variant="outline"
              className="md:h-8 h-10 touch-manipulation"
              title="Collapse all order cards"
            >
              <ChevronUp className="h-4 w-4 mr-1" /> Collapse All
            </Button>
            <Button 
              onClick={handleExpandAll}
              size="sm" 
              variant="outline"
              className="md:h-8 h-10 touch-manipulation"
              title="Expand all order cards"
            >
              <ChevronDown className="h-4 w-4 mr-1" /> Expand All
            </Button>
            <Button 
              onClick={() => setIsConfigureDialogOpen(true)} 
              size="sm" 
              variant="outline"
              className="md:h-8 h-10 touch-manipulation"
            >
              <Settings className="h-4 w-4 mr-1" /> Configure
            </Button>
          </div>
        </div>

      {/* Create Order Dialog */}
      <Dialog open={isCreateOrderDialogOpen} onOpenChange={setIsCreateOrderDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrder} className="space-y-4">
            {/* Header Fields - Always Visible */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
              <div>
                <Label htmlFor="order_number">Order Number *</Label>
                <Input
                  id="order_number"
                  value={newOrderForm.order_number}
                  onChange={(e) => setNewOrderForm(prev => ({ ...prev, order_number: e.target.value }))}
                  placeholder="MO-2024-001"
                  required
                />
              </div>
              <div>
                <Label htmlFor="stock_code">Stock Code *</Label>
                <Input
                  id="stock_code"
                  value={newOrderForm.stock_code}
                  onChange={(e) => setNewOrderForm(prev => ({ ...prev, stock_code: e.target.value }))}
                  placeholder="WIDGET-A"
                  required
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={newOrderForm.description}
                  onChange={(e) => setNewOrderForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Product description"
                  required
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  value={newOrderForm.priority} 
                  onValueChange={(value: 'low' | 'medium' | 'high') => 
                    setNewOrderForm(prev => ({ ...prev, priority: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabbed Content */}
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="characteristics">Characteristics</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity_to_make">Quantity to Make *</Label>
                    <Input
                      id="quantity_to_make"
                      type="number"
                      min="1"
                      value={newOrderForm.quantity_to_make}
                      onChange={(e) => setNewOrderForm(prev => ({ ...prev, quantity_to_make: e.target.value }))}
                      placeholder="100"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="quantity_completed">Quantity Completed</Label>
                    <Input
                      id="quantity_completed"
                      type="number"
                      min="0"
                      value={newOrderForm.quantity_completed || '0'}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        const maxQuantity = parseInt(newOrderForm.quantity_to_make) || 0;
                        if (value <= maxQuantity) {
                          setNewOrderForm(prev => ({ ...prev, quantity_completed: e.target.value }));
                        }
                      }}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="current_work_centre_id">Work Centre</Label>
                    <Select 
                      value={newOrderForm.current_work_centre_id || "unassigned"} 
                      onValueChange={(value) => 
                        setNewOrderForm(prev => ({ 
                          ...prev, 
                          current_work_centre_id: value === "unassigned" ? "" : value 
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {workCentres.filter(wc => wc.is_active).map(wc => (
                          <SelectItem key={wc.id} value={wc.id.toString()}>
                            {wc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={newOrderForm.status || 'not_started'} 
                      onValueChange={(value: 'not_started' | 'in_progress' | 'complete' | 'on_hold' | 'cancelled') => 
                        setNewOrderForm(prev => ({ ...prev, status: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="current_operation">Current Operation</Label>
                    <Input
                      id="current_operation"
                      value={newOrderForm.current_operation || ''}
                      onChange={(e) => setNewOrderForm(prev => ({ ...prev, current_operation: e.target.value }))}
                      placeholder="Machining, Assembly, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={newOrderForm.due_date}
                      onChange={(e) => setNewOrderForm(prev => ({ ...prev, due_date: e.target.value }))}
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="characteristics" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Visual Grouping Characteristics</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add characteristics to enable visual grouping on the planning board. These help identify and categorize orders.
                    </p>
                  </div>

                  {/* Current Characteristics */}
                  {newOrderCharacteristics.length > 0 && (
                    <div>
                      <Label className="text-xs">Added Characteristics</Label>
                      <div className="mt-2 space-y-2">
                        {newOrderCharacteristics.map((characteristic, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full border"
                                style={{ backgroundColor: characteristic.color }}
                              />
                              <Badge variant="outline" className="text-xs">
                                {characteristic.type.replace('_', ' ')}
                              </Badge>
                              <span className="font-medium text-sm">{characteristic.value}</span>
                              {characteristic.display_name && (
                                <span className="text-xs text-muted-foreground">
                                  ({characteristic.display_name})
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeCharacteristicFromNewOrder(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add New Characteristics */}
                  <div>
                    <Label className="text-xs">Add Characteristics</Label>
                    <div className="mt-2 border rounded-lg p-3">
                      <CharacteristicSelector
                        onSelect={addCharacteristicToNewOrder}
                        excludeExisting={newOrderCharacteristics.map(char => ({
                          id: 0,
                          order_id: 0,
                          type: char.type as JobCharacteristic['type'],
                          value: char.value,
                          color: char.color || '',
                          display_name: char.display_name,
                          is_system_generated: false,
                          created_at: ''
                        }))}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={newOrderForm.start_date || ''}
                        onChange={(e) => setNewOrderForm(prev => ({ ...prev, start_date: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">When production should begin</p>
                    </div>
                    <div>
                      <Label htmlFor="completion_date">Completion Date</Label>
                      <Input
                        id="completion_date"
                        type="date"
                        value={newOrderForm.completion_date || ''}
                        onChange={(e) => setNewOrderForm(prev => ({ ...prev, completion_date: e.target.value }))}
                        disabled={(newOrderForm.status || 'not_started') !== 'complete'}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {(newOrderForm.status || 'not_started') !== 'complete' 
                          ? 'Only available when status is "Complete"'
                          : 'When production was completed'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 pt-4 border-t">
              <Button 
                type="submit"
                disabled={isCreatingOrder || !user || !hasPermission('orders:write')}
                className="flex-1"
              >
                {isCreatingOrder ? 'Creating...' : 'Create Order'}
              </Button>
              <Button 
                type="button"
                variant="outline"
                onClick={() => setIsCreateOrderDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={isOrderDetailsDialogOpen} onOpenChange={setIsOrderDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Order Number</Label>
                  <p className="text-sm mt-1">{selectedOrder.order_number}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Stock Code</Label>
                  <p className="text-sm mt-1">{selectedOrder.stock_code}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm mt-1">{selectedOrder.description}</p>
                </div>
              </div>

              {/* Progress and Status */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Select
                    value={selectedOrder.status}
                    onValueChange={async (newStatus: ManufacturingOrder['status']) => {
                      console.log('[PlanningBoard] Status change initiated:', { orderId: selectedOrder.id, newStatus });
                      try {
                        console.log('[PlanningBoard] Calling onOrderUpdate...');
                        await onOrderUpdate?.(selectedOrder.id, { status: newStatus })
                        console.log('[PlanningBoard] onOrderUpdate completed successfully');
                        // Update the local state
                        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null)
                        toast.success('Order status updated successfully')
                      } catch (error) {
                        console.error('[PlanningBoard] Error updating order status:', error);
                        toast.error('Failed to update order status')
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Priority</Label>
                  <Select
                    value={selectedOrder.priority}
                    onValueChange={async (newPriority: ManufacturingOrder['priority']) => {
                      try {
                        await onOrderUpdate?.(selectedOrder.id, { priority: newPriority })
                        setSelectedOrder(prev => prev ? { ...prev, priority: newPriority } : null)
                        toast.success('Order priority updated successfully')
                      } catch (error) {
                        console.error('[PlanningBoard] Error updating order priority:', error);
                        toast.error('Failed to update order priority')
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Quantity Completed</Label>
                  <Input
                    type="number"
                    min="0"
                    max={selectedOrder.quantity_to_make}
                    value={selectedOrder.quantity_completed}
                    onChange={async (e) => {
                      const newQuantity = parseInt(e.target.value) || 0;
                      if (newQuantity > selectedOrder.quantity_to_make) {
                        toast.error(`Completed quantity cannot exceed ${selectedOrder.quantity_to_make}`)
                        return;
                      }
                      try {
                        await onOrderUpdate?.(selectedOrder.id, { quantity_completed: newQuantity })
                        setSelectedOrder(prev => prev ? { ...prev, quantity_completed: newQuantity } : null)
                        toast.success('Quantity completed updated successfully')
                      } catch (error) {
                        console.error('[PlanningBoard] Error updating quantity completed:', error);
                        toast.error('Failed to update quantity completed')
                      }
                    }}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedOrder.quantity_completed} / {selectedOrder.quantity_to_make}
                    <span className="ml-2">
                      ({Math.round((selectedOrder.quantity_completed / selectedOrder.quantity_to_make) * 100)}%)
                    </span>
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <Label className="text-sm font-medium">Progress</Label>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={cn(
                        "h-2 rounded-full transition-all",
                        selectedOrder.status === 'complete' ? 'bg-green-500' :
                        selectedOrder.status === 'overdue' ? 'bg-red-500' : 'bg-blue-500'
                      )}
                      style={{ 
                        width: `${Math.round((selectedOrder.quantity_completed / selectedOrder.quantity_to_make) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Work Centre and Operations */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Current Work Centre</Label>
                  <Select
                    value={selectedOrder.current_work_centre_id?.toString() || 'unassigned'}
                    onValueChange={async (value) => {
                      const workCentreId = value === 'unassigned' ? null : parseInt(value);
                      try {
                        await onOrderUpdate?.(selectedOrder.id, { current_work_centre_id: workCentreId })
                        setSelectedOrder(prev => prev ? { ...prev, current_work_centre_id: workCentreId } : null)
                        toast.success('Work centre updated successfully')
                      } catch (error) {
                        console.error('[PlanningBoard] Error updating work centre:', error);
                        toast.error('Failed to update work centre')
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {workCentres.map(wc => (
                        <SelectItem key={wc.id} value={wc.id.toString()}>
                          {wc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Current Operation</Label>
                  <Input
                    value={selectedOrder.current_operation || ''}
                    onChange={async (e) => {
                      const newOperation = e.target.value.trim();
                      try {
                        await onOrderUpdate?.(selectedOrder.id, { current_operation: newOperation || undefined })
                        setSelectedOrder(prev => prev ? { ...prev, current_operation: newOperation || undefined } : null)
                        toast.success('Current operation updated successfully')
                      } catch (error) {
                        console.error('[PlanningBoard] Error updating current operation:', error);
                        toast.error('Failed to update current operation')
                      }
                    }}
                    placeholder="Enter current operation"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Due Date</Label>
                  <Input
                    type="date"
                    value={selectedOrder.due_date ? new Date(selectedOrder.due_date).toISOString().split('T')[0] : ''}
                    onChange={async (e) => {
                      const newDueDate = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                      try {
                        await onOrderUpdate?.(selectedOrder.id, { due_date: newDueDate })
                        setSelectedOrder(prev => prev ? { ...prev, due_date: newDueDate } : null)
                        toast.success('Due date updated successfully')
                      } catch (error) {
                        console.error('[PlanningBoard] Error updating due date:', error);
                        toast.error('Failed to update due date')
                      }
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Start Date</Label>
                  <Input
                    type="date"
                    value={selectedOrder.start_date ? new Date(selectedOrder.start_date).toISOString().split('T')[0] : ''}
                    onChange={async (e) => {
                      const newStartDate = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                      try {
                        await onOrderUpdate?.(selectedOrder.id, { start_date: newStartDate })
                        setSelectedOrder(prev => prev ? { ...prev, start_date: newStartDate } : null)
                        toast.success('Start date updated successfully')
                      } catch (error) {
                        console.error('[PlanningBoard] Error updating start date:', error);
                        toast.error('Failed to update start date')
                      }
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Completion Date</Label>
                  <Input
                    type="date"
                    value={selectedOrder.completion_date ? new Date(selectedOrder.completion_date).toISOString().split('T')[0] : ''}
                    onChange={async (e) => {
                      const newCompletionDate = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                      try {
                        await onOrderUpdate?.(selectedOrder.id, { completion_date: newCompletionDate })
                        setSelectedOrder(prev => prev ? { ...prev, completion_date: newCompletionDate } : null)
                        toast.success('Completion date updated successfully')
                      } catch (error) {
                        console.error('[PlanningBoard] Error updating completion date:', error);
                        toast.error('Failed to update completion date')
                      }
                    }}
                    className="mt-1"
                    disabled={selectedOrder.status !== 'complete'}
                  />
                  {selectedOrder.status !== 'complete' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Only available when status is &quot;Complete&quot;
                    </p>
                  )}
                </div>
              </div>

              {/* Manufacturing Steps */}
              {selectedOrder.manufacturing_steps && selectedOrder.manufacturing_steps.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Manufacturing Steps</Label>
                  <div className="mt-2 space-y-2">
                    {selectedOrder.manufacturing_steps.map((step, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <span className="text-sm font-medium">Step {step.step_number}:</span>
                          <span className="text-sm ml-2">{step.operation_name}</span>
                        </div>
                        <Badge variant={
                          step.status === 'complete' ? 'default' :
                          step.status === 'in_progress' ? 'secondary' : 'outline'
                        }>
                          {step.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Characteristics Section */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Characteristics</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsCharacteristicEditorOpen(true)}
                    disabled={!user || !hasPermission('orders:write')}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </div>
                <div className="mt-2">
                  {selectedOrder.job_characteristics && selectedOrder.job_characteristics.length > 0 ? (
                    <div className="space-y-2">
                      {selectedOrder.job_characteristics.map((characteristic, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                          <div 
                            className="w-3 h-3 rounded-full border"
                            style={{ backgroundColor: characteristic.color }}
                          />
                          <Badge variant="outline" className="text-xs">
                            {characteristic.type.replace('_', ' ')}
                          </Badge>
                          <span className="font-medium text-sm">{characteristic.value}</span>
                          {characteristic.display_name && (
                            <span className="text-xs text-muted-foreground">
                              ({characteristic.display_name})
                            </span>
                          )}
                          {characteristic.is_system_generated && (
                            <Badge variant="secondary" className="text-xs">
                              Auto
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-lg">
                      <p className="text-sm">No characteristics added</p>
                      <p className="text-xs">Add characteristics to enable visual grouping</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  variant="outline"
                  onClick={() => setIsOrderDetailsDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Characteristic Editor Dialog */}
      {selectedOrder && (
        <CharacteristicEditor
          orderId={selectedOrder.id}
          characteristics={selectedOrder.job_characteristics || []}
          onUpdate={handleCharacteristicUpdate}
          open={isCharacteristicEditorOpen}
          onOpenChange={setIsCharacteristicEditorOpen}
        />
      )}

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


      {/* Characteristics Legend */}
      {characteristicSettings.enabled && showLegend && (
        <CharacteristicLegend
          characteristics={allCharacteristics}
          settings={characteristicSettings}
          onToggleVisibility={() => setShowLegend(!showLegend)}
          compact={false}
          collapsed={legendCollapsed}
          onToggleCollapse={setLegendCollapsed}
        />
      )}

      {/* Main Planning Board Grid - Optimized for Tablet with max width constraints */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4 w-full overflow-x-auto">
        {/* Unassigned Orders Column */}
        {(() => {
          const unassignedOrders = getOrdersForWorkCentre(null)
          
          return (
            <DropZone
              key="unassigned"
              columnId={0} // Use 0 for unassigned
              isActive={true}
            >
              <Card className="h-[400px] md:h-[500px] transition-all duration-200 touch-manipulation border-dashed border-2 border-amber-300 max-w-sm w-full flex flex-col">
                <CardHeader className="pb-3 bg-amber-50 border-b border-amber-200">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base md:text-lg font-semibold text-amber-800">
                      Unassigned ({unassignedOrders.length})
                    </CardTitle>
                    <div className="text-xs text-amber-600 font-medium">
                      Drag to assign →
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-3 md:p-4 flex-1 overflow-y-auto">
                  {unassignedOrders.length === 0 ? (
                    <div className="text-center py-8 md:py-12 text-muted-foreground border-2 border-dashed rounded-lg transition-colors border-amber-200 touch-manipulation">
                      <p className="text-sm md:text-base text-amber-700">All orders assigned</p>
                      <p className="text-xs md:text-sm text-amber-600">Orders need work centres</p>
                    </div>
                  ) : (
                    <div className="space-y-2 md:space-y-3">
                      {/* Drop zone at the top */}
                      <DropZone
                        columnId={0}
                        index={0}
                        isActive={true}
                        insertionPoint="before"
                      >
                        <div className="h-3 flex items-center justify-center" />
                      </DropZone>
                      
                      {unassignedOrders.map((order, index) => (
                        <React.Fragment key={order.id}>
                          <DropZone
                            columnId={0}
                            index={index}
                            isActive={true}
                            insertionPoint="replace"
                          >
                            <DraggableOrderCard
                              order={order}
                              columnId={0}
                              index={index}
                              isDragging={draggedOrderId === order.id}
                              onDragStart={handleOrderDragStart}
                              onClick={handleOrderClick}
                              characteristicSettings={characteristicSettings}
                              isCollapsed={collapsedCards[order.id]}
                              onToggleCollapse={() => handleToggleCardCollapse(order.id)}
                            />
                          </DropZone>
                          
                          {/* Drop zone after each card */}
                          <DropZone
                            columnId={0}
                            index={index + 1}
                            isActive={true}
                            insertionPoint="after"
                          >
                            <div className="h-3 flex items-center justify-center" />
                          </DropZone>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </DropZone>
          )
        })()}

        {/* Regular Work Centre Columns */}
        {activeWorkCentres.map((workCentre) => {
          const workCentreOrders = getOrdersForWorkCentre(workCentre.id)
          
          return (
            <DropZone
              key={workCentre.id}
              columnId={workCentre.id}
              isActive={true}
            >
              <Card className="h-[400px] md:h-[500px] transition-all duration-200 touch-manipulation max-w-sm w-full flex flex-col">
                <CardHeader className="pb-3 bg-gray-50 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base md:text-lg font-semibold text-gray-900">
                      {workCentre.name} ({workCentreOrders.length})
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 md:h-6 md:w-6 touch-manipulation">
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
                <CardContent className="space-y-3 p-3 md:p-4 flex-1 overflow-y-auto">
                  {workCentreOrders.length === 0 ? (
                    <div className="text-center py-8 md:py-12 text-muted-foreground border-2 border-dashed rounded-lg transition-colors border-gray-200 touch-manipulation">
                      <p className="text-sm md:text-base">No orders assigned</p>
                      <p className="text-xs md:text-sm">Drag orders here</p>
                    </div>
                  ) : (
                    <div className="space-y-2 md:space-y-3">
                      {/* Drop zone at the top */}
                      <DropZone
                        columnId={workCentre.id}
                        index={0}
                        isActive={true}
                        insertionPoint="before"
                      >
                        <div className="h-3 flex items-center justify-center" />
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
                              onClick={handleOrderClick}
                              characteristicSettings={characteristicSettings}
                              isCollapsed={collapsedCards[order.id]}
                              onToggleCollapse={() => handleToggleCardCollapse(order.id)}
                            />
                          </DropZone>
                          
                          {/* Drop zone after each card */}
                          <DropZone
                            columnId={workCentre.id}
                            index={index + 1}
                            isActive={true}
                            insertionPoint="after"
                          >
                            <div className="h-3 flex items-center justify-center" />
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
    </div>
  )
}

export function PlanningBoard({ 
  orders, 
  workCentres, 
  onOrderMove, 
  onNavigate, 
  onWorkCentreUpdate,
  onOrderUpdate,
  onOrderReorder,
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
      onOrderUpdate={onOrderUpdate}
      onOrderReorder={onOrderReorder}
    />
  )
}