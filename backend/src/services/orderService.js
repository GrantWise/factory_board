const ManufacturingOrder = require('../models/ManufacturingOrder');
const ManufacturingStep = require('../models/ManufacturingStep');
const WorkCentre = require('../models/WorkCentre');
const AuditLog = require('../models/AuditLog');
const { createLogger } = require('../utils/logger');

const logger = createLogger('OrderService');

/**
 * Order Service
 * =============
 * 
 * Business logic layer for manufacturing order operations.
 * Extracted from OrdersController to improve separation of concerns and reduce complexity.
 * 
 * This service handles:
 * - Order validation and business rules
 * - Complex order operations (import, move, reorder)
 * - Order status management
 * - Integration with external systems
 */
class OrderService {
  /**
   * Validate order data for creation or update
   * @param {Object} orderData - Order data to validate
   * @param {boolean} isUpdate - Whether this is an update operation
   * @returns {Object} Validation result with isValid and errors properties
   */
  validateOrderData(orderData, isUpdate = false) {
    const errors = [];

    // Required fields for creation
    if (!isUpdate) {
      if (!orderData.order_number) errors.push('Order number is required');
      if (!orderData.stock_code) errors.push('Stock code is required');
      if (!orderData.description) errors.push('Description is required');
      if (!orderData.quantity_to_make || orderData.quantity_to_make <= 0) {
        errors.push('Quantity to make must be greater than 0');
      }
    }

    // Validate quantity fields
    if (orderData.quantity_to_make !== undefined && orderData.quantity_to_make < 0) {
      errors.push('Quantity to make cannot be negative');
    }
    if (orderData.quantity_completed !== undefined && orderData.quantity_completed < 0) {
      errors.push('Quantity completed cannot be negative');
    }

    // Validate work centre if provided
    if (orderData.current_work_centre_id) {
      const workCentre = WorkCentre.findById(orderData.current_work_centre_id);
      if (!workCentre) {
        errors.push('Invalid work centre ID');
      }
    }

    // Validate dates
    if (orderData.due_date) {
      const dueDate = new Date(orderData.due_date);
      if (isNaN(dueDate.getTime())) {
        errors.push('Invalid due date format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check for order number conflicts
   * @param {string} orderNumber - Order number to check
   * @param {number} excludeId - Order ID to exclude from check (for updates)
   * @returns {boolean} True if conflict exists
   */
  hasOrderNumberConflict(orderNumber, excludeId = null) {
    return ManufacturingOrder.orderNumberExists(orderNumber, excludeId);
  }

  /**
   * Create a new manufacturing order with business logic validation
   * @param {Object} orderData - Order creation data
   * @param {number} userId - User ID for audit trail
   * @returns {Object} Created order object
   * @throws {Error} If validation fails or business rules are violated
   */
  async createOrder(orderData, userId) {
    logger.info('Creating new order', { order_number: orderData.order_number, user_id: userId });

    // Validate order data
    const validation = this.validateOrderData(orderData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Check for duplicates
    if (this.hasOrderNumberConflict(orderData.order_number)) {
      throw new Error('Order number already exists');
    }

    // Set creation metadata
    orderData.created_by = userId;

    // Create the order
    const order = ManufacturingOrder.create(orderData);

    // Create manufacturing steps if provided
    if (orderData.manufacturing_steps && orderData.manufacturing_steps.length > 0) {
      try {
        ManufacturingStep.createStepsForOrder(order.id, orderData.manufacturing_steps);
        // Refresh order data to include steps
        const orderWithSteps = ManufacturingOrder.findById(order.id);
        order.manufacturingSteps = orderWithSteps.manufacturingSteps;
      } catch (error) {
        logger.error('Failed to create manufacturing steps', { 
          order_id: order.id, 
          error: error.message 
        });
        // Don't fail order creation if steps fail
      }
    }

    // Log the creation
    AuditLog.create({
      event_type: 'order_created',
      order_id: order.id,
      user_id: userId,
      event_data: {
        order_number: order.orderNumber,
        stock_code: order.stockCode,
        created_by: 'system' // Will be replaced with actual username in controller
      }
    });

    logger.info('Order created successfully', { 
      order_id: order.id, 
      order_number: order.order_number 
    });

    return order;
  }

  /**
   * Import multiple orders with validation and conflict resolution
   * @param {Array} orders - Array of order objects to import
   * @param {number} userId - User ID for audit trail
   * @param {Object} options - Import options
   * @param {boolean} options.updateExisting - Whether to update existing orders
   * @param {boolean} options.validateOnly - Only validate without saving
   * @returns {Object} Import summary with results
   */
  async importOrders(orders, userId, options = {}) {
    const { updateExisting = false, validateOnly = false } = options;
    
    logger.info('Starting order import', { 
      order_count: orders.length, 
      user_id: userId,
      options 
    });

    // Track order numbers in this batch to prevent duplicates
    const batchOrderNumbers = new Set();
    const summary = {
      total: orders.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    for (const [index, orderData] of orders.entries()) {
      const result = { 
        index: index + 1,
        order_number: orderData.order_number 
      };

      try {
        // Check for duplicate order numbers in the batch
        if (batchOrderNumbers.has(orderData.order_number)) {
          result.status = 'error';
          result.message = 'Duplicate order number in import batch';
          summary.errors++;
          summary.details.push(result);
          continue;
        }
        batchOrderNumbers.add(orderData.order_number);

        // Validate order data
        const validation = this.validateOrderData(orderData);
        if (!validation.isValid) {
          result.status = 'error';
          result.message = `Validation failed: ${validation.errors.join('; ')}`;
          summary.errors++;
          summary.details.push(result);
          continue;
        }

        // Skip processing if validate only
        if (validateOnly) {
          result.status = 'valid';
          result.message = 'Validation passed';
          summary.details.push(result);
          continue;
        }

        // Check if order exists
        const existingOrder = ManufacturingOrder.findAll({ order_number: orderData.order_number })[0];
        
        if (!existingOrder) {
          // Create new order
          const newOrder = await this.createOrder(orderData, userId);
          result.status = 'created';
          result.message = 'Order created successfully';
          result.order_id = newOrder.id;
          summary.created++;
        } else if (updateExisting && existingOrder.status === 'not_started') {
          // Update existing order (only if not started)
          const updateData = { ...orderData };
          delete updateData.order_number; // Don't change order number
          
          const updatedOrder = ManufacturingOrder.update(existingOrder.id, updateData);
          
          AuditLog.create({
            event_type: 'order_updated',
            order_id: existingOrder.id,
            user_id: userId,
            event_data: {
              order_number: updatedOrder.orderNumber,
              updated_fields: Object.keys(updateData),
              source: 'import'
            }
          });

          result.status = 'updated';
          result.message = 'Order updated successfully';
          result.order_id = existingOrder.id;
          summary.updated++;
        } else {
          result.status = 'skipped';
          result.message = existingOrder.status === 'not_started' 
            ? 'Order exists and update not enabled'
            : 'Order already in progress or complete';
          summary.skipped++;
        }

      } catch (error) {
        logger.error('Import error for order', { 
          order_number: orderData.order_number, 
          error: error.message 
        });
        
        result.status = 'error';
        result.message = error.message || 'Unknown error occurred';
        summary.errors++;
      }

      summary.details.push(result);
    }

    logger.info('Order import completed', summary);
    return summary;
  }

  /**
   * Move an order to a different work centre with business logic validation
   * @param {number} orderId - Order ID to move
   * @param {number} toWorkCentreId - Destination work centre ID
   * @param {number} userId - User performing the move
   * @param {string} reason - Reason for the move
   * @param {number|null} newPosition - Specific position in destination work centre
   * @returns {Object} Updated order object
   * @throws {Error} If move operation fails validation
   */
  async moveOrder(orderId, toWorkCentreId, userId, reason = 'user_decision', newPosition = null) {
    logger.info('Moving order', { 
      order_id: orderId, 
      to_work_centre_id: toWorkCentreId, 
      user_id: userId,
      reason 
    });

    // Validate order exists
    const order = ManufacturingOrder.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    // Validate destination work centre
    const toWorkCentre = WorkCentre.findById(toWorkCentreId);
    if (!toWorkCentre) {
      throw new Error('Invalid destination work centre');
    }

    // Business rule: Can't move completed or cancelled orders
    if (['complete', 'cancelled'].includes(order.status)) {
      throw new Error(`Cannot move ${order.status} orders`);
    }

    // Check work centre capacity if configured
    if (toWorkCentre.capacity && toWorkCentre.capacity > 0) {
      const currentLoad = ManufacturingOrder.getWorkCentreQueueDepth(toWorkCentreId);
      if (currentLoad >= toWorkCentre.capacity) {
        logger.warn('Work centre at capacity', { 
          work_centre_id: toWorkCentreId, 
          current_load: currentLoad, 
          capacity: toWorkCentre.capacity 
        });
        // Allow move but log warning - business might want to override capacity
      }
    }

    // Perform the move
    const updatedOrder = ManufacturingOrder.moveToWorkCentre(
      orderId,
      toWorkCentreId,
      userId,
      reason,
      newPosition
    );

    logger.info('Order moved successfully', { 
      order_id: orderId, 
      from_work_centre: order.current_work_centre_id,
      to_work_centre: toWorkCentreId 
    });

    return updatedOrder;
  }

  /**
   * Update order status with business logic validation
   * @param {number} orderId - Order ID to update
   * @param {string} newStatus - New status value
   * @param {number} userId - User making the change
   * @param {string} reason - Reason for status change
   * @returns {Object} Updated order object
   * @throws {Error} If status change is invalid
   */
  async updateOrderStatus(orderId, newStatus, userId, reason = '') {
    logger.info('Updating order status', { 
      order_id: orderId, 
      new_status: newStatus, 
      user_id: userId 
    });

    const order = ManufacturingOrder.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const oldStatus = order.status;

    // Business rules for status transitions
    const validTransitions = {
      'not_started': ['in_progress', 'on_hold', 'cancelled'],
      'in_progress': ['complete', 'on_hold', 'cancelled', 'overdue'],
      'on_hold': ['not_started', 'in_progress', 'cancelled'],
      'overdue': ['in_progress', 'complete', 'cancelled'],
      'complete': [], // Generally no transitions from complete
      'cancelled': [] // Generally no transitions from cancelled
    };

    if (!validTransitions[oldStatus]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${oldStatus} to ${newStatus}`);
    }

    // Update completion date when marking complete
    const updateData = { status: newStatus };
    if (newStatus === 'complete') {
      updateData.completion_date = new Date().toISOString();
    }

    const updatedOrder = ManufacturingOrder.update(orderId, updateData);

    // Log status change
    AuditLog.logOrderStatusChange(orderId, oldStatus, newStatus, userId);

    logger.info('Order status updated successfully', { 
      order_id: orderId, 
      old_status: oldStatus,
      new_status: newStatus 
    });

    return updatedOrder;
  }
}

module.exports = new OrderService();