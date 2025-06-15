/**
 * Order Service
 * =============
 * 
 * Business logic layer for manufacturing order operations.
 * Extracts complex business rules and validation from controllers.
 * Provides a clean API for order management operations.
 */

const ManufacturingOrder = require('../models/ManufacturingOrder');
const ManufacturingStep = require('../models/ManufacturingStep');
const WorkCentre = require('../models/WorkCentre');
const AuditLog = require('../models/AuditLog');

class OrderService {
  /**
   * Get all orders with filtering and business logic
   * @param {Object} filters - Filter parameters
   * @param {string} [filters.status] - Order status filter
   * @param {string} [filters.priority] - Priority filter
   * @param {number} [filters.work_centre_id] - Work centre filter
   * @param {string} [filters.due_before] - Due date filter
   * @param {string} [filters.search] - Search term
   * @returns {Object} Orders array and metadata
   */
  static getAllOrders(filters = {}) {
    // Sanitize and validate filters
    const cleanFilters = this._sanitizeFilters(filters);
    
    const orders = ManufacturingOrder.findAll(cleanFilters);
    
    return {
      orders,
      count: orders.length,
      filters: cleanFilters
    };
  }

  /**
   * Get a single order by ID with full details
   * @param {number} orderId - Order ID
   * @returns {Object|null} Order with steps and characteristics
   * @throws {Error} If order not found
   */
  static getOrderById(orderId) {
    const order = ManufacturingOrder.findById(orderId);
    
    if (!order) {
      const error = new Error('Order not found');
      error.code = 'NOT_FOUND';
      error.status = 404;
      throw error;
    }
    
    return order;
  }

  /**
   * Create a new manufacturing order with business validation
   * @param {Object} orderData - Order creation data
   * @param {number} userId - ID of user creating the order
   * @param {string} username - Username for audit trail
   * @returns {Object} Created order
   * @throws {Error} If validation fails
   */
  static async createOrder(orderData, userId, username) {
    // Validate required fields
    this._validateOrderData(orderData);
    
    // Check for duplicate order number
    if (ManufacturingOrder.orderNumberExists(orderData.order_number)) {
      const error = new Error('Order number already exists');
      error.code = 'DUPLICATE_ORDER_NUMBER';
      error.status = 409;
      throw error;
    }
    
    // Validate work centre if provided
    if (orderData.current_work_centre_id) {
      this._validateWorkCentre(orderData.current_work_centre_id);
    }
    
    // Set creation metadata
    const enrichedOrderData = {
      ...orderData,
      created_by: userId
    };
    
    // Create the order
    const order = ManufacturingOrder.create(enrichedOrderData);
    
    // Create manufacturing steps if provided
    if (orderData.manufacturing_steps && orderData.manufacturing_steps.length > 0) {
      ManufacturingStep.createStepsForOrder(order.id, orderData.manufacturing_steps);
      
      // Refresh order data to include steps
      const orderWithSteps = ManufacturingOrder.findById(order.id);
      order.manufacturing_steps = orderWithSteps.manufacturing_steps;
    }
    
    // Create audit log entry
    this._logOrderCreation(order, userId, username);
    
    return order;
  }

  /**
   * Update an existing manufacturing order
   * @param {number} orderId - Order ID to update
   * @param {Object} updates - Update data
   * @param {number} userId - ID of user making the update
   * @param {string} username - Username for audit trail
   * @returns {Object} Updated order
   * @throws {Error} If validation fails or order not found
   */
  static async updateOrder(orderId, updates, userId, username) {
    // Check if order exists
    const existingOrder = ManufacturingOrder.findById(orderId);
    if (!existingOrder) {
      const error = new Error('Order not found');
      error.code = 'NOT_FOUND';
      error.status = 404;
      throw error;
    }
    
    // Validate updates
    this._validateOrderUpdates(updates, orderId);
    
    // Validate work centre if being updated
    if (updates.current_work_centre_id) {
      this._validateWorkCentre(updates.current_work_centre_id);
    }
    
    // Log status changes if applicable
    if (updates.status && updates.status !== existingOrder.status) {
      AuditLog.logOrderStatusChange(
        orderId,
        existingOrder.status,
        updates.status,
        userId
      );
    }
    
    // Perform the update
    const order = ManufacturingOrder.update(orderId, updates);
    
    // Create audit log entry
    this._logOrderUpdate(order, updates, userId, username);
    
    return order;
  }

  /**
   * Delete an order with business rules
   * @param {number} orderId - Order ID to delete
   * @param {number} userId - ID of user performing deletion
   * @param {string} username - Username for audit trail
   * @returns {Object} Deletion result with message
   * @throws {Error} If order not found
   */
  static async deleteOrder(orderId, userId, username) {
    const order = ManufacturingOrder.findById(orderId);
    if (!order) {
      const error = new Error('Order not found');
      error.code = 'NOT_FOUND';
      error.status = 404;
      throw error;
    }
    
    // Business rule: Only hard delete if not_started, otherwise soft delete
    if (order.status === 'not_started') {
      return this._hardDeleteOrder(order, userId, username);
    } else {
      return this._softDeleteOrder(order, userId, username);
    }
  }

  /**
   * Move an order between work centres
   * @param {number} orderId - Order ID to move
   * @param {number} fromWorkCentreId - Source work centre ID
   * @param {number} toWorkCentreId - Destination work centre ID
   * @param {string} [newOperation] - New operation name
   * @param {number} userId - ID of user performing the move
   * @param {string} username - Username for audit trail
   * @returns {Object} Updated order
   * @throws {Error} If validation fails
   */
  static async moveOrderBetweenWorkCentres(orderId, fromWorkCentreId, toWorkCentreId, newOperation, userId, username) {
    // Validate order exists
    const order = this.getOrderById(orderId);
    
    // Validate work centres
    this._validateWorkCentre(fromWorkCentreId);
    this._validateWorkCentre(toWorkCentreId);
    
    // Verify current work centre matches
    if (order.current_work_centre_id !== fromWorkCentreId) {
      const error = new Error('Order is not currently at the specified work centre');
      error.code = 'INVALID_WORK_CENTRE_TRANSITION';
      error.status = 400;
      throw error;
    }
    
    // Prepare update data
    const updates = {
      current_work_centre_id: toWorkCentreId
    };
    
    if (newOperation) {
      updates.current_operation = newOperation;
    }
    
    // Update the order
    const updatedOrder = await this.updateOrder(orderId, updates, userId, username);
    
    // Log the move operation
    AuditLog.create({
      event_type: 'order_moved',
      order_id: orderId,
      user_id: userId,
      event_data: {
        order_number: order.order_number,
        from_work_centre_id: fromWorkCentreId,
        to_work_centre_id: toWorkCentreId,
        new_operation: newOperation,
        moved_by: username
      }
    });
    
    return updatedOrder;
  }

  /**
   * Get orders summary statistics
   * @returns {Object} Summary statistics
   */
  static getOrdersSummary() {
    const allOrders = ManufacturingOrder.findAll();
    
    const summary = {
      total_orders: allOrders.length,
      by_status: {},
      by_priority: {},
      overdue: 0
    };
    
    const today = new Date().toISOString().split('T')[0];
    
    allOrders.forEach(order => {
      // Count by status
      summary.by_status[order.status] = (summary.by_status[order.status] || 0) + 1;
      
      // Count by priority
      summary.by_priority[order.priority] = (summary.by_priority[order.priority] || 0) + 1;
      
      // Count overdue orders
      if (order.due_date && order.due_date < today && order.status !== 'complete') {
        summary.overdue++;
      }
    });
    
    return summary;
  }

  // Private helper methods

  /**
   * Sanitize and validate filter parameters
   * @private
   */
  static _sanitizeFilters(filters) {
    const cleanFilters = {};
    
    if (filters.status) cleanFilters.status = filters.status;
    if (filters.priority) cleanFilters.priority = filters.priority;
    if (filters.search) cleanFilters.search = filters.search;
    if (filters.due_before) cleanFilters.due_before = filters.due_before;
    
    if (filters.work_centre_id) {
      const workCentreId = parseInt(filters.work_centre_id);
      if (!isNaN(workCentreId)) {
        cleanFilters.work_centre_id = workCentreId;
      }
    }
    
    return cleanFilters;
  }

  /**
   * Validate order creation data
   * @private
   */
  static _validateOrderData(orderData) {
    if (!orderData.order_number) {
      const error = new Error('Order number is required');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }
    
    if (!orderData.stock_code) {
      const error = new Error('Stock code is required');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }
    
    if (!orderData.quantity_to_make || orderData.quantity_to_make <= 0) {
      const error = new Error('Quantity to make must be a positive number');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }
  }

  /**
   * Validate order update data
   * @private
   */
  static _validateOrderUpdates(updates, orderId) {
    // Check for order number conflicts
    if (updates.order_number && ManufacturingOrder.orderNumberExists(updates.order_number, orderId)) {
      const error = new Error('Order number already exists');
      error.code = 'DUPLICATE_ORDER_NUMBER';
      error.status = 409;
      throw error;
    }
    
    // Validate quantity if being updated
    if (updates.quantity_to_make !== undefined && updates.quantity_to_make <= 0) {
      const error = new Error('Quantity to make must be a positive number');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }
  }

  /**
   * Validate work centre exists and is active
   * @private
   */
  static _validateWorkCentre(workCentreId) {
    const workCentre = WorkCentre.findById(workCentreId);
    if (!workCentre) {
      const error = new Error('Invalid work centre ID');
      error.code = 'INVALID_WORK_CENTRE';
      error.status = 400;
      throw error;
    }
    
    if (!workCentre.is_active) {
      const error = new Error('Work centre is not active');
      error.code = 'INACTIVE_WORK_CENTRE';
      error.status = 400;
      throw error;
    }
  }

  /**
   * Perform hard delete of order
   * @private
   */
  static _hardDeleteOrder(order, userId, username) {
    ManufacturingOrder.delete(order.id);
    
    AuditLog.create({
      event_type: 'order_deleted',
      order_id: order.id,
      user_id: userId,
      event_data: {
        order_number: order.order_number,
        stock_code: order.stock_code,
        deleted_by: username
      }
    });
    
    return {
      message: 'Order deleted successfully',
      type: 'hard_delete'
    };
  }

  /**
   * Perform soft delete of order (cancel status)
   * @private
   */
  static _softDeleteOrder(order, userId, username) {
    ManufacturingOrder.update(order.id, { status: 'cancelled' });
    
    AuditLog.create({
      event_type: 'order_soft_deleted',
      order_id: order.id,
      user_id: userId,
      event_data: {
        order_number: order.order_number,
        stock_code: order.stock_code,
        soft_deleted_by: username
      }
    });
    
    return {
      message: 'Order was in progress or completed and has been cancelled (soft deleted)',
      type: 'soft_delete'
    };
  }

  /**
   * Log order creation in audit trail
   * @private
   */
  static _logOrderCreation(order, userId, username) {
    AuditLog.create({
      event_type: 'order_created',
      order_id: order.id,
      user_id: userId,
      event_data: {
        order_number: order.order_number,
        stock_code: order.stock_code,
        created_by: username
      }
    });
  }

  /**
   * Log order update in audit trail
   * @private
   */
  static _logOrderUpdate(order, updates, userId, username) {
    AuditLog.create({
      event_type: 'order_updated',
      order_id: order.id,
      user_id: userId,
      event_data: {
        order_number: order.order_number,
        updated_fields: Object.keys(updates),
        updated_by: username
      }
    });
  }
}

module.exports = OrderService;