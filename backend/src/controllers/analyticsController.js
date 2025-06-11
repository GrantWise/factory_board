const { getDatabase } = require('../utils/database');
const AuditLog = require('../models/AuditLog');

/**
 * AnalyticsController
 * ===================
 *
 * Handles all endpoints related to analytics and reporting.
 * Now uses next(err) for error propagation to the centralized error handler.
 */
class AnalyticsController {
  /**
   * Get dashboard metrics including active orders, completion rates, and work centre statistics
   * @route GET /api/analytics/dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with comprehensive dashboard metrics
   */
  async getDashboardMetrics(req, res, next) {
    try {
      const db = getDatabase();
      const metrics = {};

      // Total active orders
      const activeOrdersResult = db.prepare(`
        SELECT COUNT(*) as count
        FROM manufacturing_orders
        WHERE status IN ('not_started', 'in_progress')
      `).get();
      metrics.totalActiveOrders = activeOrdersResult.count;

      // Completion rate (percentage of orders completed vs total)
      const completionResult = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as completed
        FROM manufacturing_orders
        WHERE created_at >= date('now', '-30 days')
      `).get();
      metrics.completionRate = completionResult.total > 0
        ? Math.round(completionResult.completed / completionResult.total * 100 * 10) / 10
        : 0;

      // Work centre utilization (average percentage)
      const utilizationResult = db.prepare(`
        SELECT 
          AVG(CAST(current_jobs AS FLOAT) / CAST(capacity AS FLOAT) * 100) as avg_utilization
        FROM (
          SELECT 
            wc.capacity,
            COUNT(mo.id) as current_jobs
          FROM work_centres wc
          LEFT JOIN manufacturing_orders mo ON mo.current_work_centre_id = wc.id 
            AND mo.status IN ('not_started', 'in_progress')
          WHERE wc.is_active = 1
          GROUP BY wc.id, wc.capacity
        )
      `).get();
      metrics.workCentreUtilization = Math.round((utilizationResult.avg_utilization || 0) * 10) / 10;

      // Daily production (completed quantity today)
      const productionResult = db.prepare(`
        SELECT 
          COALESCE(SUM(quantity_completed), 0) as daily_production,
          COALESCE(SUM(quantity_to_make), 0) as daily_target
        FROM manufacturing_orders
        WHERE completion_date = date('now')
           OR (status = 'in_progress' AND start_date <= date('now'))
      `).get();
      metrics.dailyProduction = productionResult.daily_production;
      metrics.dailyTarget = productionResult.daily_target || 300; // Default target

      // Overdue orders
      const overdueResult = db.prepare(`
        SELECT COUNT(*) as count
        FROM manufacturing_orders
        WHERE due_date < date('now') 
          AND status NOT IN ('complete', 'cancelled')
      `).get();
      metrics.overdueOrders = overdueResult.count;

      // Average cycle time (days from start to completion)
      const cycleTimeResult = db.prepare(`
        SELECT AVG(julianday(completion_date) - julianday(start_date)) as avg_cycle_time
        FROM manufacturing_orders
        WHERE status = 'complete' 
          AND start_date IS NOT NULL 
          AND completion_date IS NOT NULL
          AND completion_date >= date('now', '-30 days')
      `).get();
      metrics.averageCycleTime = Math.round((cycleTimeResult.avg_cycle_time || 0) * 10) / 10;

      res.json({
        metrics,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      next({ status: 500, code: 'METRICS_FETCH_FAILED', message: error.message });
    }
  }

  /**
   * Get cycle time analytics for manufacturing operations
   * @route GET /api/analytics/cycle-times
   * @param {Object} req - Express request object
   * @param {Object} req.query - Query parameters
   * @param {number} [req.query.days=30] - Number of days to analyze
   * @param {number} [req.query.work_centre_id] - Filter by specific work centre
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with cycle time statistics
   */
  async getCycleTimes(req, res, next) {
    try {
      const db = getDatabase();
      const days = parseInt(req.query.days) || 30;
      const workCentreId = req.query.work_centre_id;

      let whereClause = `
        WHERE mo.status = 'complete' 
          AND mo.start_date IS NOT NULL 
          AND mo.completion_date IS NOT NULL
          AND mo.completion_date >= date('now', '-${days} days')
      `;

      const params = [];
      if (workCentreId) {
        whereClause += ' AND mo.current_work_centre_id = ?';
        params.push(workCentreId);
      }

      // Overall cycle time statistics
      const overallStats = db.prepare(`
        SELECT 
          COUNT(*) as order_count,
          AVG(julianday(completion_date) - julianday(start_date)) as avg_cycle_time,
          MIN(julianday(completion_date) - julianday(start_date)) as min_cycle_time,
          MAX(julianday(completion_date) - julianday(start_date)) as max_cycle_time
        FROM manufacturing_orders mo
        ${whereClause}
      `).get(...params);

      // Cycle times by work centre
      const byWorkCentre = db.prepare(`
        SELECT 
          wc.name as work_centre_name,
          wc.code as work_centre_code,
          COUNT(*) as order_count,
          AVG(julianday(mo.completion_date) - julianday(mo.start_date)) as avg_cycle_time
        FROM manufacturing_orders mo
        JOIN work_centres wc ON mo.current_work_centre_id = wc.id
        ${whereClause}
        GROUP BY wc.id, wc.name, wc.code
        ORDER BY avg_cycle_time DESC
      `).all(...params);

      // Daily cycle time trend
      const dailyTrend = db.prepare(`
        SELECT 
          date(completion_date) as completion_date,
          COUNT(*) as completed_orders,
          AVG(julianday(completion_date) - julianday(start_date)) as avg_cycle_time
        FROM manufacturing_orders mo
        ${whereClause}
        GROUP BY date(completion_date)
        ORDER BY completion_date
      `).all(...params);

      res.json({
        overall_stats: {
          order_count: overallStats.order_count,
          avg_cycle_time: Math.round((overallStats.avg_cycle_time || 0) * 100) / 100,
          min_cycle_time: Math.round((overallStats.min_cycle_time || 0) * 100) / 100,
          max_cycle_time: Math.round((overallStats.max_cycle_time || 0) * 100) / 100
        },
        by_work_centre: byWorkCentre.map(wc => ({
          ...wc,
          avg_cycle_time: Math.round((wc.avg_cycle_time || 0) * 100) / 100
        })),
        daily_trend: dailyTrend.map(day => ({
          ...day,
          avg_cycle_time: Math.round((day.avg_cycle_time || 0) * 100) / 100
        })),
        period_days: days,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      next({ status: 500, code: 'CYCLE_TIME_FETCH_FAILED', message: error.message });
    }
  }

  /**
   * Get performance analytics for all work centres
   * @route GET /api/analytics/work-centre-performance
   * @param {Object} req - Express request object
   * @param {Object} req.query - Query parameters
   * @param {number} [req.query.days=30] - Number of days to analyze
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with work centre performance metrics
   */
  async getWorkCentrePerformance(req, res, next) {
    try {
      const db = getDatabase();
      const days = parseInt(req.query.days) || 30;

      // Work centre performance metrics
      const performance = db.prepare(`
        SELECT 
          wc.id,
          wc.name,
          wc.code,
          wc.capacity,
          COUNT(mo.id) as current_jobs,
          ROUND(COUNT(mo.id) * 100.0 / wc.capacity, 1) as utilization_percent,
          COUNT(completed.id) as completed_orders,
          AVG(CASE 
            WHEN completed.completion_date IS NOT NULL AND completed.start_date IS NOT NULL 
            THEN julianday(completed.completion_date) - julianday(completed.start_date) 
          END) as avg_cycle_time
        FROM work_centres wc
        LEFT JOIN manufacturing_orders mo ON mo.current_work_centre_id = wc.id 
          AND mo.status IN ('not_started', 'in_progress')
        LEFT JOIN manufacturing_orders completed ON completed.current_work_centre_id = wc.id 
          AND completed.status = 'complete'
          AND completed.completion_date >= date('now', '-${days} days')
        WHERE wc.is_active = 1
        GROUP BY wc.id, wc.name, wc.code, wc.capacity
        ORDER BY wc.display_order, wc.name
      `).all();

      // Format the results
      const formattedPerformance = performance.map(wc => ({
        ...wc,
        avg_cycle_time: Math.round((wc.avg_cycle_time || 0) * 100) / 100,
        utilization_status: wc.utilization_percent > 90 ? 'overloaded' :
          wc.utilization_percent > 70 ? 'high' :
            wc.utilization_percent > 40 ? 'normal' : 'low'
      }));

      res.json({
        work_centres: formattedPerformance,
        period_days: days,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      next({ status: 500, code: 'PERFORMANCE_FETCH_FAILED', message: error.message });
    }
  }

  // GET /api/analytics/order-flow
  async getOrderFlow(req, res, next) {
    try {
      const db = getDatabase();
      const days = parseInt(req.query.days) || 7;

      // Order movements between work centres
      const flowData = db.prepare(`
        SELECT 
          wc_from.name as from_work_centre,
          wc_from.code as from_code,
          wc_to.name as to_work_centre,
          wc_to.code as to_code,
          COUNT(*) as movement_count,
          AVG(al.queue_depth_to - al.queue_depth_from) as avg_queue_change
        FROM audit_log al
        LEFT JOIN work_centres wc_from ON al.from_work_centre_id = wc_from.id
        JOIN work_centres wc_to ON al.to_work_centre_id = wc_to.id
        WHERE al.event_type = 'order_moved'
          AND al.timestamp >= datetime('now', '-${days} days')
        GROUP BY al.from_work_centre_id, al.to_work_centre_id,
                 wc_from.name, wc_from.code, wc_to.name, wc_to.code
        ORDER BY movement_count DESC
      `).all();

      // Daily order movements
      const dailyMovements = db.prepare(`
        SELECT 
          date(timestamp) as movement_date,
          COUNT(*) as total_movements,
          COUNT(DISTINCT order_id) as unique_orders_moved,
          COUNT(DISTINCT user_id) as active_users
        FROM audit_log
        WHERE event_type = 'order_moved'
          AND timestamp >= datetime('now', '-${days} days')
        GROUP BY date(timestamp)
        ORDER BY movement_date
      `).all();

      res.json({
        flow_data: flowData.map(flow => ({
          ...flow,
          avg_queue_change: Math.round((flow.avg_queue_change || 0) * 100) / 100
        })),
        daily_movements: dailyMovements,
        period_days: days,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      next({ status: 500, code: 'FLOW_FETCH_FAILED', message: error.message });
    }
  }

  // GET /api/analytics/audit
  async getAuditAnalytics(req, res, next) {
    try {
      const db = getDatabase();
      const filters = {
        event_type: req.query.event_type,
        user_id: req.query.user_id ? parseInt(req.query.user_id) : undefined,
        from_date: req.query.from_date,
        to_date: req.query.to_date,
        limit: Math.min(parseInt(req.query.limit) || 50, 100),
        offset: parseInt(req.query.offset) || 0
      };

      const analytics = AuditLog.getAnalytics(filters);
      const auditEntries = AuditLog.findAll(filters);

      res.json({
        analytics,
        recent_entries: auditEntries,
        filters_applied: Object.fromEntries(
          Object.entries(filters).filter(([key, value]) => value !== undefined)
        ),
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      next({ status: 500, code: 'AUDIT_FETCH_FAILED', message: error.message });
    }
  }

  // GET /api/analytics/production-summary
  async getProductionSummary(req, res, next) {
    try {
      const db = getDatabase();
      const days = parseInt(req.query.days) || 30;

      // Production summary by day
      const dailyProduction = db.prepare(`
        SELECT 
          date(COALESCE(completion_date, updated_at)) as production_date,
          COUNT(*) as orders_worked,
          SUM(quantity_completed) as total_quantity,
          SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as completed_orders,
          SUM(CASE WHEN status = 'complete' THEN quantity_completed ELSE 0 END) as completed_quantity
        FROM manufacturing_orders
        WHERE (completion_date >= date('now', '-${days} days') 
               OR (updated_at >= date('now', '-${days} days') AND quantity_completed > 0))
        GROUP BY date(COALESCE(completion_date, updated_at))
        ORDER BY production_date
      `).all();

      // Production by stock code
      const byStockCode = db.prepare(`
        SELECT 
          stock_code,
          description,
          COUNT(*) as order_count,
          SUM(quantity_to_make) as total_planned,
          SUM(quantity_completed) as total_completed,
          ROUND(SUM(quantity_completed) * 100.0 / SUM(quantity_to_make), 1) as completion_percent
        FROM manufacturing_orders
        WHERE updated_at >= date('now', '-${days} days')
        GROUP BY stock_code, description
        HAVING SUM(quantity_completed) > 0
        ORDER BY total_completed DESC
        LIMIT 20
      `).all();

      // Overall summary
      const summary = db.prepare(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(quantity_to_make) as total_planned_quantity,
          SUM(quantity_completed) as total_completed_quantity,
          SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as completed_orders,
          SUM(CASE WHEN status IN ('not_started', 'in_progress') THEN 1 ELSE 0 END) as active_orders,
          SUM(CASE WHEN due_date < date('now') AND status NOT IN ('complete', 'cancelled') THEN 1 ELSE 0 END) as overdue_orders
        FROM manufacturing_orders
        WHERE created_at >= date('now', '-${days} days')
           OR updated_at >= date('now', '-${days} days')
      `).get();

      res.json({
        summary: {
          ...summary,
          completion_rate: summary.total_orders > 0
            ? Math.round(summary.completed_orders / summary.total_orders * 100 * 10) / 10
            : 0,
          quantity_completion_rate: summary.total_planned_quantity > 0
            ? Math.round(summary.total_completed_quantity / summary.total_planned_quantity * 100 * 10) / 10
            : 0
        },
        daily_production: dailyProduction,
        by_stock_code: byStockCode,
        period_days: days,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      next({ status: 500, code: 'PRODUCTION_SUMMARY_FAILED', message: error.message });
    }
  }

  /**
   * Get recent activity from audit logs for dashboard display
   * @route GET /api/analytics/recent-activity
   * @param {Object} req - Express request object
   * @param {Object} req.query - Query parameters
   * @param {number} [req.query.limit=10] - Number of activity entries to return
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with recent activity data
   */
  async getRecentActivity(req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const recentActivity = AuditLog.getRecentActivity(limit);

      res.json({
        recent_activity: recentActivity,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      next({ status: 500, code: 'RECENT_ACTIVITY_FETCH_FAILED', message: error.message });
    }
  }
}

module.exports = new AnalyticsController();