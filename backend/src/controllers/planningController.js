const ManufacturingOrder = require('../models/ManufacturingOrder');
const WorkCentre = require('../models/WorkCentre');
const { getAllActiveLocks } = require('../middleware/dragLocks');

/**
 * PlanningController
 * ==================
 *
 * Handles endpoints for the planning board, including board data, order moves, and stats.
 * Now uses next(err) for error propagation to the centralized error handler.
 */
class PlanningController {
  // GET /api/planning-board
  async getPlanningBoardData(req, res, next) {
    try {
      // Get all work centres with current job counts
      const workCentres = WorkCentre.findAll(false); // Only active work centres

      // Get all orders with their details
      const orders = ManufacturingOrder.findAll();

      // Get active drag locks
      const activeLocks = getAllActiveLocks();

      // Group orders by work centre
      const ordersByWorkCentre = {};
      for (const workCentre of workCentres) {
        ordersByWorkCentre[workCentre.id] = [];
      }

      // Add unassigned orders group
      ordersByWorkCentre.unassigned = [];

      for (const order of orders) {
        const workCentreId = order.workCentreId || 'unassigned';
        if (ordersByWorkCentre[workCentreId]) {
          ordersByWorkCentre[workCentreId].push(order);
        } else {
          ordersByWorkCentre.unassigned.push(order);
        }
      }

      // Calculate queue depths and utilization
      const enrichedWorkCentres = workCentres.map(wc => ({
        ...wc,
        currentJobs: ordersByWorkCentre[wc.id].length,
        utilizationPercent: Math.round(ordersByWorkCentre[wc.id].length / wc.capacity * 100),
        orders: ordersByWorkCentre[wc.id]
      }));

      res.json({
        workCentres: enrichedWorkCentres,
        orders: orders,
        ordersByWorkCentre: ordersByWorkCentre,
        activeLocks: activeLocks,
        summary: {
          totalWorkCentres: workCentres.length,
          totalOrders: orders.length,
          totalActiveOrders: orders.filter(o => ['not_started', 'in_progress'].includes(o.status)).length,
          totalCompletedOrders: orders.filter(o => o.status === 'complete').length,
          totalOverdueOrders: orders.filter(o => o.status === 'overdue').length,
          activeDragOperations: Object.keys(activeLocks).length
        },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      next({ status: 500, code: 'PLANNING_BOARD_FETCH_FAILED', message: error.message });
    }
  }

  // PUT /api/planning-board/move
  async moveOrder(req, res, next) {
    try {
      const { orderId, toWorkCentreId, reason } = req.body;

      if (!orderId || !toWorkCentreId) {
        return next({
          status: 400,
          code: 'MISSING_PARAMETERS',
          message: 'Order ID and destination work centre ID are required'
        });
      }

      // Check if order exists
      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return next({
          status: 404,
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found'
        });
      }

      // Check if destination work centre exists
      const toWorkCentre = WorkCentre.findById(toWorkCentreId);
      if (!toWorkCentre) {
        return next({
          status: 404,
          code: 'WORK_CENTRE_NOT_FOUND',
          message: 'Destination work centre not found'
        });
      }

      // Move the order
      const updatedOrder = ManufacturingOrder.moveToWorkCentre(
        orderId,
        toWorkCentreId,
        req.user.id,
        reason || 'planning_board_move'
      );

      // Return updated planning board data for the affected work centres
      const fromWorkCentreId = order.workCentreId;
      const affectedWorkCentres = [fromWorkCentreId, toWorkCentreId].filter(Boolean);

      const updatedWorkCentres = affectedWorkCentres.map(wcId => {
        const wc = WorkCentre.findById(wcId);
        if (wc) {
          const orders = ManufacturingOrder.findAll({ work_centre_id: wcId });
          return {
            ...wc,
            currentJobs: orders.length,
            utilizationPercent: Math.round(orders.length / wc.capacity * 100)
          };
        }
        return null;
      }).filter(Boolean);

      res.json({
        message: 'Order moved successfully',
        movedOrder: updatedOrder,
        updatedWorkCentres: updatedWorkCentres,
        moveDetails: {
          orderId: orderId,
          fromWorkCentreId: fromWorkCentreId,
          toWorkCentreId: toWorkCentreId,
          movedBy: req.user.username,
          reason: reason || 'planning_board_move',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next({ status: 500, code: 'ORDER_MOVE_FAILED', message: error.message });
    }
  }

  // GET /api/planning-board/stats
  async getPlanningBoardStats(req, res, next) {
    try {
      const { getDatabase } = require('../utils/database');
      const db = getDatabase();

      // Quick stats for planning board
      const stats = {};

      // Work centre utilization summary
      const utilizationStats = db.prepare(`
        SELECT 
          AVG(CAST(current_jobs AS FLOAT) / CAST(capacity AS FLOAT) * 100) as avg_utilization,
          MAX(CAST(current_jobs AS FLOAT) / CAST(capacity AS FLOAT) * 100) as max_utilization,
          COUNT(*) as total_work_centres,
          SUM(CASE WHEN CAST(current_jobs AS FLOAT) / CAST(capacity AS FLOAT) > 0.9 THEN 1 ELSE 0 END) as overloaded_centres
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

      stats.utilization = {
        average: Math.round((utilizationStats.avg_utilization || 0) * 10) / 10,
        maximum: Math.round((utilizationStats.max_utilization || 0) * 10) / 10,
        overloaded_centres: utilizationStats.overloaded_centres,
        total_centres: utilizationStats.total_work_centres
      };

      // Order status distribution
      const statusStats = db.prepare(`
        SELECT 
          status,
          COUNT(*) as count
        FROM manufacturing_orders
        GROUP BY status
      `).all();

      stats.orderStatus = statusStats.reduce((acc, row) => {
        acc[row.status] = row.count;
        return acc;
      }, {});

      // Priority distribution of active orders
      const priorityStats = db.prepare(`
        SELECT 
          priority,
          COUNT(*) as count
        FROM manufacturing_orders
        WHERE status IN ('not_started', 'in_progress')
        GROUP BY priority
      `).all();

      stats.activePriority = priorityStats.reduce((acc, row) => {
        acc[row.priority] = row.count;
        return acc;
      }, {});

      // Recent activity (last 24 hours)
      const recentActivity = db.prepare(`
        SELECT 
          COUNT(*) as moves_24h,
          COUNT(DISTINCT order_id) as orders_moved_24h,
          COUNT(DISTINCT user_id) as active_users_24h
        FROM audit_log
        WHERE event_type = 'order_moved'
          AND timestamp >= datetime('now', '-24 hours')
      `).get();

      stats.recentActivity = recentActivity;

      // Bottleneck detection (work centres with high utilization and queue)
      const bottlenecks = db.prepare(`
        SELECT 
          wc.name,
          wc.code,
          wc.capacity,
          COUNT(mo.id) as current_jobs,
          ROUND(COUNT(mo.id) * 100.0 / wc.capacity, 1) as utilization_percent,
          COUNT(overdue.id) as overdue_orders
        FROM work_centres wc
        LEFT JOIN manufacturing_orders mo ON mo.current_work_centre_id = wc.id 
          AND mo.status IN ('not_started', 'in_progress')
        LEFT JOIN manufacturing_orders overdue ON overdue.current_work_centre_id = wc.id 
          AND overdue.due_date < date('now')
          AND overdue.status NOT IN ('complete', 'cancelled')
        WHERE wc.is_active = 1
        GROUP BY wc.id, wc.name, wc.code, wc.capacity
        HAVING utilization_percent > 80
        ORDER BY utilization_percent DESC, overdue_orders DESC
      `).all();

      stats.bottlenecks = bottlenecks;

      // Active drag operations
      stats.activeDragOperations = getAllActiveLocks();

      res.json({
        stats,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      next({ status: 500, code: 'STATS_FETCH_FAILED', message: error.message });
    }
  }
}

module.exports = new PlanningController();