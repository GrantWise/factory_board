export interface ManufacturingStep {
  step: string
  operation: string
  workCentre: string
  status: "pending" | "in-progress" | "complete"
}

export interface ManufacturingOrder {
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
  manufacturingSteps: ManufacturingStep[]
}

export interface WorkCentre {
  id: string
  name: string
  capacity: number
  currentJobs: number
  machines: string[]
  status: "active" | "inactive"
  order: number
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
