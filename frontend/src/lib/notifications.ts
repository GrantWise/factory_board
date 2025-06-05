import { toast } from 'sonner'
import { getErrorMessage, getSuccessMessage, type AppError, type ErrorContext } from './error-handling'

/**
 * Centralized notification system using Sonner for consistent messaging
 * across the manufacturing application
 */
export const notify = {
  /**
   * Display an error notification
   * @param error - The error object or string message
   * @param context - Optional context for better error messaging
   */
  error: (error: AppError | string, context?: ErrorContext) => {
    const message = typeof error === 'string' 
      ? error 
      : getErrorMessage(error, context)
    toast.error(message)
  },
  
  /**
   * Display a success notification
   * @param context - Context describing the successful operation
   */
  success: (context: ErrorContext) => {
    const message = getSuccessMessage(context)
    toast.success(message)
  },
  
  /**
   * Display an informational notification
   * @param message - The info message to display
   */
  info: (message: string) => toast.info(message),
  
  /**
   * Display a warning notification
   * @param message - The warning message to display
   */
  warning: (message: string) => toast(message, { 
    style: { backgroundColor: '#fbbf24', color: '#000' } 
  })
}