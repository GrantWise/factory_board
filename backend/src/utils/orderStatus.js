/**
 * Order Status Utility
 * ===================
 * 
 * Centralizes order status definitions and validation.
 * This ensures consistent status handling across the application.
 */

// Define valid order statuses
const ORDER_STATUSES = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  OVERDUE: 'overdue',
  ON_HOLD: 'on_hold',
  CANCELLED: 'cancelled'
};

// Array of all valid statuses for validation
const VALID_STATUSES = Object.values(ORDER_STATUSES);

/**
 * Validates if a given status is valid
 * @param {string} status - The status to validate
 * @returns {boolean} - True if status is valid
 */
const isValidStatus = (status) => {
  return VALID_STATUSES.includes(status);
};

/**
 * Validates a status and throws an error if invalid
 * @param {string} status - The status to validate
 * @throws {Error} - If status is invalid
 */
const validateStatus = (status) => {
  if (!isValidStatus(status)) {
    throw new Error(`Invalid order status: ${status}. Valid statuses are: ${VALID_STATUSES.join(', ')}`);
  }
};

module.exports = {
  ORDER_STATUSES,
  VALID_STATUSES,
  isValidStatus,
  validateStatus
}; 