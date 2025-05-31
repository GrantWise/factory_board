import type { ManufacturingOrder, WorkCentre, DashboardMetrics, Machine } from "@/types/manufacturing"

export const sampleOrders: ManufacturingOrder[] = [
  {
    id: 1,
    orderNumber: "MO-2024-001",
    stockCode: "WIDGET-A01",
    description: "Premium Widget Assembly",
    quantityToMake: 500,
    quantityCompleted: 150,
    currentOperation: "Drilling",
    currentStep: "Assembly",
    workCentreId: 2,
    workCentreCode: "ASSEMBLY-01",
    workCentreName: "Assembly",
    status: "in_progress",
    priority: "high",
    dueDate: "2024-06-15",
    startDate: "2024-06-01",
    createdBy: 1,
    createdByUsername: "admin",
    manufacturingSteps: [
      { 
        id: 1, stepNumber: 1, step: "Cutting", operation: "Rough Cut", 
        workCentreId: 1, workCentreCode: "CUT-01", workCentreName: "Cutting",
        status: "complete", quantityCompleted: 500 
      },
      { 
        id: 2, stepNumber: 2, step: "Assembly", operation: "Drilling", 
        workCentreId: 2, workCentreCode: "ASSEMBLY-01", workCentreName: "Assembly",
        status: "in_progress", quantityCompleted: 150 
      },
      { 
        id: 3, stepNumber: 3, step: "Quality Check", operation: "Inspection", 
        workCentreId: 3, workCentreCode: "QC-01", workCentreName: "Quality Control",
        status: "pending", quantityCompleted: 0 
      },
      { 
        id: 4, stepNumber: 4, step: "Packaging", operation: "Final Pack", 
        workCentreId: 4, workCentreCode: "PACK-01", workCentreName: "Packaging",
        status: "pending", quantityCompleted: 0 
      },
    ],
  },
  {
    id: 2,
    orderNumber: "MO-2024-002",
    stockCode: "GEAR-B02",
    description: "Industrial Gear Set",
    quantityToMake: 200,
    quantityCompleted: 200,
    currentOperation: "Final Pack",
    currentStep: "Packaging",
    workCentreId: 4,
    workCentreCode: "PACK-01",
    workCentreName: "Packaging",
    status: "complete",
    priority: "medium",
    dueDate: "2024-06-10",
    startDate: "2024-05-25",
    createdBy: 1,
    createdByUsername: "admin",
    manufacturingSteps: [
      { 
        id: 5, stepNumber: 1, step: "Cutting", operation: "Precision Cut", 
        workCentreId: 1, workCentreCode: "CUT-01", workCentreName: "Cutting",
        status: "complete", quantityCompleted: 200 
      },
      { 
        id: 6, stepNumber: 2, step: "Assembly", operation: "Gear Assembly", 
        workCentreId: 2, workCentreCode: "ASSEMBLY-01", workCentreName: "Assembly",
        status: "complete", quantityCompleted: 200 
      },
      { 
        id: 7, stepNumber: 3, step: "Quality Check", operation: "Inspection", 
        workCentreId: 3, workCentreCode: "QC-01", workCentreName: "Quality Control",
        status: "complete", quantityCompleted: 200 
      },
      { 
        id: 8, stepNumber: 4, step: "Packaging", operation: "Final Pack", 
        workCentreId: 4, workCentreCode: "PACK-01", workCentreName: "Packaging",
        status: "complete", quantityCompleted: 200 
      },
    ],
  },
  {
    id: 3,
    orderNumber: "MO-2024-003",
    stockCode: "MOTOR-C03",
    description: "Electric Motor Unit",
    quantityToMake: 100,
    quantityCompleted: 0,
    currentOperation: "Rough Cut",
    currentStep: "Cutting",
    workCentreId: 1,
    workCentreCode: "CUT-01",
    workCentreName: "Cutting",
    status: "not_started",
    priority: "low",
    dueDate: "2024-06-20",
    startDate: "2024-06-05",
    createdBy: 1,
    createdByUsername: "admin",
    manufacturingSteps: [
      { 
        id: 9, stepNumber: 1, step: "Cutting", operation: "Rough Cut", 
        workCentreId: 1, workCentreCode: "CUT-01", workCentreName: "Cutting",
        status: "pending", quantityCompleted: 0 
      },
      { 
        id: 10, stepNumber: 2, step: "Assembly", operation: "Motor Assembly", 
        workCentreId: 2, workCentreCode: "ASSEMBLY-01", workCentreName: "Assembly",
        status: "pending", quantityCompleted: 0 
      },
      { 
        id: 11, stepNumber: 3, step: "Quality Check", operation: "Testing", 
        workCentreId: 3, workCentreCode: "QC-01", workCentreName: "Quality Control",
        status: "pending", quantityCompleted: 0 
      },
      { 
        id: 12, stepNumber: 4, step: "Packaging", operation: "Motor Pack", 
        workCentreId: 4, workCentreCode: "PACK-01", workCentreName: "Packaging",
        status: "pending", quantityCompleted: 0 
      },
    ],
  },
]

export const workCentres: WorkCentre[] = [
  {
    id: 1,
    code: "CUT-01",
    name: "Cutting",
    capacity: 5,
    current_jobs: 3,
    machines: [
      { id: 1, code: "CUT-01", name: "Cutting Machine 1", is_active: 1 },
      { id: 2, code: "CUT-02", name: "Cutting Machine 2", is_active: 1 },
      { id: 3, code: "CUT-03", name: "Cutting Machine 3", is_active: 1 }
    ],
    is_active: 1,
    display_order: 1,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 2,
    code: "ASSEMBLY-01",
    name: "Assembly",
    capacity: 8,
    current_jobs: 5,
    machines: [
      { id: 4, code: "ASM-01", name: "Assembly Machine 1", is_active: 1 },
      { id: 5, code: "ASM-02", name: "Assembly Machine 2", is_active: 1 }
    ],
    is_active: 1,
    display_order: 2,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 3,
    code: "QC-01",
    name: "Quality Control",
    capacity: 5,
    current_jobs: 2,
    machines: [
      { id: 6, code: "QC-01", name: "QC Machine 1", is_active: 1 },
      { id: 7, code: "QC-02", name: "QC Machine 2", is_active: 1 },
      { id: 8, code: "QC-03", name: "QC Machine 3", is_active: 1 }
    ],
    is_active: 1,
    display_order: 3,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 4,
    code: "PACK-01",
    name: "Packaging",
    capacity: 6,
    current_jobs: 1,
    machines: [
      { id: 9, code: "PACK-01", name: "Packaging Machine 1", is_active: 1 },
      { id: 10, code: "PACK-02", name: "Packaging Machine 2", is_active: 1 }
    ],
    is_active: 1,
    display_order: 4,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 5,
    code: "SHIP-01",
    name: "Shipping",
    capacity: 4,
    current_jobs: 0,
    machines: [
      { id: 11, code: "SHIP-01", name: "Shipping Machine 1", is_active: 1 }
    ],
    is_active: 1,
    display_order: 5,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
]

export const dashboardMetrics: DashboardMetrics = {
  totalActiveOrders: 5,
  completionRate: 87.5,
  workCentreUtilization: 68.8,
  dailyProduction: 245,
  dailyTarget: 300,
  overdueOrders: 1,
  averageCycleTime: 12.5,
}