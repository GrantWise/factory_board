// API Response Types (matching backend)
export interface ManufacturingStep {
  id: number
  step_number: number
  step: string
  operation: string
  work_centre_id: number
  work_centre_code: string
  work_centre_name: string
  status: "pending" | "in_progress" | "complete" | "skipped"
  planned_duration_minutes?: number
  actual_duration_minutes?: number
  quantity_completed: number
  started_at?: string
  completed_at?: string
}

export interface ManufacturingOrder {
  id: number
  order_number: string
  stock_code: string
  description: string
  quantity_to_make: number
  quantity_completed: number
  current_operation?: string
  current_step?: string
  current_work_centre_id?: number
  work_centre_code?: string
  work_centre_name?: string
  status: "not_started" | "in_progress" | "complete" | "overdue" | "on_hold" | "cancelled"
  priority: "low" | "medium" | "high" | "urgent"
  due_date?: string
  start_date?: string
  completion_date?: string
  created_by: number
  created_by_username: string
  created_at?: string
  updated_at?: string
  manufacturing_steps: ManufacturingStep[]
}

export interface Machine {
  id: number
  name: string
  code: string
  description?: string
  is_active: boolean
}

export interface WorkCentre {
  id: number
  name: string
  code: string
  description?: string
  capacity: number
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  current_jobs: number
  currentJobs?: number // For backward compatibility
  machines: Machine[]
  utilizationPercent?: number
  orders?: ManufacturingOrder[]
}

export interface DashboardMetrics {
  total_active_orders: number
  completion_rate: number
  work_centre_utilization: number
  daily_production: number
  daily_target: number
  overdue_orders: number
  average_cycle_time: number
}

// API Response interfaces
export interface OrdersResponse {
  orders: ManufacturingOrder[]
  count: number
}

export interface WorkCentresResponse {
  work_centres: WorkCentre[]
}

export interface PlanningBoardResponse {
  work_centres: WorkCentre[]
  orders: ManufacturingOrder[]
  orders_by_work_centre: Record<string, ManufacturingOrder[]>
  active_locks: Record<string, any>
  summary: {
    total_work_centres: number
    total_orders: number
    total_active_orders: number
    total_completed_orders: number
    total_overdue_orders: number
    active_drag_operations: number
  }
  last_updated: string
}

// User types
export interface User {
  id: number
  username: string
  email: string
  role: "admin" | "scheduler" | "viewer"
  first_name: string
  last_name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  message: string
  user: User
  access_token: string
  refresh_token: string
}

