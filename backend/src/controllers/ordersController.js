const OrderService = require('../services/orderService');
const ManufacturingOrder = require('../models/ManufacturingOrder');
const ManufacturingStep = require('../models/ManufacturingStep');
const WorkCentre = require('../models/WorkCentre');
const AuditLog = require('../models/AuditLog');
const { checkDragLock, createLockForRequest, releaseDragLock } = require('../middleware/dragLocks');

/**
 * OrdersController
 * ================
 *
 * Handles all endpoints related to manufacturing orders and steps.
 * Now uses next(err) for error propagation to the centralized error handler.
 */
class OrdersController {
  /**
   * Get all manufacturing orders with optional filtering
   * @route GET /api/orders
   * @param {Object} req - Express request object
   * @param {Object} req.query - Query parameters for filtering
   * @param {string} [req.query.status] - Filter by order status (not_started, in_progress, complete, overdue, on_hold, cancelled)
   * @param {string} [req.query.priority] - Filter by priority level (low, medium, high, urgent)
   * @param {number} [req.query.work_centre_id] - Filter by current work centre ID
   * @param {string} [req.query.due_before] - Filter by due date (ISO date string)
   * @param {string} [req.query.search] - Search in order number, stock code, or description
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with orders array and count
   */
  async getAllOrders(req, res, next) {
    try {
      const filters = {
        status: req.query.status,
        priority: req.query.priority,
        work_centre_id: req.query.work_centre_id,
        due_before: req.query.due_before,
        search: req.query.search
      };

      const result = OrderService.getAllOrders(filters);
      res.json(result);
    } catch (error) {
      next({ status: 500, code: 'FETCH_FAILED', message: error.message });
    }
  }

  /**
   * Get a single manufacturing order by ID
   * @route GET /api/orders/:id
   * @param {Object} req - Express request object
   * @param {Object} req.params - URL parameters
   * @param {string} req.params.id - Order ID
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with order details including manufacturing steps and characteristics
   */
  async getOrder(req, res, next) {
    try {
      const order = OrderService.getOrderById(req.params.id);
      res.json({ order });
    } catch (error) {
      if (error.status) {
        next(error);
      } else {
        next({ status: 500, code: 'FETCH_FAILED', message: error.message });
      }
    }
  }

  /**
   * Create a new manufacturing order with optional manufacturing steps
   * @route POST /api/orders
   * @param {Object} req - Express request object
   * @param {Object} req.body - Order creation data
   * @param {string} req.body.order_number - Unique order identifier
   * @param {string} req.body.stock_code - Product/part stock code
   * @param {string} req.body.description - Order description
   * @param {number} req.body.quantity_to_make - Target quantity to manufacture
   * @param {string} [req.body.priority] - Priority level (low, medium, high, urgent)
   * @param {string} [req.body.due_date] - Due date in ISO format
   * @param {number} [req.body.current_work_centre_id] - Initial work centre assignment
   * @param {Array} [req.body.manufacturing_steps] - Array of manufacturing step definitions
   * @param {Object} req.user - Authenticated user object
   * @param {number} req.user.id - User ID for audit trail
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with created order details
   */
  async createOrder(req, res, next) {
    try {
      const order = await OrderService.createOrder(
        req.body, 
        req.user.id, 
        req.user.username
      );

      res.status(201).json({
        message: 'Order created successfully',
        order
      });
    } catch (error) {
      if (error.status) {
        next(error);
      } else {
        next({ status: 400, code: 'CREATION_FAILED', message: error.message });
      }
    }
  }

  /**
   * Update an existing manufacturing order
   * @route PUT /api/orders/:id
   * @param {Object} req - Express request object
   * @param {Object} req.params - URL parameters
   * @param {string} req.params.id - Order ID to update
   * @param {Object} req.body - Update data
   * @param {string} [req.body.description] - Updated description
   * @param {number} [req.body.quantity_to_make] - Updated target quantity
   * @param {string} [req.body.priority] - Updated priority level
   * @param {string} [req.body.status] - Updated order status
   * @param {string} [req.body.due_date] - Updated due date
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with updated order details
   */
  async updateOrder(req, res, next) {
    try {
      const order = await OrderService.updateOrder(
        req.params.id,
        req.body,
        req.user.id,
        req.user.username
      );

      res.json({
        message: 'Order updated successfully',
        order
      });
    } catch (error) {
      if (error.status) {
        next(error);
      } else {
        next({ status: 400, code: 'UPDATE_FAILED', message: error.message });
      }
    }
  }

  async deleteOrder(req, res, next) {
    try {
      const result = await OrderService.deleteOrder(
        req.params.id,
        req.user.id,
        req.user.username
      );

      res.json(result);
    } catch (error) {
      if (error.status) {
        next(error);
      } else {
        next({ status: 500, code: 'DELETE_FAILED', message: error.message });
      }
    }
  }

  /**
   * Move a manufacturing order to a different work centre
   * @route PUT /api/orders/:id/move
   * @param {Object} req - Express request object
   * @param {Object} req.params - URL parameters
   * @param {string} req.params.id - Order ID to move
   * @param {Object} req.body - Move operation data
   * @param {number} req.body.to_work_centre_id - Destination work centre ID
   * @param {string} [req.body.reason] - Reason for the move (for audit trail)
   * @param {number} [req.body.new_position] - Specific position in destination work centre
   * @param {Object} req.user - Authenticated user object
   * @param {number} req.user.id - User ID for audit trail
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with updated order details
   */
  async moveOrder(req, res, next) {
    try {
      const orderId = req.params.id;
      const { to_work_centre_id, reason } = req.body;

      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return next({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Order not found'
        });
      }

      // Validate destination work centre
      const toWorkCentre = WorkCentre.findById(to_work_centre_id);
      if (!toWorkCentre) {
        return next({
          status: 400,
          code: 'INVALID_WORK_CENTRE',
          message: 'Invalid destination work centre'
        });
      }

      // Move the order
      const updatedOrder = ManufacturingOrder.moveToWorkCentre(
        orderId,
        to_work_centre_id,
        req.user.id,
        reason
      );

      res.json({
        message: 'Order moved successfully',
        order: updatedOrder
      });
    } catch (error) {
      next({ status: 400, code: 'MOVE_FAILED', message: error.message });
    }
  }

  // POST /api/orders/:id/start-move
  async startMove(req, res, next) {
    try {
      const orderId = req.params.id;
      const { orderNumber } = req.body;

      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return next({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Order not found'
        });
      }

      // Lock is created by the middleware
      res.json({
        message: 'Order locked for moving',
        orderId: orderId,
        lockedBy: req.user.username,
        lockExpiry: new Date(Date.now() + 30000).toISOString() // 30 seconds
      });
    } catch (error) {
      next({ status: 500, code: 'LOCK_FAILED', message: error.message });
    }
  }

  // POST /api/orders/:id/end-move
  async endMove(req, res, next) {
    try {
      const orderId = req.params.id;
      const { completed } = req.body;

      const released = releaseDragLock(orderId, req.user.id);

      if (!released) {
        return next({
          status: 400,
          code: 'NO_ACTIVE_LOCK',
          message: 'No active lock found for this order'
        });
      }

      res.json({
        message: completed ? 'Order move completed' : 'Order move cancelled',
        orderId: orderId
      });
    } catch (error) {
      next({ status: 500, code: 'UNLOCK_FAILED', message: error.message });
    }
  }

  /**
   * Import multiple manufacturing orders from CSV or JSON data
   * @route POST /api/orders/import
   * @param {Object} req - Express request object
   * @param {Object} req.body - Import data
   * @param {Array} req.body.orders - Array of order objects to import
   * @param {boolean} [req.body.validate_only] - If true, only validate data without saving
   * @param {boolean} [req.body.update_existing] - If true, update existing orders with same order_number
   * @param {Object} req.user - Authenticated user object
   * @param {number} req.user.id - User ID for audit trail
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with import results (created count, updated count, errors)
   */
  async importOrders(req, res, next) {
    try {
      const orders = Array.isArray(req.body) ? req.body : [];
      if (!orders.length) {
        return next({
          status: 400,
          code: 'NO_ORDERS',
          message: 'No orders provided'
        });
      }

      // Track order numbers in this batch to prevent duplicates
      const batchOrderNumbers = new Set();
      const summary = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        details: []
      };

      for (const orderData of orders) {
        const result = { order_number: orderData.order_number };
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

          // Validate using the create schema (required fields, types, etc.)
          const { error, value } = require('../middleware/validation').schemas.order.create.validate(orderData, { abortEarly: false, stripUnknown: true, convert: true });
          if (error) {
            result.status = 'error';
            result.message = 'Validation failed: ' + error.details.map(d => d.message).join('; ');
            summary.errors++;
            summary.details.push(result);
            continue;
          }

          // Validate work centre if provided
          if (value.current_work_centre_id) {
            const workCentre = WorkCentre.findById(value.current_work_centre_id);
            if (!workCentre) {
              result.status = 'error';
              result.message = 'Invalid work centre ID';
              summary.errors++;
              summary.details.push(result);
              continue;
            }
          }

          // Check if order exists
          const existingOrder = ManufacturingOrder.findAll({ order_number: value.order_number })[0];
          if (!existingOrder) {
            // Create new order
            value.created_by = req.user.id;
            const newOrder = ManufacturingOrder.create(value);
            if (value.manufacturing_steps && value.manufacturing_steps.length > 0) {
              ManufacturingStep.createStepsForOrder(newOrder.id, value.manufacturing_steps);
            }
            AuditLog.create({
              event_type: 'order_created',
              order_id: newOrder.id,
              user_id: req.user.id,
              event_data: {
                order_number: newOrder.orderNumber,
                stock_code: newOrder.stockCode,
                created_by: req.user.username
              }
            });
            result.status = 'created';
            result.message = 'Order created';
            summary.created++;
          } else {
            // Only allow update if status is not_started
            if (existingOrder.status === 'not_started') {
              // Prevent order number change (should not happen in import)
              const updateData = { ...value };
              delete updateData.order_number;
              // Validate work centre if being updated
              if (updateData.current_work_centre_id) {
                const workCentre = WorkCentre.findById(updateData.current_work_centre_id);
                if (!workCentre) {
                  result.status = 'error';
                  result.message = 'Invalid work centre ID';
                  summary.errors++;
                  summary.details.push(result);
                  continue;
                }
              }
              const updatedOrder = ManufacturingOrder.update(existingOrder.id, updateData);
              AuditLog.create({
                event_type: 'order_updated',
                order_id: existingOrder.id,
                user_id: req.user.id,
                event_data: {
                  order_number: updatedOrder.orderNumber,
                  updated_fields: Object.keys(updateData),
                  updated_by: req.user.username
                }
              });
              result.status = 'updated';
              result.message = 'Order updated';
              summary.updated++;
            } else {
              result.status = 'skipped';
              result.message = 'Order already in progress, complete, or locked; not updated';
              summary.skipped++;
            }
          }
        } catch (err) {
          result.status = 'error';
          result.message = err.message || 'Unknown error';
          summary.errors++;
        }
        summary.details.push(result);
      }

      res.json(summary);
    } catch (error) {
      next({ status: 500, code: 'IMPORT_FAILED', message: error.message });
    }
  }

  // GET /api/orders/:id/steps
  async getOrderSteps(req, res, next) {
    try {
      const orderId = req.params.id;

      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return next({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Order not found'
        });
      }

      const steps = ManufacturingStep.findByOrderId(orderId);

      res.json({
        steps
      });
    } catch (error) {
      next({ status: 500, code: 'FETCH_FAILED', message: error.message });
    }
  }

  // PUT /api/orders/:id/steps/:stepId
  async updateOrderStep(req, res, next) {
    try {
      const { id: orderId, stepId } = req.params;
      const updates = req.body;

      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return next({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Order not found'
        });
      }

      const step = ManufacturingStep.update(stepId, updates);
      if (!step) {
        return next({
          status: 404,
          code: 'STEP_NOT_FOUND',
          message: 'Step not found'
        });
      }

      res.json({
        message: 'Step updated successfully',
        step
      });
    } catch (error) {
      next({ status: 400, code: 'STEP_UPDATE_FAILED', message: error.message });
    }
  }

  // POST /api/orders/:id/steps/:stepId/start
  async startOrderStep(req, res, next) {
    try {
      const { id: orderId, stepId } = req.params;

      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return next({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Order not found'
        });
      }

      const step = ManufacturingStep.startStep(stepId, req.user.id);

      res.json({
        message: 'Step started successfully',
        step
      });
    } catch (error) {
      // Pass error to centralized error handler
      next({ status: 400, code: 'STEP_START_FAILED', message: error.message });
    }
  }

  // POST /api/orders/:id/steps/:stepId/complete
  async completeOrderStep(req, res, next) {
    try {
      const { id: orderId, stepId } = req.params;
      const { quantity_completed } = req.body;

      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return next({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Order not found'
        });
      }

      const step = ManufacturingStep.completeStep(stepId, req.user.id, quantity_completed);

      res.json({
        message: 'Step completed successfully',
        step
      });
    } catch (error) {
      // Pass error to centralized error handler
      next({ status: 400, code: 'STEP_COMPLETE_FAILED', message: error.message });
    }
  }

  // POST /api/orders/reorder
  async reorderOrders(req, res, next) {
    try {
      const { work_centre_id, order_positions } = req.body;

      // Validate input
      if (!work_centre_id || !Array.isArray(order_positions)) {
        return next({
          status: 400,
          code: 'INVALID_INPUT',
          message: 'work_centre_id and order_positions array are required'
        });
      }

      // Validate each position entry
      for (const position of order_positions) {
        if (!position.order_id || typeof position.position !== 'number') {
          return next({
            status: 400,
            code: 'INVALID_POSITION_DATA',
            message: 'Each position must have order_id and position'
          });
        }
      }

      // Verify work centre exists
      const workCentre = WorkCentre.findById(work_centre_id);
      if (!workCentre) {
        return next({
          status: 404,
          code: 'WORK_CENTRE_NOT_FOUND',
          message: 'Work centre not found'
        });
      }

      // Update positions in database
      console.log('🔄 Reordering in backend:', { work_centre_id, order_positions });
      const result = ManufacturingOrder.reorderInWorkCentre(work_centre_id, order_positions);
      console.log('✅ Database update result:', result);

      // Check what the database actually contains after update
      const updatedOrders = ManufacturingOrder.findAll({ work_centre_id });
      console.log('📊 Orders after database update:', updatedOrders.filter(o => o.current_work_centre_id === work_centre_id).map(o => ({
        id: o.id,
        order_number: o.order_number,
        work_centre_position: o.work_centre_position
      })));

      // Log the reorder action
      AuditLog.create({
        event_type: 'orders_reordered',
        to_work_centre_id: work_centre_id,
        user_id: req.user.id,
        event_data: JSON.stringify({
          work_centre_id,
          order_count: order_positions.length,
          order_positions
        })
      });

      res.json({
        message: 'Orders reordered successfully',
        work_centre_id,
        updated_count: result.changes || order_positions.length
      });
    } catch (error) {
      next({ status: 400, code: 'REORDER_FAILED', message: error.message });
    }
  }

  // External API Methods for ERP Integration

  // POST /api/external/orders - Import orders from external system
  async importExternalOrders(req, res, next) {
    try {
      const { orders, validate_only } = req.body;
      const systemId = req.apiKey.system_id;

      if (validate_only) {
        // Only validate without saving
        const validation = this.validateExternalOrders(orders);
        return res.json({
          message: 'Validation completed',
          data: validation
        });
      }

      const summary = {
        total_orders: orders.length,
        imported: 0,
        updated: 0,
        errors: []
      };

      for (const orderData of orders) {
        try {
          // Add system tracking
          orderData.created_by = 1; // System user
          orderData.metadata = {
            source: 'external',
            system_id: systemId,
            imported_at: new Date().toISOString()
          };

          // Check if order exists
          const existing = ManufacturingOrder.findAll({ order_number: orderData.order_number })[0];

          if (existing) {
            // Update existing order
            ManufacturingOrder.update(existing.id, orderData);
            summary.updated++;
          } else {
            // Create new order
            const newOrder = ManufacturingOrder.create(orderData);

            // Create manufacturing steps if provided
            if (orderData.manufacturing_steps && orderData.manufacturing_steps.length > 0) {
              // Map work centre codes to IDs
              const stepsWithIds = orderData.manufacturing_steps.map(step => {
                const workCentre = WorkCentre.findAll({ code: step.work_centre_code })[0];
                return {
                  ...step,
                  work_centre_id: workCentre ? workCentre.id : null
                };
              });
              ManufacturingStep.createStepsForOrder(newOrder.id, stepsWithIds);
            }

            summary.imported++;
          }
        } catch (error) {
          summary.errors.push({
            order_number: orderData.order_number,
            error: error.message
          });
        }
      }

      res.json({
        message: 'Orders processed successfully',
        data: summary
      });
    } catch (error) {
      next({ status: 500, code: 'EXTERNAL_IMPORT_FAILED', message: error.message });
    }
  }

  // GET /api/external/orders/:orderNumber/status
  async getOrderStatusForExternal(req, res, next) {
    try {
      const { orderNumber } = req.params;

      const order = ManufacturingOrder.findAll({ order_number: orderNumber })[0];
      if (!order) {
        return next({ status: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found' });
      }

      const workCentre = order.current_work_centre_id ?
        WorkCentre.findById(order.current_work_centre_id) : null;

      const progressPercentage = order.quantity_to_make > 0 ?
        order.quantity_completed / order.quantity_to_make * 100 : 0;

      res.json({
        message: 'Order status retrieved successfully',
        data: {
          order_number: order.order_number,
          status: order.status,
          current_operation: order.current_operation,
          current_work_centre: workCentre ? workCentre.name : null,
          quantity_completed: order.quantity_completed,
          quantity_to_make: order.quantity_to_make,
          progress_percentage: Math.round(progressPercentage * 100) / 100,
          due_date: order.due_date,
          last_updated: order.updated_at
        }
      });
    } catch (error) {
      next({ status: 500, code: 'STATUS_FETCH_FAILED', message: error.message });
    }
  }

  // PUT /api/external/orders/:orderNumber/progress
  async updateOrderProgressFromExternal(req, res, next) {
    try {
      const { orderNumber } = req.params;
      const { quantity_completed, current_operation, current_work_centre_code, status, step_updates } = req.body;

      const order = ManufacturingOrder.findAll({ order_number: orderNumber })[0];
      if (!order) {
        return next({ status: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found' });
      }

      const updateData = {};

      if (quantity_completed !== undefined) updateData.quantity_completed = quantity_completed;
      if (current_operation !== undefined) updateData.current_operation = current_operation;
      if (status !== undefined) updateData.status = status;

      if (current_work_centre_code) {
        const workCentre = WorkCentre.findAll({ code: current_work_centre_code })[0];
        if (workCentre) {
          updateData.current_work_centre_id = workCentre.id;
        }
      }

      // Update the order
      const updatedOrder = ManufacturingOrder.update(order.id, updateData);

      // Update manufacturing steps if provided
      if (step_updates && Array.isArray(step_updates)) {
        for (const stepUpdate of step_updates) {
          const steps = ManufacturingStep.findByOrderId(order.id);
          const step = steps.find(s => s.step_number === stepUpdate.step_number);
          if (step) {
            ManufacturingStep.update(step.id, stepUpdate);
          }
        }
      }

      const progressPercentage = updatedOrder.quantity_to_make > 0 ?
        updatedOrder.quantity_completed / updatedOrder.quantity_to_make * 100 : 0;

      res.json({
        message: 'Order progress updated successfully',
        data: {
          order_number: updatedOrder.order_number,
          status: updatedOrder.status,
          quantity_completed: updatedOrder.quantity_completed,
          progress_percentage: Math.round(progressPercentage * 100) / 100
        }
      });
    } catch (error) {
      next({ status: 500, code: 'PROGRESS_UPDATE_FAILED', message: error.message });
    }
  }

  // PUT /api/external/orders/:orderNumber/move
  async moveOrderFromExternal(req, res, next) {
    try {
      const { orderNumber } = req.params;
      const { to_work_centre_code, reason } = req.body;

      const order = ManufacturingOrder.findAll({ order_number: orderNumber })[0];
      if (!order) {
        return next({
          status: 404,
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found'
        });
      }

      // Find work centre by code
      const toWorkCentre = WorkCentre.findAll({ code: to_work_centre_code })[0];
      if (!toWorkCentre) {
        return next({
          status: 404,
          code: 'WORK_CENTRE_NOT_FOUND',
          message: 'Work centre not found'
        });
      }

      const fromWorkCentre = order.current_work_centre_id ?
        WorkCentre.findById(order.current_work_centre_id) : null;

      // Move the order (using null user ID for external moves)
      const updatedOrder = ManufacturingOrder.moveToWorkCentre(
        order.id,
        toWorkCentre.id,
        null, // External system moves don't have a user
        reason || 'External system move'
      );

      res.json({
        message: 'Order moved successfully',
        data: {
          order_number: updatedOrder.order_number,
          from_work_centre: fromWorkCentre ? fromWorkCentre.name : null,
          to_work_centre: toWorkCentre.name,
          moved_at: new Date().toISOString()
        }
      });
    } catch (error) {
      next({ status: 500, code: 'MOVE_FAILED', message: error.message });
    }
  }

  // PUT /api/external/orders/:orderNumber/status
  async updateOrderStatusFromExternal(req, res, next) {
    try {
      const { orderNumber } = req.params;
      const { status, reason } = req.body;

      console.log(`[DEBUG] Updating order ${orderNumber} status to ${status}`);

      const order = ManufacturingOrder.findAll({ order_number: orderNumber })[0];
      if (!order) {
        return next({ status: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found' });
      }

      const oldStatus = order.status;
      console.log(`[DEBUG] Current status: ${oldStatus}, New status: ${status}`);

      // Update the order status
      console.log(`[DEBUG] About to call ManufacturingOrder.update for order ID ${order.id}`);
      const updatedOrder = ManufacturingOrder.update(order.id, { status });
      console.log('[DEBUG] ManufacturingOrder.update completed successfully');

      res.json({
        message: 'Order status updated successfully',
        data: {
          order_number: updatedOrder.order_number,
          old_status: oldStatus,
          new_status: status,
          updated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.log('[DEBUG] Error in updateOrderStatusFromExternal:', error);
      next({ status: 500, code: 'STATUS_UPDATE_FAILED', message: error.message });
    }
  }

  // Helper method to validate external orders
  validateExternalOrders(orders) {
    const results = [];

    for (const order of orders) {
      const result = { order_number: order.order_number };

      try {
        // Basic validation
        if (!order.order_number || !order.stock_code || !order.description || !order.quantity_to_make) {
          result.valid = false;
          result.errors = ['Missing required fields: order_number, stock_code, description, quantity_to_make'];
        } else if (order.quantity_to_make <= 0) {
          result.valid = false;
          result.errors = ['quantity_to_make must be greater than 0'];
        } else {
          result.valid = true;
          result.errors = [];
        }
      } catch (error) {
        result.valid = false;
        result.errors = [error.message];
      }

      results.push(result);
    }

    return {
      total_orders: orders.length,
      valid_orders: results.filter(r => r.valid).length,
      invalid_orders: results.filter(r => !r.valid).length,
      details: results
    };
  }
}

module.exports = new OrdersController();