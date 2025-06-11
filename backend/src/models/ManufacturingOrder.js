const { getDatabase } = require('../utils/database');
const { validateStatus } = require('../utils/orderStatus');
const JobCharacteristic = require('./JobCharacteristic');

/**
 * ManufacturingOrder Model
 * ========================
 *
 * Handles database operations for manufacturing orders including CRUD operations,
 * order movements, status updates, and characteristic management.
 *
 * Key Features:
 * - Optimized bulk queries to prevent N+1 query issues
 * - Transaction support for data consistency
 * - Comprehensive audit logging for all operations
 * - Work centre position management for kanban board
 */
class ManufacturingOrder {
  constructor() {
    this.db = getDatabase();
    this.table = 'manufacturing_orders';
  }

  /**
   * Create a new manufacturing order
   * @param {Object} orderData - Order creation data
   * @param {string} orderData.order_number - Unique order identifier
   * @param {string} orderData.stock_code - Product/part stock code
   * @param {string} orderData.description - Order description
   * @param {number} orderData.quantity_to_make - Target quantity to manufacture
   * @param {number} [orderData.quantity_completed=0] - Initial completed quantity
   * @param {string} [orderData.current_operation] - Current operation name
   * @param {number} [orderData.current_work_centre_id] - Initial work centre assignment
   * @param {string} [orderData.status='not_started'] - Initial order status
   * @param {string} [orderData.priority='medium'] - Order priority level
   * @param {string} [orderData.due_date] - Due date in ISO format
   * @param {number} orderData.created_by - User ID who created the order
   * @returns {Object} Created order object with all fields
   */
  create(orderData) {
    const sqlParams = [
      orderData.order_number,
      orderData.stock_code,
      orderData.description,
      orderData.quantity_to_make,
      orderData.quantity_completed || 0,
      orderData.current_operation || null,
      orderData.current_work_centre_id || null,
      orderData.status || 'not_started',
      orderData.priority || 'medium',
      orderData.due_date ? orderData.due_date instanceof Date ? orderData.due_date.toISOString() : orderData.due_date : null,
      orderData.start_date ? orderData.start_date instanceof Date ? orderData.start_date.toISOString() : orderData.start_date : null,
      orderData.created_by
    ];

    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (
        order_number, stock_code, description, quantity_to_make, quantity_completed,
        current_operation, current_work_centre_id, status, priority, due_date, start_date, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(...sqlParams);
    const newOrder = this.findById(result.lastInsertRowid);

    // Auto-detect and create job characteristics
    if (newOrder) {
      try {
        JobCharacteristic.detectAndCreateCharacteristics(newOrder);
      } catch (error) {
        console.error('Job characteristic detection failed:', error.message);
        // Don't throw - order creation should succeed even if characteristics fail
      }
    }

    return newOrder;
  }

  /**
   * Find a manufacturing order by ID with all related data
   * @param {number} id - Order ID
   * @returns {Object|null} Order object with work centre and user details, manufacturing steps, and job characteristics, or null if not found
   */
  findById(id) {
    const order = this.db.prepare(`
      SELECT 
        mo.*,
        wc.code as work_centre_code,
        wc.name as work_centre_name,
        u.username as created_by_username
      FROM ${this.table} mo
      LEFT JOIN work_centres wc ON mo.current_work_centre_id = wc.id
      LEFT JOIN users u ON mo.created_by = u.id
      WHERE mo.id = ?
    `).get(id);

    if (!order) return null;

    // Get manufacturing steps
    order.manufacturing_steps = this.db.prepare(`
      SELECT 
        ms.*,
        wc.code as work_centre_code,
        wc.name as work_centre_name
      FROM manufacturing_steps ms
      LEFT JOIN work_centres wc ON ms.work_centre_id = wc.id
      WHERE ms.order_id = ?
      ORDER BY ms.step_number
    `).all(id);

    // Get job characteristics
    order.job_characteristics = JobCharacteristic.findByOrderId(id);

    return order;
  }

  /**
   * Build WHERE clause and parameters for order filtering
   * @param {Object} filters - Filter criteria
   * @returns {Object} Object with whereClause string and params array
   * @private
   */
  _buildWhereClause(filters) {
    const whereConditions = [];
    const params = [];

    if (filters.status) {
      whereConditions.push('mo.status = ?');
      params.push(filters.status);
    }

    if (filters.priority) {
      whereConditions.push('mo.priority = ?');
      params.push(filters.priority);
    }

    if (filters.work_centre_id) {
      whereConditions.push('mo.current_work_centre_id = ?');
      params.push(filters.work_centre_id);
    }

    if (filters.due_before) {
      whereConditions.push('mo.due_date <= ?');
      params.push(filters.due_before);
    }

    if (filters.search) {
      whereConditions.push('(mo.order_number LIKE ? OR mo.stock_code LIKE ? OR mo.description LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    return { whereClause, params };
  }

  /**
   * Fetch orders with joined work centre and user data
   * @param {string} whereClause - SQL WHERE clause
   * @param {Array} params - SQL parameters
   * @returns {Array} Array of order objects with basic data
   * @private
   */
  _fetchOrdersWithJoins(whereClause, params) {
    return this.db.prepare(`
      SELECT 
        mo.*,
        wc.code as work_centre_code,
        wc.name as work_centre_name,
        u.username as created_by_username
      FROM ${this.table} mo
      LEFT JOIN work_centres wc ON mo.current_work_centre_id = wc.id
      LEFT JOIN users u ON mo.created_by = u.id
      ${whereClause}
      ORDER BY 
        mo.current_work_centre_id ASC,
        mo.work_centre_position ASC,
        CASE mo.status 
          WHEN 'overdue' THEN 1
          WHEN 'in_progress' THEN 2
          WHEN 'not_started' THEN 3
          ELSE 4
        END,
        mo.due_date ASC,
        mo.priority DESC
    `).all(...params);
  }

  /**
   * Fetch related data (steps and characteristics) for orders in bulk
   * @param {Array} orderIds - Array of order IDs
   * @returns {Object} Object with steps and characteristics arrays
   * @private
   */
  _fetchRelatedDataInBulk(orderIds) {
    const placeholders = orderIds.map(() => '?').join(',');

    const allSteps = this.db.prepare(`
      SELECT 
        ms.*,
        wc.code as work_centre_code,
        wc.name as work_centre_name
      FROM manufacturing_steps ms
      LEFT JOIN work_centres wc ON ms.work_centre_id = wc.id
      WHERE ms.order_id IN (${placeholders})
      ORDER BY ms.order_id, ms.step_number
    `).all(...orderIds);

    const allCharacteristics = this.db.prepare(`
      SELECT * FROM job_characteristics 
      WHERE order_id IN (${placeholders})
      ORDER BY order_id, type, value
    `).all(...orderIds);

    return { allSteps, allCharacteristics };
  }

  /**
   * Group and attach related data to order objects
   * @param {Array} orders - Array of order objects
   * @param {Array} allSteps - Array of manufacturing steps
   * @param {Array} allCharacteristics - Array of job characteristics
   * @returns {Array} Orders with attached related data
   * @private
   */
  _attachRelatedDataToOrders(orders, allSteps, allCharacteristics) {
    const stepsByOrderId = {};
    const characteristicsByOrderId = {};

    allSteps.forEach(step => {
      if (!stepsByOrderId[step.order_id]) {
        stepsByOrderId[step.order_id] = [];
      }
      stepsByOrderId[step.order_id].push(step);
    });

    allCharacteristics.forEach(characteristic => {
      if (!characteristicsByOrderId[characteristic.order_id]) {
        characteristicsByOrderId[characteristic.order_id] = [];
      }
      characteristicsByOrderId[characteristic.order_id].push(characteristic);
    });

    orders.forEach(order => {
      order.manufacturing_steps = stepsByOrderId[order.id] || [];
      order.job_characteristics = characteristicsByOrderId[order.id] || [];
    });

    return orders;
  }

  /**
   * Get all manufacturing orders with optional filtering (optimized for performance)
   * @param {Object} [filters={}] - Filter criteria
   * @param {string} [filters.status] - Filter by order status
   * @param {string} [filters.priority] - Filter by priority level
   * @param {number} [filters.work_centre_id] - Filter by current work centre
   * @param {string} [filters.due_before] - Filter by due date (ISO string)
   * @param {string} [filters.search] - Search in order number, stock code, or description
   * @returns {Array} Array of order objects with manufacturing steps and job characteristics
   * @note Uses optimized bulk queries to prevent N+1 query issues
   */
  findAll(filters = {}) {
    const { whereClause, params } = this._buildWhereClause(filters);
    const orders = this._fetchOrdersWithJoins(whereClause, params);

    if (orders.length > 0) {
      const orderIds = orders.map(order => order.id);
      const { allSteps, allCharacteristics } = this._fetchRelatedDataInBulk(orderIds);
      return this._attachRelatedDataToOrders(orders, allSteps, allCharacteristics);
    }

    return orders;
  }

  // Update order
  update(id, orderData) {
    const fields = [];
    const values = [];

    if (orderData.order_number !== undefined) {
      fields.push('order_number = ?');
      values.push(orderData.order_number);
    }
    if (orderData.stock_code !== undefined) {
      fields.push('stock_code = ?');
      values.push(orderData.stock_code);
    }
    if (orderData.description !== undefined) {
      fields.push('description = ?');
      values.push(orderData.description);
    }
    if (orderData.quantity_to_make !== undefined) {
      fields.push('quantity_to_make = ?');
      values.push(orderData.quantity_to_make);
    }
    if (orderData.quantity_completed !== undefined) {
      fields.push('quantity_completed = ?');
      values.push(orderData.quantity_completed);
    }
    if (orderData.current_operation !== undefined) {
      fields.push('current_operation = ?');
      values.push(orderData.current_operation);
    }
    if (orderData.current_work_centre_id !== undefined) {
      fields.push('current_work_centre_id = ?');
      values.push(orderData.current_work_centre_id);
    }
    if (orderData.status !== undefined) {
      fields.push('status = ?');
      values.push(orderData.status);
    }
    if (orderData.priority !== undefined) {
      fields.push('priority = ?');
      values.push(orderData.priority);
    }
    if (orderData.due_date !== undefined) {
      fields.push('due_date = ?');
      values.push(orderData.due_date);
    }
    if (orderData.start_date !== undefined) {
      fields.push('start_date = ?');
      values.push(orderData.start_date);
    }
    if (orderData.completion_date !== undefined) {
      fields.push('completion_date = ?');
      values.push(orderData.completion_date);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  /**
   * Validate that a move operation is valid
   * @param {number} orderId - Order ID to validate
   * @returns {Object} Order object if valid
   * @throws {Error} If order not found
   * @private
   */
  _validateMoveOperation(orderId) {
    const order = this.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    return order;
  }

  /**
   * Calculate and reserve the new position for an order in a work centre
   * @param {number} toWorkCentreId - Destination work centre ID
   * @param {number|null} requestedPosition - Requested position (null = end of queue)
   * @returns {number} Final position to use
   * @private
   */
  _calculateAndReservePosition(toWorkCentreId, requestedPosition) {
    if (requestedPosition === null) {
      const maxPosition = this.db.prepare(`
        SELECT COALESCE(MAX(work_centre_position), 0) as max_pos
        FROM ${this.table}
        WHERE current_work_centre_id = ?
      `).get(toWorkCentreId);
      return (maxPosition?.max_pos || 0) + 1;
    } else {
      const finalPosition = Math.max(1, Math.floor(requestedPosition));

      // Shift existing positions to make room
      this.db.prepare(`
        UPDATE ${this.table}
        SET work_centre_position = work_centre_position + 1
        WHERE current_work_centre_id = ? 
        AND work_centre_position >= ?
      `).run(toWorkCentreId, finalPosition);

      return finalPosition;
    }
  }

  /**
   * Update order position and work centre
   * @param {number} orderId - Order ID to update
   * @param {number} toWorkCentreId - New work centre ID
   * @param {number} newPosition - New position in work centre
   * @returns {Object} Updated order object
   * @private
   */
  _updateOrderPosition(orderId, toWorkCentreId, newPosition) {
    return this.update(orderId, {
      current_work_centre_id: toWorkCentreId,
      work_centre_position: newPosition
    });
  }

  /**
   * Log the move operation in audit trail
   * @param {Object} moveData - Move operation data
   * @param {number} moveData.orderId - Order ID
   * @param {number} moveData.fromWorkCentreId - Source work centre ID
   * @param {number} moveData.toWorkCentreId - Destination work centre ID
   * @param {number} moveData.userId - User performing the move
   * @param {string} moveData.reason - Reason for the move
   * @param {string} moveData.orderNumber - Order number for reference
   * @param {number} moveData.newPosition - Final position
   * @private
   */
  _logMoveAuditTrail(moveData) {
    const { orderId, fromWorkCentreId, toWorkCentreId, userId, reason, orderNumber, newPosition } = moveData;

    this.db.prepare(`
      INSERT INTO audit_log (
        event_type, order_id, from_work_centre_id, to_work_centre_id, user_id, 
        event_data, queue_depth_from, queue_depth_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'order_moved',
      orderId,
      fromWorkCentreId,
      toWorkCentreId,
      userId,
      JSON.stringify({ reason, order_number: orderNumber, new_position: newPosition }),
      this.getWorkCentreQueueDepth(fromWorkCentreId),
      this.getWorkCentreQueueDepth(toWorkCentreId)
    );
  }

  /**
   * Move a manufacturing order to a different work centre with audit logging
   * @param {number} orderId - Order ID to move
   * @param {number} toWorkCentreId - Destination work centre ID
   * @param {number} userId - User ID performing the move (for audit trail)
   * @param {string} [reason='user_decision'] - Reason for the move
   * @param {number|null} [newPosition=null] - Specific position in destination work centre (null = end of queue)
   * @returns {Object} Updated order object
   * @note Uses database transaction to ensure data consistency
   */
  moveToWorkCentre(orderId, toWorkCentreId, userId, reason = 'user_decision', newPosition = null) {
    const transaction = this.db.transaction(() => {
      const order = this._validateMoveOperation(orderId);
      const fromWorkCentreId = order.current_work_centre_id;
      const finalPosition = this._calculateAndReservePosition(toWorkCentreId, newPosition);

      this._updateOrderPosition(orderId, toWorkCentreId, finalPosition);

      this._logMoveAuditTrail({
        orderId,
        fromWorkCentreId,
        toWorkCentreId,
        userId,
        reason,
        orderNumber: order.order_number,
        newPosition: finalPosition
      });

      return this.findById(orderId);
    });

    return transaction();
  }

  // Get queue depth for a work centre
  getWorkCentreQueueDepth(workCentreId) {
    if (!workCentreId) return 0;

    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM ${this.table}
      WHERE current_work_centre_id = ? AND status IN ('not_started', 'in_progress')
    `).get(workCentreId);

    return result.count;
  }

  // Check if order number exists
  orderNumberExists(orderNumber, excludeId = null) {
    let stmt;
    if (excludeId) {
      stmt = this.db.prepare('SELECT id FROM manufacturing_orders WHERE order_number = ? AND id != ?');
      return !!stmt.get(orderNumber, excludeId);
    } else {
      stmt = this.db.prepare('SELECT id FROM manufacturing_orders WHERE order_number = ?');
      return !!stmt.get(orderNumber);
    }
  }

  // Delete an order and all related data with proper cleanup
  delete(orderId) {
    const transaction = this.db.transaction(() => {
      // Delete manufacturing steps first (foreign key constraint)
      this.db.prepare('DELETE FROM manufacturing_steps WHERE order_id = ?').run(orderId);

      // Delete audit logs related to this order
      this.db.prepare('DELETE FROM audit_log WHERE order_id = ?').run(orderId);

      // Delete scanner events related to this order
      this.db.prepare('DELETE FROM scanner_events WHERE order_id = ?').run(orderId);

      // Delete the order
      const result = this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(orderId);

      if (result.changes === 0) {
        throw new Error('Order not found');
      }

      return result;
    });

    return transaction();
  }

  // Get current step name from manufacturing steps
  getCurrentStep(manufacturingSteps) {
    if (!manufacturingSteps || manufacturingSteps.length === 0) {
      return null;
    }

    // Find the first step that's not complete
    const currentStep = manufacturingSteps.find(step => step.status !== 'complete');
    return currentStep ? currentStep.operation_name : manufacturingSteps[manufacturingSteps.length - 1].operation_name;
  }

  // Reorder orders within a work centre
  reorderInWorkCentre(workCentreId, orderPositions) {
    const transaction = this.db.transaction(() => {
      // First, verify all orders belong to the specified work centre
      const orderIds = orderPositions.map(op => op.order_id);
      const placeholders = orderIds.map(() => '?').join(',');

      const verifyStmt = this.db.prepare(`
        SELECT id FROM ${this.table} 
        WHERE id IN (${placeholders}) AND current_work_centre_id = ?
      `);

      const existingOrders = verifyStmt.all(...orderIds, workCentreId);

      if (existingOrders.length !== orderIds.length) {
        throw new Error('Some orders do not belong to the specified work centre');
      }

      // Validate positions are positive integers
      for (const { position } of orderPositions) {
        if (!Number.isInteger(position) || position < 1) {
          throw new Error('Positions must be positive integers');
        }
      }

      // Update positions in a single transaction
      const updateStmt = this.db.prepare(`
        UPDATE ${this.table} 
        SET work_centre_position = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND current_work_centre_id = ?
      `);

      let totalChanges = 0;
      for (const { order_id, position } of orderPositions) {
        const result = updateStmt.run(position, order_id, workCentreId);
        totalChanges += result.changes;
      }

      // Compact positions to remove gaps
      this.compactWorkCentrePositions(workCentreId);

      return { changes: totalChanges };
    });

    return transaction();
  }

  // Compact positions to remove gaps
  compactWorkCentrePositions(workCentreId) {
    const orders = this.db.prepare(`
      SELECT id, work_centre_position
      FROM ${this.table}
      WHERE current_work_centre_id = ?
      ORDER BY work_centre_position
    `).all(workCentreId);

    // Update positions sequentially
    const updateStmt = this.db.prepare(`
      UPDATE ${this.table}
      SET work_centre_position = ?
      WHERE id = ?
    `);

    orders.forEach((order, index) => {
      const newPosition = index + 1;
      if (order.work_centre_position !== newPosition) {
        updateStmt.run(newPosition, order.id);
      }
    });
  }


  // Get current operation information from manufacturing steps
  getCurrentOperationInfo(orderId) {
    const steps = this.db.prepare(`
      SELECT *
      FROM manufacturing_steps 
      WHERE order_id = ?
      ORDER BY step_number ASC
    `).all(orderId);

    if (!steps.length) {
      return {
        operation: 'No steps defined',
        stepNumber: 0,
        progress: 0,
        isComplete: false
      };
    }

    // Find first in_progress step, or first pending step
    const currentStep = steps.find(step => step.status === 'in_progress') ||
                       steps.find(step => step.status === 'pending');

    if (!currentStep) {
      // All steps complete
      return {
        operation: 'Complete',
        stepNumber: steps.length,
        progress: 100,
        isComplete: true
      };
    }

    const completedSteps = steps.filter(step => step.status === 'complete').length;
    const nextStep = steps.find(step =>
      step.step_number > currentStep.step_number && step.status === 'pending'
    );

    return {
      operation: currentStep.operation_name,
      stepNumber: currentStep.step_number,
      progress: Math.round(completedSteps / steps.length * 100),
      nextOperation: nextStep?.operation_name,
      isComplete: false
    };
  }

  // Update current operation based on manufacturing steps
  updateCurrentOperation(orderId) {
    const operationInfo = this.getCurrentOperationInfo(orderId);

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET current_operation = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(operationInfo.operation, orderId);
    return operationInfo;
  }

  // Get or set characteristics for an order
  getOrderCharacteristics(orderId) {
    return JobCharacteristic.findByOrderId(orderId);
  }

  // Add custom characteristic to an order
  addCharacteristic(orderId, characteristicData) {
    const order = this.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    return JobCharacteristic.create({
      order_id: orderId,
      type: characteristicData.type || 'custom',
      value: characteristicData.value,
      color: characteristicData.color,
      display_name: characteristicData.display_name || characteristicData.value,
      is_system_generated: false
    });
  }

  // Remove characteristic from an order
  removeCharacteristic(orderId, characteristicId) {
    const characteristic = JobCharacteristic.findById(characteristicId);
    if (!characteristic || characteristic.order_id !== orderId) {
      throw new Error('Characteristic not found or does not belong to this order');
    }

    return JobCharacteristic.delete(characteristicId);
  }

  // Bulk update characteristics for an order (regenerate all system characteristics)
  refreshCharacteristics(orderId) {
    const transaction = this.db.transaction(() => {
      const order = this.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Delete existing system-generated characteristics
      this.db.prepare(`
        DELETE FROM job_characteristics 
        WHERE order_id = ? AND is_system_generated = 1
      `).run(orderId);

      // Regenerate characteristics
      return JobCharacteristic.detectAndCreateCharacteristics(order);
    });

    return transaction();
  }
}

module.exports = new ManufacturingOrder();