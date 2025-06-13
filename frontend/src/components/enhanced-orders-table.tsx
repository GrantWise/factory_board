"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MoreHorizontal, Download, Upload, Users, Plus } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { ColumnFilter } from "@/components/ui/column-filter"
import type { ManufacturingOrder, WorkCentre } from "@/types/manufacturing"
import { getStatusBadgeConfig, getDueDays, PRIORITY_ORDER } from "@/lib/order-utils"
import { ordersService } from "@/lib/api-services"
import { notify } from "@/lib/notifications"
import { type AppError } from "@/lib/error-handling"
import { useAuth } from "@/contexts/auth-context"

interface EnhancedOrdersTableProps {
  orders: ManufacturingOrder[]
  workCentres?: WorkCentre[]
  onOrderUpdate?: (orderId: number, updates: Partial<ManufacturingOrder>) => Promise<void>
}

// Status and Priority options for filtering
const statusOptions = [
  { label: "Not Started", value: "not_started" },
  { label: "In Progress", value: "in_progress" },
  { label: "Complete", value: "complete" },
  { label: "Overdue", value: "overdue" },
  { label: "On Hold", value: "on_hold" },
  { label: "Cancelled", value: "cancelled" },
]

const priorityOptions = [
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
]

export function EnhancedOrdersTable({ orders, workCentres = [], onOrderUpdate }: EnhancedOrdersTableProps) {
  const { user, hasPermission } = useAuth()
  const [selectedOrders, setSelectedOrders] = React.useState<ManufacturingOrder[]>([])
  const [isBulkEditOpen, setIsBulkEditOpen] = React.useState(false)
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = React.useState(false)
  const [bulkEditForm, setBulkEditForm] = React.useState({
    priority: "",
    status: "",
    due_date: "",
    current_work_centre_id: "",
    current_operation: "",
    start_date: "",
    completion_date: ""
  })

  // Order creation form state
  const [newOrderForm, setNewOrderForm] = React.useState({
    order_number: '',
    stock_code: '',
    description: '',
    quantity_to_make: '',
    current_work_centre_id: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    due_date: ''
  })
  const [isCreatingOrder, setIsCreatingOrder] = React.useState(false)
  const [resetTableSelection, setResetTableSelection] = React.useState(false)

  // Special values for bulk edit - avoids empty string issue with Radix Select
  const KEEP_EXISTING = '__keep_existing__'

  // Work centre options for filtering
  const workCentreOptions = React.useMemo(() => [
    { label: "Unassigned", value: "unassigned" },
    ...workCentres
      .filter(wc => wc.is_active)
      .map(wc => ({ label: wc.name, value: wc.id.toString() }))
  ], [workCentres])

  // Custom filter functions
  const numberRangeFilter = (row: { getValue: (columnId: string) => unknown }, columnId: string, filterValue: [number, number]) => {
    const [min, max] = filterValue
    const value = row.getValue(columnId) as number
    return (min === undefined || value >= min) && (max === undefined || value <= max)
  }

  const dateRangeFilter = (row: { getValue: (columnId: string) => unknown }, columnId: string, filterValue: { from: string, to: string }) => {
    const { from, to } = filterValue
    const cellValue = row.getValue(columnId)
    if (!cellValue) return false
    
    const date = new Date(cellValue as string)
    const fromDate = from ? new Date(from) : null
    const toDate = to ? new Date(to) : null
    
    if (fromDate && date < fromDate) return false
    if (toDate && date > toDate) return false
    
    return true
  }

  const columns: ColumnDef<ManufacturingOrder>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "order_number",
      header: ({ column }) => (
        <ColumnFilter column={column} title="Order Number" type="text" />
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("order_number")}</div>
      ),
    },
    {
      accessorKey: "stock_code",
      header: ({ column }) => (
        <ColumnFilter column={column} title="Stock Code" type="text" />
      ),
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <ColumnFilter column={column} title="Description" type="text" />
      ),
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate" title={row.getValue("description")}>
          {row.getValue("description")}
        </div>
      ),
    },
    {
      id: "progress",
      accessorFn: (row) => (row.quantity_completed / row.quantity_to_make) * 100,
      header: ({ column }) => (
        <ColumnFilter column={column} title="Progress %" type="number" />
      ),
      cell: ({ row }) => {
        const order = row.original
        const progress = (order.quantity_completed / order.quantity_to_make) * 100
        
        return (
          <div className="space-y-1 min-w-[120px]">
            <div className="flex justify-between text-sm">
              <span>{order.quantity_completed}/{order.quantity_to_make}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )
      },
      filterFn: numberRangeFilter,
    },
    {
      accessorKey: "current_operation",
      header: ({ column }) => (
        <ColumnFilter column={column} title="Current Step" type="text" />
      ),
      cell: ({ row }) => row.getValue("current_operation") || "N/A",
    },
    {
      accessorKey: "priority",
      header: ({ column }) => (
        <ColumnFilter column={column} title="Priority" type="select" options={priorityOptions} />
      ),
      cell: ({ row }) => {
        const priority = row.getValue("priority") as string
        return (
          <Badge variant={
            priority === 'high' ? 'destructive' :
            priority === 'medium' ? 'secondary' : 'outline'
          }>
            {priority.toUpperCase()}
          </Badge>
        )
      },
      sortingFn: (rowA, rowB) => {
        const aPriority = PRIORITY_ORDER[rowA.original.priority] || 0
        const bPriority = PRIORITY_ORDER[rowB.original.priority] || 0
        return aPriority - bPriority
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <ColumnFilter column={column} title="Status" type="select" options={statusOptions} />
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        const config = getStatusBadgeConfig(status)
        return (
          <Badge variant={config.variant} className={config.className}>
            {config.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "due_date",
      header: ({ column }) => (
        <ColumnFilter column={column} title="Due Date" type="date" />
      ),
      cell: ({ row }) => {
        const dueDate = row.getValue("due_date") as string
        const isOverdue = dueDate && new Date(dueDate) < new Date() && row.original.status !== "complete"
        
        return (
          <div className={isOverdue ? "text-red-600 font-medium" : ""}>
            {dueDate ? getDueDays(dueDate) : 'N/A'}
          </div>
        )
      },
      filterFn: dateRangeFilter,
    },
    {
      id: "work_centre",
      accessorFn: (row) => {
        if (!row.current_work_centre_id) return "unassigned"
        const workCentre = workCentres.find(wc => wc.id === row.current_work_centre_id)
        return workCentre?.name || "Unknown"
      },
      header: ({ column }) => (
        <ColumnFilter column={column} title="Work Centre" type="select" options={workCentreOptions} />
      ),
      cell: ({ row }) => {
        const workCentreName = row.getValue("work_centre") as string
        return (
          <Badge variant={workCentreName === "unassigned" ? "outline" : "secondary"}>
            {workCentreName === "unassigned" ? "Unassigned" : workCentreName}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: () => {
        return (
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        )
      },
    },
  ]

  const handleBulkEdit = async () => {
    if (selectedOrders.length === 0) return

    try {
      // Build updates object with only valid, non-empty values
      const updates: Partial<ManufacturingOrder> = {}
      
      if (bulkEditForm.priority && bulkEditForm.priority !== KEEP_EXISTING && bulkEditForm.priority.trim() !== "") {
        updates.priority = bulkEditForm.priority as ManufacturingOrder['priority']
      }
      
      if (bulkEditForm.status && bulkEditForm.status !== KEEP_EXISTING && bulkEditForm.status.trim() !== "") {
        updates.status = bulkEditForm.status as ManufacturingOrder['status']
      }
      
      if (bulkEditForm.due_date && bulkEditForm.due_date.trim() !== "") {
        updates.due_date = bulkEditForm.due_date
      }

      if (bulkEditForm.current_work_centre_id && bulkEditForm.current_work_centre_id !== KEEP_EXISTING && bulkEditForm.current_work_centre_id.trim() !== "") {
        updates.current_work_centre_id = bulkEditForm.current_work_centre_id === "unassigned" ? null : parseInt(bulkEditForm.current_work_centre_id)
      }

      if (bulkEditForm.current_operation && bulkEditForm.current_operation.trim() !== "") {
        updates.current_operation = bulkEditForm.current_operation
      }

      if (bulkEditForm.start_date && bulkEditForm.start_date.trim() !== "") {
        updates.start_date = bulkEditForm.start_date
      }

      if (bulkEditForm.completion_date && bulkEditForm.completion_date.trim() !== "") {
        updates.completion_date = bulkEditForm.completion_date
      }

      // Only proceed if we have actual updates to apply
      if (Object.keys(updates).length === 0) {
        notify.error('No changes specified to apply')
        return
      }

      console.log('[BulkEdit] Applying updates:', updates)

      // Apply updates to each selected order
      for (const order of selectedOrders) {
        if (onOrderUpdate) {
          console.log(`[BulkEdit] Updating order ${order.id} with:`, updates)
          await onOrderUpdate(order.id, updates)
        }
      }

      setIsBulkEditOpen(false)
      setBulkEditForm({ 
        priority: "", 
        status: "", 
        due_date: "", 
        current_work_centre_id: "", 
        current_operation: "", 
        start_date: "", 
        completion_date: "" 
      })
      setSelectedOrders([])
      
      // Reset the table's internal selection state
      setResetTableSelection(true)
      setTimeout(() => setResetTableSelection(false), 100)
      
      notify.success({
        operation: 'bulk_edit_orders',
        entity: 'orders'
      })
    } catch (error) {
      console.error('Bulk edit failed:', error)
      notify.error(error as AppError, {
        operation: 'bulk_edit_orders',
        entity: 'orders'
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
        current_work_centre_id: newOrderForm.current_work_centre_id && newOrderForm.current_work_centre_id !== "unassigned" 
          ? parseInt(newOrderForm.current_work_centre_id) 
          : undefined,
        due_date: newOrderForm.due_date || undefined  // Convert empty string to undefined
      }
      
      await ordersService.create(orderData)
      
      // Reset form
      setNewOrderForm({
        order_number: '',
        stock_code: '',
        description: '',
        quantity_to_make: '',
        current_work_centre_id: '',
        priority: 'medium',
        due_date: ''
      })
      
      setIsCreateOrderDialogOpen(false)
      notify.success({
        operation: 'create_order',
        entity: 'order'
      })
      
      // Refresh the data by calling the parent's update mechanism
      // The parent component should handle refreshing the orders list
      
    } catch (error: unknown) {
      notify.error(error as AppError, {
        operation: 'create_order',
        entity: 'order'
      })
    } finally {
      setIsCreatingOrder(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary-blue">Orders Management</h2>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsCreateOrderDialogOpen(true)} 
            size="sm" 
            variant="default"
            disabled={!user || !hasPermission('orders:write')}
          >
            <Plus className="h-4 w-4 mr-2" /> Create Order
          </Button>
          {selectedOrders.length > 0 && (
            <Button 
              onClick={() => setIsBulkEditOpen(true)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Users className="h-4 w-4 mr-2" />
              Edit {selectedOrders.length} Selected
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={orders}
        searchKey="order_number"
        searchPlaceholder="Search orders..."
        onRowSelectionChange={setSelectedOrders}
        resetSelection={resetTableSelection}
      />

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
                    <Label htmlFor="quantity_to_make">Quantity *</Label>
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
                  <div className="col-span-2">
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
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm mb-2">Order characteristics and properties</p>
                  <div className="space-y-3 text-left max-w-md mx-auto">
                    <div>
                      <Label htmlFor="customer_order">Customer Order</Label>
                      <Input
                        id="customer_order"
                        placeholder="e.g., CUST-001"
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Customer reference number or code</p>
                    </div>
                    <div>
                      <Label htmlFor="batch_size">Batch Size</Label>
                      <Input
                        id="batch_size"
                        type="number"
                        placeholder="e.g., 50"
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Recommended production batch size</p>
                    </div>
                    <div>
                      <Label htmlFor="material_grade">Material Grade</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="industrial">Industrial</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">Material quality grade</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4">
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm mb-2">Advanced order configuration</p>
                  <div className="space-y-3 text-left max-w-md mx-auto">
                    <div>
                      <Label htmlFor="routing_template">Routing Template</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard Process</SelectItem>
                          <SelectItem value="expedited">Expedited</SelectItem>
                          <SelectItem value="custom">Custom Routing</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">Predefined manufacturing route</p>
                    </div>
                    <div>
                      <Label htmlFor="quality_requirements">Quality Requirements</Label>
                      <Textarea
                        id="quality_requirements"
                        placeholder="Special quality or testing requirements..."
                        rows={3}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Special quality control notes</p>
                    </div>
                    <div>
                      <Label htmlFor="special_instructions">Special Instructions</Label>
                      <Textarea
                        id="special_instructions"
                        placeholder="Additional manufacturing notes..."
                        rows={3}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Notes for production team</p>
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

      {/* Bulk Edit Dialog */}
      <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {selectedOrders.length} Selected Orders</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-priority">Priority</Label>
              <Select
                value={bulkEditForm.priority || KEEP_EXISTING}
                onValueChange={(value) => setBulkEditForm(prev => ({ ...prev, priority: value === KEEP_EXISTING ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keep existing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP_EXISTING}>Keep existing</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="bulk-status">Status</Label>
              <Select
                value={bulkEditForm.status || KEEP_EXISTING}
                onValueChange={(value) => setBulkEditForm(prev => ({ ...prev, status: value === KEEP_EXISTING ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keep existing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP_EXISTING}>Keep existing</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="bulk-due-date">Due Date</Label>
              <Input
                id="bulk-due-date"
                type="date"
                value={bulkEditForm.due_date}
                onChange={(e) => setBulkEditForm(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="bulk-work-centre">Work Centre</Label>
              <Select
                value={bulkEditForm.current_work_centre_id || KEEP_EXISTING}
                onValueChange={(value) => setBulkEditForm(prev => ({ ...prev, current_work_centre_id: value === KEEP_EXISTING ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keep existing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP_EXISTING}>Keep existing</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {workCentres?.filter(wc => wc.is_active).map(wc => (
                    <SelectItem key={wc.id} value={wc.id.toString()}>
                      {wc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="bulk-operation">Current Operation</Label>
              <Input
                id="bulk-operation"
                value={bulkEditForm.current_operation}
                onChange={(e) => setBulkEditForm(prev => ({ ...prev, current_operation: e.target.value }))}
                placeholder="Leave empty to keep existing"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bulk-start-date">Start Date</Label>
                <Input
                  id="bulk-start-date"
                  type="date"
                  value={bulkEditForm.start_date}
                  onChange={(e) => setBulkEditForm(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="bulk-completion-date">Completion Date</Label>
                <Input
                  id="bulk-completion-date"
                  type="date"
                  value={bulkEditForm.completion_date}
                  onChange={(e) => setBulkEditForm(prev => ({ ...prev, completion_date: e.target.value }))}
                  disabled={!bulkEditForm.status || bulkEditForm.status !== 'complete'}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleBulkEdit} className="flex-1">
                Apply Changes
              </Button>
              <Button variant="outline" onClick={() => setIsBulkEditOpen(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}