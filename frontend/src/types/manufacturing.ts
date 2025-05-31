// API Response Types (matching backend)
export interface ManufacturingStep {
  id: number
  stepNumber: number
  step: string
  operation: string
  workCentreId: number
  workCentreCode: string
  workCentreName: string
  status: "pending" | "in_progress" | "complete" | "skipped"
  plannedDurationMinutes?: number
  actualDurationMinutes?: number
  quantityCompleted: number
  startedAt?: string
  completedAt?: string
}

export interface ManufacturingOrder {
  id: number
  orderNumber: string
  stockCode: string
  description: string
  quantityToMake: number
  quantityCompleted: number
  currentOperation?: string
  currentStep?: string
  workCentreId?: number
  workCentreCode?: string
  workCentreName?: string
  status: "not_started" | "in_progress" | "complete" | "overdue" | "on_hold" | "cancelled"
  priority: "low" | "medium" | "high" | "urgent"
  dueDate?: string
  startDate?: string
  completionDate?: string
  createdBy: number
  createdByUsername: string
  manufacturingSteps: ManufacturingStep[]
}

export interface Machine {
  id: number
  name: string
  code: string
  description?: string
  is_active: number
}

export interface WorkCentre {
  id: number
  name: string
  code: string
  description?: string
  capacity: number
  display_order: number
  is_active: number
  created_at: string
  updated_at: string
  current_jobs: number
  currentJobs?: number // For backward compatibility
  machines: Machine[]
  utilizationPercent?: number
  orders?: ManufacturingOrder[]
}

export interface DashboardMetrics {
  totalActiveOrders: number
  completionRate: number
  workCentreUtilization: number
  dailyProduction: number
  dailyTarget: number
  overdueOrders: number
  averageCycleTime: number
}

// API Response interfaces
export interface OrdersResponse {
  orders: ManufacturingOrder[]
  count: number
}

export interface WorkCentresResponse {
  workCentres: WorkCentre[]
}

export interface PlanningBoardResponse {
  workCentres: WorkCentre[]
  orders: ManufacturingOrder[]
  ordersByWorkCentre: Record<string, ManufacturingOrder[]>
  activeLocks: Record<string, any>
  summary: {
    totalWorkCentres: number
    totalOrders: number
    totalActiveOrders: number
    totalCompletedOrders: number
    totalOverdueOrders: number
    activeDragOperations: number
  }
  lastUpdated: string
}

// User types
export interface User {
  id: number
  username: string
  email: string
  role: "admin" | "scheduler" | "viewer"
  first_name: string
  last_name: string
  is_active: number
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  message: string
  user: User
  accessToken: string
  refreshToken: string
}

// Legacy types for backward compatibility
export interface LegacyManufacturingStep {
  step: string
  operation: string
  workCentre: string
  status: "pending" | "in-progress" | "complete"
}

export interface LegacyManufacturingOrder {
  id: string
  orderNumber: string
  stockCode: string
  description: string
  quantityToMake: number
  quantityCompleted: number
  currentOperation: string
  currentStep: string
  workCentre: string
  status: "not-started" | "in-progress" | "complete" | "overdue"
  priority: "low" | "medium" | "high"
  dueDate: string
  startDate: string
  manufacturingSteps: LegacyManufacturingStep[]
}

export interface LegacyWorkCentre {
  id: string
  name: string
  capacity: number
  currentJobs: number
  machines: string[]
  status: "active" | "inactive"
  order: number
}
