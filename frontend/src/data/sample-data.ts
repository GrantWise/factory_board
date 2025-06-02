import type { ManufacturingOrder, WorkCentre, DashboardMetrics } from "@/types/manufacturing"

export const sampleOrders: ManufacturingOrder[] = [
  {
    id: 1,
    order_number: "MO-2024-001",
    stock_code: "WIDGET-A01",
    description: "Premium Widget Assembly",
    quantity_to_make: 500,
    quantity_completed: 150,
    current_operation: "Drilling",
    current_step: "Assembly",
    work_centre_id: 2,
    work_centre_code: "ASSEMBLY-01",
    work_centre_name: "Assembly",
    status: "in_progress",
    priority: "high",
    due_date: "2024-06-15",
    start_date: "2024-06-01",
    created_by: 1,
    created_by_username: "admin",
    manufacturing_steps: [
      { 
        id: 1, step_number: 1, step: "Cutting", operation: "Rough Cut", 
        work_centre_id: 1, work_centre_code: "CUT-01", work_centre_name: "Cutting",
        status: "complete", quantity_completed: 500 
      },
      { 
        id: 2, step_number: 2, step: "Assembly", operation: "Drilling", 
        work_centre_id: 2, work_centre_code: "ASSEMBLY-01", work_centre_name: "Assembly",
        status: "in_progress", quantity_completed: 150 
      },
      { 
        id: 3, step_number: 3, step: "Quality Check", operation: "Inspection", 
        work_centre_id: 3, work_centre_code: "QC-01", work_centre_name: "Quality Control",
        status: "pending", quantity_completed: 0 
      },
      { 
        id: 4, step_number: 4, step: "Packaging", operation: "Final Pack", 
        work_centre_id: 4, work_centre_code: "PACK-01", work_centre_name: "Packaging",
        status: "pending", quantity_completed: 0 
      },
    ],
  },
  {
    id: 2,
    order_number: "MO-2024-002",
    stock_code: "GEAR-B02",
    description: "Industrial Gear Set",
    quantity_to_make: 200,
    quantity_completed: 200,
    current_operation: "Final Inspection",
    current_step: "Quality Control",
    work_centre_id: 3,
    work_centre_code: "QC-01", 
    work_centre_name: "Quality Control",
    status: "complete",
    priority: "medium",
    due_date: "2024-06-10",
    start_date: "2024-05-25",
    completion_date: "2024-06-08",
    created_by: 1,
    created_by_username: "admin",
    manufacturing_steps: [
      { 
        id: 5, step_number: 1, step: "Machining", operation: "CNC Milling", 
        work_centre_id: 5, work_centre_code: "MACH-01", work_centre_name: "Machining",
        status: "complete", quantity_completed: 200 
      },
      { 
        id: 6, step_number: 2, step: "Heat Treatment", operation: "Annealing", 
        work_centre_id: 6, work_centre_code: "HEAT-01", work_centre_name: "Heat Treatment",
        status: "complete", quantity_completed: 200 
      },
      { 
        id: 7, step_number: 3, step: "Quality Control", operation: "Final Inspection", 
        work_centre_id: 3, work_centre_code: "QC-01", work_centre_name: "Quality Control",
        status: "complete", quantity_completed: 200 
      },
    ],
  },
  {
    id: 3,
    order_number: "MO-2024-003",
    stock_code: "FRAME-C03",
    description: "Steel Frame Component",
    quantity_to_make: 100,
    quantity_completed: 0,
    work_centre_id: 1,
    work_centre_code: "CUT-01",
    work_centre_name: "Cutting",
    status: "not_started",
    priority: "low",
    due_date: "2024-06-25",
    start_date: "2024-06-20",
    created_by: 2,
    created_by_username: "scheduler",
    manufacturing_steps: [
      { 
        id: 8, step_number: 1, step: "Cutting", operation: "Plasma Cut", 
        work_centre_id: 1, work_centre_code: "CUT-01", work_centre_name: "Cutting",
        status: "pending", quantity_completed: 0 
      },
      { 
        id: 9, step_number: 2, step: "Welding", operation: "MIG Weld", 
        work_centre_id: 7, work_centre_code: "WELD-01", work_centre_name: "Welding",
        status: "pending", quantity_completed: 0 
      },
    ],
  },
]

export const sampleWorkCentres: WorkCentre[] = [
  {
    id: 1,
    name: "Cutting",
    code: "CUT-01",
    description: "Primary cutting operations",
    capacity: 10,
    current_jobs: 3,
    machines: [
      { id: 1, name: "Plasma Cutter 1", code: "PC-001", is_active: 1 },
      { id: 2, name: "Laser Cutter", code: "LC-001", is_active: 1 }
    ],
    is_active: 1,
    display_order: 1,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 2,
    name: "Assembly",
    code: "ASSEMBLY-01",
    description: "Main assembly line",
    capacity: 8,
    current_jobs: 2,
    machines: [
      { id: 3, name: "Assembly Station 1", code: "AS-001", is_active: 1 },
      { id: 4, name: "Assembly Station 2", code: "AS-002", is_active: 1 }
    ],
    is_active: 1,
    display_order: 2,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 3,
    name: "Quality Control",
    code: "QC-01",
    description: "Quality inspection and testing",
    capacity: 5,
    current_jobs: 1,
    machines: [
      { id: 5, name: "CMM Machine", code: "CMM-001", is_active: 1 }
    ],
    is_active: 1,
    display_order: 3,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 4,
    name: "Packaging",
    code: "PACK-01",
    description: "Final packaging operations",
    capacity: 6,
    current_jobs: 0,
    machines: [
      { id: 6, name: "Packing Station 1", code: "PS-001", is_active: 1 }
    ],
    is_active: 1,
    display_order: 4,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 5,
    name: "Machining",
    code: "MACH-01",
    description: "CNC machining operations",
    capacity: 4,
    current_jobs: 1,
    machines: [
      { id: 7, name: "CNC Mill 1", code: "CNC-001", is_active: 1 },
      { id: 8, name: "CNC Lathe 1", code: "CNC-002", is_active: 1 }
    ],
    is_active: 1,
    display_order: 5,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
]

export const dashboardMetrics: DashboardMetrics = {
  total_active_orders: 5,
  completion_rate: 87.5,
  work_centre_utilization: 68.8,
  daily_production: 245,
  daily_target: 300,
  overdue_orders: 1,
  average_cycle_time: 12.5,
}