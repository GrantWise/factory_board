const { getDatabase } = require('../utils/database');

class ManufacturingOrder {
  constructor() {
    this.db = getDatabase();
    this.table = 'manufacturing_orders';
  }

  // Create a new manufacturing order
  create(orderData) {
    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (
        order_number, stock_code, description, quantity_to_make, quantity_completed,
        current_operation, current_work_centre_id, status, priority, due_date, start_date, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      orderData.order_number,
      orderData.stock_code,
      orderData.description,
      orderData.quantity_to_make,
      orderData.quantity_completed || 0,
      orderData.current_operation || null,
      orderData.current_work_centre_id || null,
      orderData.status || 'not_started',
      orderData.priority || 'medium',
      orderData.due_date || null,
      orderData.start_date || null,
      orderData.created_by
    );
    
    return this.findById(result.lastInsertRowid);
  }

  // Find order by ID with all related data
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
    
    return order;
  }

  // Get all orders with filters
  findAll(filters = {}) {
    let whereConditions = [];
    let params = [];
    
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
    
    const orders = this.db.prepare(`
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
    
    // Get manufacturing steps for each order
    for (const order of orders) {
      order.manufacturing_steps = this.db.prepare(`
        SELECT 
          ms.*,
          wc.code as work_centre_code,
          wc.name as work_centre_name
        FROM manufacturing_steps ms
        LEFT JOIN work_centres wc ON ms.work_centre_id = wc.id
        WHERE ms.order_id = ?
        ORDER BY ms.step_number
      `).all(order.id);
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

  // Move order to different work centre
  moveToWorkCentre(orderId, toWorkCentreId, userId, reason = 'user_decision') {
    const order = this.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    
    const fromWorkCentreId = order.current_work_centre_id;
    
    // Update order
    const updateResult = this.update(orderId, {
      current_work_centre_id: toWorkCentreId
    });
    
    // Log the move in audit trail
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
      JSON.stringify({ reason, order_number: order.order_number }),
      this.getWorkCentreQueueDepth(fromWorkCentreId),
      this.getWorkCentreQueueDepth(toWorkCentreId)
    );
    
    return updateResult;
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

  // Delete order
  delete(id) {
    const stmt = this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`);
    return stmt.run(id);
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


  // Delete an order and all related data
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

      // Update positions
      const updateStmt = this.db.prepare(`
        UPDATE ${this.table} 
        SET work_centre_position = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND current_work_centre_id = ?
      `);

      let totalChanges = 0;
      for (const { order_id, position } of orderPositions) {
        console.log(`🔄 Updating order ${order_id} to position ${position} in work centre ${workCentreId}`);
        const result = updateStmt.run(position, order_id, workCentreId);
        console.log(`✅ Update result for order ${order_id}:`, result);
        totalChanges += result.changes;
      }

      return { changes: totalChanges };
    });

    return transaction();
  }

  // Update position when moving between work centres
  moveToWorkCentre(orderId, newWorkCentreId, newPosition = 0) {
    const stmt = this.db.prepare(`
      UPDATE ${this.table} 
      SET current_work_centre_id = ?, work_centre_position = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    return stmt.run(newWorkCentreId, newPosition, orderId);
  }
}

module.exports = new ManufacturingOrder();