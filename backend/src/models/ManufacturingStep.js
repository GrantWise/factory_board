const { getDatabase } = require('../utils/database');

class ManufacturingStep {
  constructor() {
    this.db = getDatabase();
    this.table = 'manufacturing_steps';
  }

  // Create manufacturing steps for an order
  createStepsForOrder(orderId, steps) {
    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (
        order_id, step_number, operation_name, work_centre_id, 
        planned_duration_minutes, status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        stmt.run(
          orderId,
          step.step_number || i + 1, // Use provided step_number or fallback to sequential
          step.operation_name,
          step.work_centre_id,
          step.planned_duration_minutes || null,
          'pending'
        );
      }
    });

    transaction();

    return this.findByOrderId(orderId);
  }

  // Find all steps for an order
  findByOrderId(orderId) {
    const steps = this.db.prepare(`
      SELECT 
        ms.*,
        wc.code as work_centre_code,
        wc.name as work_centre_name
      FROM ${this.table} ms
      LEFT JOIN work_centres wc ON ms.work_centre_id = wc.id
      WHERE ms.order_id = ?
      ORDER BY ms.step_number
    `).all(orderId);

    return steps;
  }

  // Update a specific step
  update(stepId, stepData) {
    const fields = [];
    const values = [];

    if (stepData.operation_name !== undefined) {
      fields.push('operation_name = ?');
      values.push(stepData.operation_name);
    }
    if (stepData.work_centre_id !== undefined) {
      fields.push('work_centre_id = ?');
      values.push(stepData.work_centre_id);
    }
    if (stepData.status !== undefined) {
      fields.push('status = ?');
      values.push(stepData.status);
    }
    if (stepData.planned_duration_minutes !== undefined) {
      fields.push('planned_duration_minutes = ?');
      values.push(stepData.planned_duration_minutes);
    }
    if (stepData.actual_duration_minutes !== undefined) {
      fields.push('actual_duration_minutes = ?');
      values.push(stepData.actual_duration_minutes);
    }
    if (stepData.quantity_completed !== undefined) {
      fields.push('quantity_completed = ?');
      values.push(stepData.quantity_completed);
    }
    if (stepData.started_at !== undefined) {
      fields.push('started_at = ?');
      values.push(stepData.started_at);
    }
    if (stepData.completed_at !== undefined) {
      fields.push('completed_at = ?');
      values.push(stepData.completed_at);
    }

    if (fields.length === 0) {
      return this.findById(stepId);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(stepId);

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(stepId);
  }

  // Find step by ID
  findById(stepId) {
    const step = this.db.prepare(`
      SELECT 
        ms.*,
        wc.code as work_centre_code,
        wc.name as work_centre_name
      FROM ${this.table} ms
      LEFT JOIN work_centres wc ON ms.work_centre_id = wc.id
      WHERE ms.id = ?
    `).get(stepId);

    return step;
  }

  // Start a manufacturing step
  startStep(stepId, userId) {
    const now = new Date().toISOString();

    const result = this.update(stepId, {
      status: 'in_progress',
      started_at: now
    });

    // Log the event
    const step = this.findById(stepId);
    if (step) {
      this.db.prepare(`
        INSERT INTO audit_log (
          event_type, order_id, user_id, event_data, timestamp
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        'step_started',
        step.order_id,
        userId,
        JSON.stringify({
          step_id: stepId,
          step_number: step.step_number,
          operation_name: step.operation_name,
          work_centre_code: step.work_centre_code
        }),
        now
      );
    }

    return result;
  }

  // Complete a manufacturing step
  completeStep(stepId, userId, quantityCompleted) {
    const step = this.findById(stepId);
    if (!step) {
      throw new Error('Step not found');
    }

    const now = new Date().toISOString();
    const actualDuration = step.started_at ?
      Math.round((new Date(now) - new Date(step.started_at)) / (1000 * 60)) : null;

    const result = this.update(stepId, {
      status: 'complete',
      completed_at: now,
      quantity_completed: quantityCompleted,
      actual_duration_minutes: actualDuration
    });

    // Log the event
    this.db.prepare(`
      INSERT INTO audit_log (
        event_type, order_id, user_id, event_data, timestamp
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      'step_completed',
      step.order_id,
      userId,
      JSON.stringify({
        step_id: stepId,
        step_number: step.step_number,
        operation_name: step.operation_name,
        work_centre_code: step.work_centre_code,
        quantity_completed: quantityCompleted,
        actual_duration_minutes: actualDuration
      }),
      now
    );

    return result;
  }

  // Delete all steps for an order
  deleteByOrderId(orderId) {
    const stmt = this.db.prepare(`DELETE FROM ${this.table} WHERE order_id = ?`);
    return stmt.run(orderId);
  }

  // Get next step for an order
  getNextStep(orderId) {
    const nextStep = this.db.prepare(`
      SELECT 
        ms.*,
        wc.code as work_centre_code,
        wc.name as work_centre_name
      FROM ${this.table} ms
      LEFT JOIN work_centres wc ON ms.work_centre_id = wc.id
      WHERE ms.order_id = ? AND ms.status = 'pending'
      ORDER BY ms.step_number
      LIMIT 1
    `).get(orderId);

    return nextStep;
  }

  // Get current step for an order
  getCurrentStep(orderId) {
    const currentStep = this.db.prepare(`
      SELECT 
        ms.*,
        wc.code as work_centre_code,
        wc.name as work_centre_name
      FROM ${this.table} ms
      LEFT JOIN work_centres wc ON ms.work_centre_id = wc.id
      WHERE ms.order_id = ? AND ms.status = 'in_progress'
      ORDER BY ms.step_number
      LIMIT 1
    `).get(orderId);

    return currentStep;
  }
}

module.exports = new ManufacturingStep();