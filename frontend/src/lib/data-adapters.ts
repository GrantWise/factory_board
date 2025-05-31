import type {
  ManufacturingOrder,
  WorkCentre,
  DashboardMetrics,
  LegacyManufacturingOrder,
  LegacyWorkCentre,
  LegacyManufacturingStep,
} from '@/types/manufacturing';

// Convert API ManufacturingOrder to Legacy format for existing components
export function adaptOrderToLegacy(order: ManufacturingOrder): LegacyManufacturingOrder {
  const mapStatus = (status: string): "not-started" | "in-progress" | "complete" | "overdue" => {
    switch (status) {
      case 'not_started': return 'not-started';
      case 'in_progress': return 'in-progress';
      case 'complete': return 'complete';
      case 'overdue': return 'overdue';
      case 'on_hold': return 'in-progress'; // Map to closest equivalent
      case 'cancelled': return 'overdue'; // Map to closest equivalent
      default: return 'not-started';
    }
  };

  const mapStepStatus = (status: string): "pending" | "in-progress" | "complete" => {
    switch (status) {
      case 'pending': return 'pending';
      case 'in_progress': return 'in-progress';
      case 'complete': return 'complete';
      case 'skipped': return 'complete'; // Map to closest equivalent
      default: return 'pending';
    }
  };

  return {
    id: order.id.toString(),
    orderNumber: order.orderNumber,
    stockCode: order.stockCode,
    description: order.description,
    quantityToMake: order.quantityToMake,
    quantityCompleted: order.quantityCompleted,
    currentOperation: order.currentOperation || '',
    currentStep: order.currentStep || '',
    workCentre: order.workCentreCode || '',
    status: mapStatus(order.status),
    priority: order.priority === 'urgent' ? 'high' : order.priority as "low" | "medium" | "high",
    dueDate: order.dueDate || '',
    startDate: order.startDate || '',
    manufacturingSteps: order.manufacturingSteps.map((step): LegacyManufacturingStep => ({
      step: step.step,
      operation: step.operation,
      workCentre: step.workCentreCode,
      status: mapStepStatus(step.status),
    })),
  };
}

// Convert API WorkCentre to Legacy format for existing components
export function adaptWorkCentreToLegacy(workCentre: WorkCentre): LegacyWorkCentre {
  return {
    id: workCentre.code, // Use code as ID for legacy compatibility
    name: workCentre.name,
    capacity: workCentre.capacity,
    currentJobs: workCentre.current_jobs || workCentre.currentJobs || 0,
    machines: workCentre.machines.map(machine => machine.code),
    status: workCentre.is_active ? 'active' : 'inactive',
    order: workCentre.display_order,
  };
}

// Convert arrays of orders and work centres
export function adaptOrdersToLegacy(orders: ManufacturingOrder[]): LegacyManufacturingOrder[] {
  return orders.map(adaptOrderToLegacy);
}

export function adaptWorkCentresToLegacy(workCentres: WorkCentre[]): LegacyWorkCentre[] {
  return workCentres.map(adaptWorkCentreToLegacy);
}

// Calculate dashboard metrics from API data
export function calculateDashboardMetrics(
  orders: ManufacturingOrder[],
  workCentres: WorkCentre[]
): DashboardMetrics {
  const activeOrders = orders.filter(order => 
    order.status === 'in_progress' || order.status === 'not_started'
  );
  
  const completedOrders = orders.filter(order => order.status === 'complete');
  const overdueOrders = orders.filter(order => order.status === 'overdue');
  
  // Calculate completion rate
  const totalOrders = orders.length;
  const completionRate = totalOrders > 0 ? (completedOrders.length / totalOrders) * 100 : 0;
  
  // Calculate work centre utilization
  const totalCapacity = workCentres.reduce((sum, wc) => sum + wc.capacity, 0);
  const totalCurrentJobs = workCentres.reduce((sum, wc) => sum + (wc.current_jobs || 0), 0);
  const workCentreUtilization = totalCapacity > 0 ? (totalCurrentJobs / totalCapacity) * 100 : 0;
  
  // Calculate daily production (sum of completed quantities today)
  const today = new Date().toISOString().split('T')[0];
  const dailyProduction = orders
    .filter(order => order.completionDate?.startsWith(today))
    .reduce((sum, order) => sum + order.quantityCompleted, 0);
  
  // Estimate daily target (this would typically come from business rules)
  const dailyTarget = Math.max(300, dailyProduction * 1.2);
  
  // Calculate average cycle time (simplified - would need more data in real implementation)
  const averageCycleTime = 12.5; // Placeholder
  
  return {
    totalActiveOrders: activeOrders.length,
    completionRate: Math.round(completionRate * 10) / 10,
    workCentreUtilization: Math.round(workCentreUtilization * 10) / 10,
    dailyProduction,
    dailyTarget,
    overdueOrders: overdueOrders.length,
    averageCycleTime,
  };
}

// Transform planning board data for drag & drop
export function transformPlanningBoardData(
  workCentres: WorkCentre[],
  orders: ManufacturingOrder[]
) {
  const workCentreMap = new Map(workCentres.map(wc => [wc.id, wc]));
  
  // Group orders by work centre
  const ordersByWorkCentre = orders.reduce((acc, order) => {
    const workCentreId = order.workCentreId;
    if (workCentreId && workCentreMap.has(workCentreId)) {
      const key = workCentreId.toString();
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(order);
    }
    return acc;
  }, {} as Record<string, ManufacturingOrder[]>);
  
  return {
    workCentres: workCentres.map(wc => ({
      ...wc,
      currentJobs: ordersByWorkCentre[wc.id.toString()]?.length || 0,
      orders: ordersByWorkCentre[wc.id.toString()] || [],
    })),
    ordersByWorkCentre,
  };
}

// Convert work centre ID between string and number formats
export function getWorkCentreIdFromCode(code: string, workCentres: WorkCentre[]): number | null {
  const workCentre = workCentres.find(wc => wc.code === code);
  return workCentre ? workCentre.id : null;
}

export function getWorkCentreCodeFromId(id: number, workCentres: WorkCentre[]): string | null {
  const workCentre = workCentres.find(wc => wc.id === id);
  return workCentre ? workCentre.code : null;
}