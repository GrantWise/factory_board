"use client"

/**
 * OrdersTable - Comprehensive manufacturing orders management interface
 * 
 * Provides a tabular view of all manufacturing orders with advanced filtering,
 * search capabilities, and progress tracking. Displays order details including
 * completion status, priority levels, and due dates with visual indicators.
 * 
 * Features:
 * - Real-time search across order numbers, stock codes, and descriptions
 * - Multi-level filtering by status and priority
 * - Progress visualization with completion percentages
 * - Overdue order highlighting
 * - Export functionality (placeholder for CSV/Excel export)
 * 
 * Data Display:
 * - Order number, stock code, and description
 * - Visual progress bars showing completion percentage
 * - Current manufacturing step information
 * - Priority badges with color coding
 * - Status indicators with appropriate styling
 * - Due date tracking with overdue highlighting
 */

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Search, Download, Upload, X } from "lucide-react"
import type { ManufacturingOrder, WorkCentre } from "@/types/manufacturing"

// Types for import functionality
interface RawOrderData {
  order_number?: string
  stock_code?: string
  description?: string
  quantity_to_make?: string | number
  quantity_completed?: string | number
  current_operation?: string
  current_work_centre_id?: string | number
  status?: string
  priority?: string
  due_date?: string
  start_date?: string
  [key: string]: unknown
}

interface CleanedOrderData {
  order_number: string
  stock_code: string
  description: string
  quantity_to_make: number
  quantity_completed?: number
  current_operation?: string
  current_work_centre_id?: number
  status?: string
  priority?: string
  due_date?: string
  start_date?: string
}

interface ImportDetail {
  order_number: string
  status: 'created' | 'updated' | 'skipped' | 'error'
  message: string
}

interface ImportSummary {
  created: number
  updated: number
  skipped: number
  errors: number
  details: ImportDetail[]
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import Papa from "papaparse"
import React from "react"
import { ordersService } from "@/lib/api-services"
import { notify } from "@/lib/notifications"
import { type AppError } from "@/lib/error-handling"

interface OrdersTableProps {
  /** Array of manufacturing orders in API format */
  orders: ManufacturingOrder[]
  /** Array of work centres for filtering */
  workCentres?: WorkCentre[]
}

export function OrdersTable({ orders, workCentres = [] }: OrdersTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [workCentreFilter, setWorkCentreFilter] = useState("all")
  const [dueDateFilter, setDueDateFilter] = useState({
    from: "",
    to: ""
  })
  const [isExporting, setIsExporting] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.stock_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesPriority = priorityFilter === "all" || order.priority === priorityFilter
    
    const matchesWorkCentre = workCentreFilter === "all" || 
      (workCentreFilter === "unassigned" && !order.current_work_centre_id) ||
      order.current_work_centre_id?.toString() === workCentreFilter

    const matchesDueDates = (() => {
      if (!dueDateFilter.from && !dueDateFilter.to) return true
      if (!order.due_date) return false
      
      const orderDate = new Date(order.due_date)
      const fromDate = dueDateFilter.from ? new Date(dueDateFilter.from) : null
      const toDate = dueDateFilter.to ? new Date(dueDateFilter.to) : null
      
      if (fromDate && orderDate < fromDate) return false
      if (toDate && orderDate > toDate) return false
      
      return true
    })()

    return matchesSearch && matchesStatus && matchesPriority && matchesWorkCentre && matchesDueDates
  })

  /**
   * Returns appropriate badge variant for order priority level
   * @param priority - Priority level (high, medium, low)
   * @returns Badge variant string for styling
   */
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive"
      case "medium":
        return "secondary"
      case "low":
        return "outline"
      default:
        return "outline"
    }
  }

  /**
   * Returns CSS classes for status badge styling
   * @param status - Order status (complete, in_progress, overdue, not_started)
   * @returns CSS class string for status styling
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete":
        return "bg-green-100 text-green-800"
      case "in_progress":
        return "bg-blue-100 text-blue-800"
      case "overdue":
        return "bg-red-100 text-red-800"
      case "not_started":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  /**
   * Exports filtered orders to CSV format
   * Downloads file with current date timestamp
   */
  const handleExport = async () => {
    try {
      setIsExporting(true)
      
      // Prepare CSV headers - using consistent naming with import requirements
      const headers = [
        'order_number',
        'stock_code', 
        'description',
        'quantity_to_make',
        'quantity_completed',
        'progress_percent',
        'current_step',
        'priority',
        'status',
        'due_date',
        'work_centre_code'
      ]
      
      // Convert filtered orders to CSV rows
      const csvRows = filteredOrders.map(order => {
        const completionPercentage = Math.round((order.quantity_completed / order.quantity_to_make) * 100)
        const dueDate = order.due_date ? new Date(order.due_date).toLocaleDateString() : 'N/A'
        
        return [
          order.order_number,
          order.stock_code,
          `"${order.description.replace(/"/g, '""')}"`, // Escape quotes in description
          order.quantity_to_make,
          order.quantity_completed,
          completionPercentage,
          order.current_step,
          order.priority,
          order.status,
          dueDate,
          order.work_centre_code || 'Unassigned'
        ].join(',')
      })
      
      // Combine headers and rows
      const csvContent = [headers.join(','), ...csvRows].join('\n')
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `manufacturing-orders-${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
      
    } catch (error) {
      console.error('Export failed:', error)
      notify.error(error as AppError, {
        operation: 'export_orders',
        entity: 'orders'
      })
    } finally {
      setIsExporting(false)
    }
  }

  // Helper: Check for required columns in CSV header
  function hasRequiredColumns(header: string[]): boolean {
    const required = ["order_number", "stock_code", "description", "quantity_to_make"]
    const normalizedHeaders = header.map(h => h.toLowerCase().replace(/\s+/g, '_').replace('%', 'percent'))
    return required.every(col => normalizedHeaders.includes(col))
  }

  // Helper: Validate individual order data
  function validateOrderData(order: RawOrderData, index: number): string | null {
    if (!order.order_number || typeof order.order_number !== 'string' || order.order_number.trim() === '') {
      return `Row ${index + 1}: Order number is required and cannot be empty`
    }
    if (!order.stock_code || typeof order.stock_code !== 'string' || order.stock_code.trim() === '') {
      return `Row ${index + 1}: Stock code is required and cannot be empty`
    }
    if (!order.description || typeof order.description !== 'string' || order.description.trim() === '') {
      return `Row ${index + 1}: Description is required and cannot be empty`
    }
    if (!order.quantity_to_make || isNaN(Number(order.quantity_to_make)) || Number(order.quantity_to_make) <= 0) {
      return `Row ${index + 1}: Quantity to make must be a positive number`
    }
    if (order.current_work_centre_id && (isNaN(Number(order.current_work_centre_id)) || Number(order.current_work_centre_id) <= 0)) {
      return `Row ${index + 1}: Work centre ID must be a positive number if provided`
    }
    if (order.priority && !['low', 'medium', 'high', 'urgent'].includes(order.priority)) {
      return `Row ${index + 1}: Priority must be one of: low, medium, high, urgent`
    }
    if (order.status && !['not_started', 'in_progress', 'complete', 'overdue', 'on_hold', 'cancelled'].includes(order.status)) {
      return `Row ${index + 1}: Status must be one of: not_started, in_progress, complete, overdue, on_hold, cancelled`
    }
    return null
  }

  // Helper: Clean and normalize order data
  function cleanOrderData(order: RawOrderData): CleanedOrderData {
    const cleaned = {
      order_number: String(order.order_number).trim(),
      stock_code: String(order.stock_code).trim(), 
      description: String(order.description).trim(),
      quantity_to_make: Number(order.quantity_to_make),
      quantity_completed: order.quantity_completed ? Number(order.quantity_completed) : 0,
      current_operation: order.current_operation ? String(order.current_operation).trim() : undefined,
      current_work_centre_id: order.current_work_centre_id ? Number(order.current_work_centre_id) : undefined,
      status: order.status ? String(order.status).trim() : 'not_started',
      priority: order.priority ? String(order.priority).trim() : 'medium',
      due_date: order.due_date ? String(order.due_date).trim() : undefined,
      start_date: order.start_date ? String(order.start_date).trim() : undefined,
    }
    
    // Remove undefined values
    Object.keys(cleaned).forEach(key => {
      const typedKey = key as keyof CleanedOrderData
      if (cleaned[typedKey] === undefined) {
        delete cleaned[typedKey]
      }
    })
    
    return cleaned
  }

  // Handle CSV file selection and import
  const handleImportCSV = async (file: File) => {
    setImporting(true)
    setImportError(null)
    setImportSuccess(null)
    setImportSummary(null)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        // Validate and clean the data
        const cleanedRows = results.data
          .map((row: any, index: number) => {
            // Clean and validate each field
            const cleanedRow = {
              order_number: row.order_number?.trim(),
              stock_code: row.stock_code?.trim(),
              description: row.description?.trim(),
              quantity_to_make: parseInt(row.quantity_to_make) || 0,
              current_operation: row.current_operation?.trim(),
              current_work_centre_id: parseInt(row.current_work_centre_id) || null,
              status: row.status?.toLowerCase().trim(),
              priority: row.priority?.toLowerCase().trim(),
              due_date: row.due_date?.trim(),
              start_date: row.start_date?.trim()
            }

            // Validate required fields
            if (!cleanedRow.order_number) {
              throw new Error(`Row ${index + 1}: Order number is required`)
            }
            if (!cleanedRow.stock_code) {
              throw new Error(`Row ${index + 1}: Stock code is required`)
            }
            if (cleanedRow.quantity_to_make <= 0) {
              throw new Error(`Row ${index + 1}: Quantity must be greater than 0`)
            }

            return cleanedRow
          })

        // Send validated and cleaned rows to backend for processing
        try {
          const response = await ordersService.bulkImport(cleanedRows)
          setImportSummary(response)
          notify.success({
            operation: 'import_orders',
            entity: 'orders',
            additionalInfo: {
              summary: `Import completed: ${response.created} created, ${response.updated} updated, ${response.skipped} skipped, ${response.errors} errors`
            }
          })
        } catch (err: unknown) {
          notify.error(err as AppError, {
            operation: 'import_orders',
            entity: 'orders'
          })
        } finally {
          setImporting(false)
          setIsImportDialogOpen(false)
        }
      },
      error: (err) => {
        notify.error({
          status: 400,
          code: 'CSV_PARSE_ERROR',
          message: `Failed to parse CSV: ${err.message}`
        }, {
          operation: 'import_orders',
          entity: 'CSV file'
        })
        setImporting(false)
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary-blue">Orders Management</h2>
        <div className="flex gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Orders from CSV</DialogTitle>
              </DialogHeader>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files) {
                    handleImportCSV(e.target.files[0])
                  }
                }}
                disabled={importing}
                className="mb-2"
                aria-label="import"
              />
              {importError && <div className="text-red-600 text-sm">{importError}</div>}
              {importSuccess && <div className="text-green-600 text-sm">{importSuccess}</div>}
              <div className="text-xs text-gray-500 mt-2">
                Required columns: order_number, stock_code, description, quantity_to_make
              </div>
            </DialogContent>
          </Dialog>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            disabled={isExporting || filteredOrders.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>
      {/* Import summary display */}
      {importSummary && (
        <div className="bg-gray-50 border rounded p-4 mt-2">
          <div className="font-semibold mb-2">Import Summary</div>
          <ul className="text-sm space-y-1">
            {importSummary.details.map((d: ImportDetail, i: number) => (
              <li key={i} className={d.status === "created" ? "text-green-700" : d.status === "updated" ? "text-blue-700" : d.status === "skipped" ? "text-yellow-700" : "text-red-700"}>
                {d.order_number}: {d.status} - {d.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Advanced Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <Label htmlFor="work-centre-filter">Work Centre</Label>
            <Select value={workCentreFilter} onValueChange={setWorkCentreFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Work Centres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Work Centres</SelectItem>
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
            <Label htmlFor="due-date-from">Due Date From</Label>
            <Input
              id="due-date-from"
              type="date"
              value={dueDateFilter.from}
              onChange={(e) => setDueDateFilter(prev => ({ ...prev, from: e.target.value }))}
            />
          </div>
          
          <div>
            <Label htmlFor="due-date-to">Due Date To</Label>
            <Input
              id="due-date-to"
              type="date"
              value={dueDateFilter.to}
              onChange={(e) => setDueDateFilter(prev => ({ ...prev, to: e.target.value }))}
            />
          </div>
          
          {/* Clear Filters Button */}
          {(statusFilter !== "all" || priorityFilter !== "all" || workCentreFilter !== "all" || dueDateFilter.from || dueDateFilter.to) && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setStatusFilter("all")
                setPriorityFilter("all")
                setWorkCentreFilter("all")
                setDueDateFilter({ from: "", to: "" })
                setSearchTerm("")
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order Number</TableHead>
              <TableHead>Stock Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Current Step</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map((order) => {
              const completionPercentage = (order.quantity_completed / order.quantity_to_make) * 100
              const isOverdue = order.due_date && new Date(order.due_date) < new Date() && order.status !== "complete"

              return (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>{order.stock_code}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{order.description}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>
                          {order.quantity_completed}/{order.quantity_to_make}
                        </span>
                        <span>{Math.round(completionPercentage)}%</span>
                      </div>
                      <Progress value={completionPercentage} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell>{order.current_step}</TableCell>
                  <TableCell>
                    <Badge variant={getPriorityColor(order.priority)}>{order.priority.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status.replace("_", " ").toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>
                    {order.due_date ? new Date(order.due_date).toLocaleDateString() : 'N/A'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No orders found matching your criteria.</p>
        </div>
      )}
    </div>
  )
}
