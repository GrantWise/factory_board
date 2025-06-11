// Job Characteristics Types
export interface JobCharacteristic {
  id: number
  order_id: number
  type: "customer_order" | "customer" | "material" | "priority" | "part_family" | "custom"
  value: string
  color: string
  display_name?: string
  is_system_generated: boolean
  created_at: string
}

export interface UserCharacteristicSettings {
  enabled: boolean
  enabledTypes: string[]
  primaryCharacteristic?: string
  secondaryCharacteristic?: string
  colorAssignment: 'automatic' | 'manual'
}

// User Settings Types
export interface UserSetting {
  id: number
  user_id: number
  setting_key: string
  setting_value: any
  created_at: string
  updated_at: string
}

export interface DefaultUserSettings {
  visual_characteristics: UserCharacteristicSettings
  planning_board: {
    autoRefresh: boolean
    refreshInterval: number
    showCompleted: boolean
  }
  notifications: {
    enabled: boolean
    orderUpdates: boolean
    systemAlerts: boolean
  }
}

// API Response Types (matching backend)
export interface ManufacturingStep {
  id: number
  step_number: number
  step: string
  operation_name: string
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
  current_work_centre_id: number | null
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
  job_characteristics?: JobCharacteristic[]
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
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  message: string
  user: User
  access_token: string
  refresh_token: string
}

// Characteristics API Response Types
export interface CharacteristicStats {
  type: string
  total_count: number
  unique_values: number
  orders_with_characteristic: number
}

export interface AvailableCharacteristic {
  type: string
  name: string
  description: string
  icon: string
  value_count: number
  sample_values: string
  sample_color: string
  detection_patterns: string[]
  is_system_defined: boolean
}

export interface CharacteristicsResponse {
  stats: CharacteristicStats[]
  available: AvailableCharacteristic[]
}

// Component Props Types
export interface OrderCardProps {
  order: ManufacturingOrder
  isDragging?: boolean
  characteristicSettings?: UserCharacteristicSettings
}

export interface CharacteristicLegendProps {
  characteristics: JobCharacteristic[]
  settings: UserCharacteristicSettings
}

export interface CharacteristicSettingsProps {
  userId: number
  settings: UserCharacteristicSettings
  onSettingsChange: (settings: UserCharacteristicSettings) => void
}

