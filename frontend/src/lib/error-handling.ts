/**
 * Centralized error handling utilities for consistent error messages
 * across the manufacturing application
 */

export interface AppError {
  status?: number
  code?: string
  error?: string
  message?: string
  details?: any
}

export interface ErrorContext {
  operation: string
  entity?: string
  id?: string | number
  additionalInfo?: Record<string, any>
}

/**
 * Standard error messages for common HTTP status codes
 */
const HTTP_ERROR_MESSAGES = {
  400: 'Invalid request. Please check your input and try again.',
  401: 'Authentication required. Please log in to continue.',
  403: 'Permission denied. You do not have access to perform this action.',
  404: 'The requested resource was not found.',
  409: 'Conflict detected. The resource may have been modified by another user.',
  422: 'Validation failed. Please check your input data.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Server error. Please try again later or contact support.',
  502: 'Service temporarily unavailable. Please try again later.',
  503: 'Service temporarily unavailable. Please try again later.',
  0: 'Network error. Please check your connection and try again.'
} as const

/**
 * Operation-specific error messages for better user experience
 */
const OPERATION_ERROR_MESSAGES = {
  login: {
    401: 'Invalid username or password. Please try again.',
    429: 'Too many login attempts. Please wait a few minutes before trying again.'
  },
  create_order: {
    400: 'Failed to create order. Please check all required fields.',
    409: 'An order with this number already exists.',
    422: 'Invalid order data. Please check quantity and dates.'
  },
  move_order: {
    403: 'You do not have permission to move orders.',
    404: 'Order or work centre not found.',
    409: 'Order is currently being moved by another user.'
  },
  reorder_orders: {
    403: 'You do not have permission to reorder orders.',
    409: 'Orders have been modified by another user. Please refresh and try again.'
  },
  create_work_centre: {
    400: 'Failed to create work centre. Please check all required fields.',
    409: 'A work centre with this code already exists.'
  },
  update_work_centre: {
    403: 'You do not have permission to modify work centres.',
    404: 'Work centre not found.',
    409: 'Work centre has been modified by another user.'
  },
  reorder_work_centres: {
    403: 'You do not have permission to reorder work centres.'
  },
  import_orders: {
    400: 'Invalid CSV format or data. Please check your file.',
    413: 'File is too large. Please use a smaller CSV file.',
    422: 'CSV contains invalid data. Please check the error details.'
  },
  create_user: {
    400: 'Failed to create user. Please check all required fields.',
    409: 'A user with this username or email already exists.',
    422: 'Password does not meet security requirements.'
  },
  update_user: {
    403: 'You do not have permission to modify users.',
    404: 'User not found.'
  }
} as const

/**
 * Gets a user-friendly error message based on the error and context
 */
export function getErrorMessage(error: AppError, context?: ErrorContext): string {
  const status = error.status || 0
  const operation = context?.operation
  const entity = context?.entity || 'item'
  
  // Check for operation-specific messages first
  if (operation && OPERATION_ERROR_MESSAGES[operation as keyof typeof OPERATION_ERROR_MESSAGES]) {
    const operationMessages = OPERATION_ERROR_MESSAGES[operation as keyof typeof OPERATION_ERROR_MESSAGES]
    if (operationMessages[status as keyof typeof operationMessages]) {
      return operationMessages[status as keyof typeof operationMessages]
    }
  }
  
  // Use custom error message if provided and meaningful
  if (error.error && error.error !== 'Request failed') {
    return error.error
  }
  
  if (error.message && error.message !== 'Request failed') {
    return error.message
  }
  
  // Use standard HTTP error messages
  if (HTTP_ERROR_MESSAGES[status as keyof typeof HTTP_ERROR_MESSAGES]) {
    return HTTP_ERROR_MESSAGES[status as keyof typeof HTTP_ERROR_MESSAGES]
  }
  
  // Fallback message with context
  if (operation) {
    switch (operation) {
      case 'create':
      case 'create_order':
      case 'create_work_centre':
      case 'create_user':
        return `Failed to create ${entity}. Please try again.`
      case 'update':
      case 'update_order':
      case 'update_work_centre':
      case 'update_user':
        return `Failed to update ${entity}. Please try again.`
      case 'delete':
      case 'delete_order':
      case 'delete_work_centre':
      case 'delete_user':
        return `Failed to delete ${entity}. Please try again.`
      case 'move':
      case 'move_order':
        return `Failed to move ${entity}. Please try again.`
      case 'reorder':
      case 'reorder_orders':
      case 'reorder_work_centres':
        return `Failed to reorder ${entity}. Please try again.`
      case 'login':
        return 'Login failed. Please check your credentials and try again.'
      case 'import':
      case 'import_orders':
        return 'Import failed. Please check your file and try again.'
      default:
        return `Operation failed. Please try again.`
    }
  }
  
  return 'An unexpected error occurred. Please try again.'
}

/**
 * Gets a success message based on the operation and context
 */
export function getSuccessMessage(context: ErrorContext): string {
  const operation = context.operation
  const entity = context.entity || 'item'
  const id = context.id
  
  switch (operation) {
    case 'create':
    case 'create_order':
    case 'create_work_centre':
    case 'create_user':
      return `${entity.charAt(0).toUpperCase() + entity.slice(1)} created successfully${id ? ` (${id})` : ''}`
    case 'update':
    case 'update_order':
    case 'update_work_centre':
    case 'update_user':
      return `${entity.charAt(0).toUpperCase() + entity.slice(1)} updated successfully`
    case 'delete':
    case 'delete_order':
    case 'delete_work_centre':
    case 'delete_user':
      return `${entity.charAt(0).toUpperCase() + entity.slice(1)} deleted successfully`
    case 'move':
    case 'move_order':
      return `${entity.charAt(0).toUpperCase() + entity.slice(1)} moved successfully`
    case 'reorder':
    case 'reorder_orders':
      return 'Orders reordered successfully'
    case 'reorder_work_centres':
      return 'Work centres reordered successfully'
    case 'login':
      return 'Logged in successfully'
    case 'logout':
      return 'Logged out successfully'
    case 'import':
    case 'import_orders':
      return context.additionalInfo?.summary || 'Import completed successfully'
    default:
      return 'Operation completed successfully'
  }
}

/**
 * Checks if an error indicates the user needs to authenticate
 */
export function isAuthError(error: AppError): boolean {
  return error.status === 401 || error.code === 'INVALID_TOKEN'
}

/**
 * Checks if an error indicates a permission issue
 */
export function isPermissionError(error: AppError): boolean {
  return error.status === 403
}

/**
 * Checks if an error indicates a network/connectivity issue
 */
export function isNetworkError(error: AppError): boolean {
  return error.status === 0 || error.status === 502 || error.status === 503
}

/**
 * Checks if an error should be logged (not auth/permission errors during normal operation)
 */
export function shouldLogError(error: AppError): boolean {
  return !isAuthError(error) && error.status !== 429 // Don't log auth errors or rate limiting
}

/**
 * Extracts validation errors from a 422 response
 */
export function getValidationErrors(error: AppError): string[] {
  if (error.status !== 422) return []
  
  const details = error.details
  if (!details) return []
  
  if (Array.isArray(details)) {
    return details.map(detail => {
      if (typeof detail === 'string') return detail
      if (detail.message) return detail.message
      if (detail.error) return detail.error
      return JSON.stringify(detail)
    })
  }
  
  if (typeof details === 'object') {
    const errors: string[] = []
    Object.entries(details).forEach(([field, messages]) => {
      if (Array.isArray(messages)) {
        messages.forEach(message => errors.push(`${field}: ${message}`))
      } else {
        errors.push(`${field}: ${messages}`)
      }
    })
    return errors
  }
  
  return []
}