import type { ManufacturingOrder } from '@/types/manufacturing';

export interface OperationInfo {
  operation: string;
  stepNumber: number;
  progress: number;
  nextOperation?: string;
  isComplete: boolean;
}

/**
 * Calculate current operation info from manufacturing steps
 * Mirrors the backend logic from ManufacturingOrder.getCurrentOperationInfo()
 */
export function getCurrentOperationInfo(order: ManufacturingOrder): OperationInfo {
  const steps = order.manufacturing_steps || [];
  
  if (!steps.length) {
    return {
      operation: 'No steps defined',
      stepNumber: 0,
      progress: 0,
      isComplete: false
    };
  }
  
  // Sort steps by step_number
  const sortedSteps = [...steps].sort((a, b) => a.step_number - b.step_number);
  
  // Find first in_progress step, or first pending step
  const currentStep = sortedSteps.find(step => step.status === 'in_progress') ||
                     sortedSteps.find(step => step.status === 'pending');
  
  if (!currentStep) {
    // All steps complete
    return {
      operation: 'Complete',
      stepNumber: sortedSteps.length,
      progress: 100,
      isComplete: true
    };
  }
  
  const completedSteps = sortedSteps.filter(step => step.status === 'complete').length;
  const nextStep = sortedSteps.find(step => 
    step.step_number > currentStep.step_number && step.status === 'pending'
  );
  
  return {
    operation: currentStep.operation_name,
    stepNumber: currentStep.step_number,
    progress: Math.round((completedSteps / sortedSteps.length) * 100),
    nextOperation: nextStep?.operation_name,
    isComplete: false
  };
}

/**
 * Get a display-friendly operation status
 */
export function getOperationDisplay(order: ManufacturingOrder): {
  current: string;
  next?: string;
  progress: number;
  stepInfo: string;
} {
  const info = getCurrentOperationInfo(order);
  
  return {
    current: info.operation,
    next: info.nextOperation,
    progress: info.progress,
    stepInfo: info.isComplete 
      ? 'All steps complete'
      : `Step ${info.stepNumber} of ${order.manufacturing_steps?.length || 0}`
  };
}