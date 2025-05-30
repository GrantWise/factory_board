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
import { Search, Download } from "lucide-react"
import type { LegacyManufacturingOrder } from "@/types/manufacturing"

interface OrdersTableProps {
  /** Array of manufacturing orders in legacy format */
  orders: LegacyManufacturingOrder[]
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [isExporting, setIsExporting] = useState(false)

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.stockCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesPriority = priorityFilter === "all" || order.priority === priorityFilter

    return matchesSearch && matchesStatus && matchesPriority
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
   * @param status - Order status (complete, in-progress, overdue, not-started)
   * @returns CSS class string for status styling
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete":
        return "bg-green-100 text-green-800"
      case "in-progress":
        return "bg-blue-100 text-blue-800"
      case "overdue":
        return "bg-red-100 text-red-800"
      case "not-started":
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
      
      // Prepare CSV headers
      const headers = [
        'Order Number',
        'Stock Code', 
        'Description',
        'Quantity To Make',
        'Quantity Completed',
        'Progress %',
        'Current Step',
        'Priority',
        'Status',
        'Due Date',
        'Work Centre'
      ]
      
      // Convert filtered orders to CSV rows
      const csvRows = filteredOrders.map(order => {
        const completionPercentage = Math.round((order.quantityCompleted / order.quantityToMake) * 100)
        const dueDate = order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'N/A'
        
        return [
          order.orderNumber,
          order.stockCode,
          `"${order.description.replace(/"/g, '""')}"`, // Escape quotes in description
          order.quantityToMake,
          order.quantityCompleted,
          completionPercentage,
          order.currentStep,
          order.priority.toUpperCase(),
          order.status.replace('-', ' ').toUpperCase(),
          dueDate,
          order.workCentre || 'Unassigned'
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
      // Note: Could add toast notification here if available
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary-blue">Orders Management</h2>
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

      {/* Filters */}
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
            <SelectItem value="not-started">Not Started</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
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
              const completionPercentage = (order.quantityCompleted / order.quantityToMake) * 100
              const isOverdue = order.dueDate && new Date(order.dueDate) < new Date() && order.status !== "complete"

              return (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>{order.stockCode}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{order.description}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>
                          {order.quantityCompleted}/{order.quantityToMake}
                        </span>
                        <span>{Math.round(completionPercentage)}%</span>
                      </div>
                      <Progress value={completionPercentage} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell>{order.currentStep}</TableCell>
                  <TableCell>
                    <Badge variant={getPriorityColor(order.priority)}>{order.priority.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status.replace("-", " ").toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>
                    {order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'N/A'}
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
