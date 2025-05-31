/**
 * Centralized Error Handling Middleware
 * ====================================
 *
 * This middleware handles all errors thrown in the application after routes/controllers.
 * It standardizes error responses and logs server errors for debugging.
 *
 * Error Handling Strategy:
 * - Controllers and routes use next(err) to propagate errors here.
 * - Validation errors are handled by the validation middleware and do not reach this handler.
 * - All other errors (database, logic, unexpected) are caught here and returned in a consistent format.
 * - Server errors (status 500+) are logged for debugging.
 *
 * Example error response:
 *   {
 *     error: 'Error message',
 *     code: 'ERROR_CODE',
 *     details: {...} // optional
 *   }
 *
 * Usage:
 *   Place this middleware after all routes in your Express app.
 *   app.use(errorHandler);
 */

function errorHandler(err, req, res, next) {
  // Default to 500 Internal Server Error if status not set
  const status = err.status || 500;

  // Standard error response structure
  const errorResponse = {
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
  };

  // Optionally include details for validation or custom errors
  if (err.details) {
    errorResponse.details = err.details;
  }

  // Log server errors (not client errors)
  if (status >= 500) {
    // In production, consider logging to a file or external service
    // For now, log to the console for visibility
    // eslint-disable-next-line no-console
    console.error('Server Error:', err);
  }

  // Send the standardized error response
  res.status(status).json(errorResponse);
}

module.exports = errorHandler; 