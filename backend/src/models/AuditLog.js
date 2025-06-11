const { getDatabase } = require('../utils/database');

class AuditLog {
  constructor() {
    this.db = getDatabase();
    this.table = 'audit_log';
  }

  // Create an audit log entry
  create(logData) {
    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (
        event_type, order_id, from_work_centre_id, to_work_centre_id, 
        user_id, event_data, queue_depth_from, queue_depth_to, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      logData.event_type,
      logData.order_id || null,
      logData.from_work_centre_id || null,
      logData.to_work_centre_id || null,
      logData.user_id || null,
      logData.event_data ? JSON.stringify(logData.event_data) : null,
      logData.queue_depth_from || null,
      logData.queue_depth_to || null,
      logData.timestamp || new Date().toISOString()
    );

    return this.findById(result.lastInsertRowid);
  }

  // Find audit log entry by ID
  findById(id) {
    const entry = this.db.prepare(`
      SELECT 
        al.*,
        u.username,
        mo.order_number,
        wc_from.name as from_work_centre_name,
        wc_from.code as from_work_centre_code,
        wc_to.name as to_work_centre_name,
        wc_to.code as to_work_centre_code
      FROM ${this.table} al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN manufacturing_orders mo ON al.order_id = mo.id
      LEFT JOIN work_centres wc_from ON al.from_work_centre_id = wc_from.id
      LEFT JOIN work_centres wc_to ON al.to_work_centre_id = wc_to.id
      WHERE al.id = ?
    `).get(id);

    if (entry && entry.event_data) {
      try {
        entry.event_data = JSON.parse(entry.event_data);
      } catch (e) {
        // Keep as string if JSON parse fails
      }
    }

    return entry;
  }

  // Get audit logs with filters
  findAll(filters = {}) {
    const whereConditions = [];
    const params = [];

    if (filters.event_type) {
      whereConditions.push('al.event_type = ?');
      params.push(filters.event_type);
    }

    if (filters.order_id) {
      whereConditions.push('al.order_id = ?');
      params.push(filters.order_id);
    }

    if (filters.user_id) {
      whereConditions.push('al.user_id = ?');
      params.push(filters.user_id);
    }

    if (filters.work_centre_id) {
      whereConditions.push('(al.from_work_centre_id = ? OR al.to_work_centre_id = ?)');
      params.push(filters.work_centre_id, filters.work_centre_id);
    }

    if (filters.from_date) {
      whereConditions.push('al.timestamp >= ?');
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      whereConditions.push('al.timestamp <= ?');
      params.push(filters.to_date);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const entries = this.db.prepare(`
      SELECT 
        al.*,
        u.username,
        mo.order_number,
        wc_from.name as from_work_centre_name,
        wc_from.code as from_work_centre_code,
        wc_to.name as to_work_centre_name,
        wc_to.code as to_work_centre_code
      FROM ${this.table} al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN manufacturing_orders mo ON al.order_id = mo.id
      LEFT JOIN work_centres wc_from ON al.from_work_centre_id = wc_from.id
      LEFT JOIN work_centres wc_to ON al.to_work_centre_id = wc_to.id
      ${whereClause}
      ORDER BY al.timestamp DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // Parse event_data JSON for each entry
    return entries.map(entry => {
      if (entry.event_data) {
        try {
          entry.event_data = JSON.parse(entry.event_data);
        } catch (e) {
          // Keep as string if JSON parse fails
        }
      }
      return entry;
    });
  }

  // Log order movement
  logOrderMove(orderId, fromWorkCentreId, toWorkCentreId, userId, reason = 'user_decision') {
    // Get order and work centre info for the log
    const order = this.db.prepare('SELECT order_number FROM manufacturing_orders WHERE id = ?').get(orderId);
    const fromWC = fromWorkCentreId ? this.db.prepare('SELECT name, code FROM work_centres WHERE id = ?').get(fromWorkCentreId) : null;
    const toWC = this.db.prepare('SELECT name, code FROM work_centres WHERE id = ?').get(toWorkCentreId);

    // Get queue depths
    const queueDepthFrom = fromWorkCentreId ? this.getWorkCentreQueueDepth(fromWorkCentreId) : 0;
    const queueDepthTo = this.getWorkCentreQueueDepth(toWorkCentreId);

    return this.create({
      event_type: 'order_moved',
      order_id: orderId,
      from_work_centre_id: fromWorkCentreId,
      to_work_centre_id: toWorkCentreId,
      user_id: userId,
      event_data: {
        reason,
        order_number: order?.order_number,
        from_work_centre: fromWC ? { name: fromWC.name, code: fromWC.code } : null,
        to_work_centre: { name: toWC.name, code: toWC.code }
      },
      queue_depth_from: queueDepthFrom,
      queue_depth_to: queueDepthTo
    });
  }

  // Log order status change
  logOrderStatusChange(orderId, oldStatus, newStatus, userId) {
    const order = this.db.prepare('SELECT order_number FROM manufacturing_orders WHERE id = ?').get(orderId);

    return this.create({
      event_type: 'order_status_changed',
      order_id: orderId,
      user_id: userId,
      event_data: {
        order_number: order?.order_number,
        old_status: oldStatus,
        new_status: newStatus
      }
    });
  }

  // Log user activity
  logUserActivity(userId, activity, details = {}) {
    return this.create({
      event_type: 'user_activity',
      user_id: userId,
      event_data: {
        activity,
        ...details
      }
    });
  }

  // Get work centre queue depth for audit logging
  getWorkCentreQueueDepth(workCentreId) {
    if (!workCentreId) return 0;

    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM manufacturing_orders
      WHERE current_work_centre_id = ? AND status IN ('not_started', 'in_progress')
    `).get(workCentreId);

    return result.count;
  }

  // Get analytics data from audit logs
  getAnalytics(filters = {}) {
    const fromDate = filters.from_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    const toDate = filters.to_date || new Date().toISOString();

    // Order movements per day
    const dailyMovements = this.db.prepare(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as movements
      FROM ${this.table}
      WHERE event_type = 'order_moved' 
        AND timestamp >= ? 
        AND timestamp <= ?
      GROUP BY DATE(timestamp)
      ORDER BY date
    `).all(fromDate, toDate);

    // Most active work centres (destination)
    const workCentreActivity = this.db.prepare(`
      SELECT 
        wc.name,
        wc.code,
        COUNT(*) as moves_to
      FROM ${this.table} al
      JOIN work_centres wc ON al.to_work_centre_id = wc.id
      WHERE al.event_type = 'order_moved' 
        AND al.timestamp >= ? 
        AND al.timestamp <= ?
      GROUP BY wc.id, wc.name, wc.code
      ORDER BY moves_to DESC
      LIMIT 10
    `).all(fromDate, toDate);

    // Most active users
    const userActivity = this.db.prepare(`
      SELECT 
        u.username,
        COUNT(*) as actions
      FROM ${this.table} al
      JOIN users u ON al.user_id = u.id
      WHERE al.timestamp >= ? 
        AND al.timestamp <= ?
      GROUP BY u.id, u.username
      ORDER BY actions DESC
      LIMIT 10
    `).all(fromDate, toDate);

    return {
      daily_movements: dailyMovements,
      work_centre_activity: workCentreActivity,
      user_activity: userActivity
    };
  }

  // Clean up old audit logs (for maintenance)
  cleanupOldLogs(daysToKeep = 90) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

    const stmt = this.db.prepare(`
      DELETE FROM ${this.table}
      WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffDate);
    return result.changes;
  }
}

module.exports = new AuditLog();