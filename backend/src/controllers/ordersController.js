const ManufacturingOrder = require('../models/ManufacturingOrder');
const ManufacturingStep = require('../models/ManufacturingStep');
const WorkCentre = require('../models/WorkCentre');
const AuditLog = require('../models/AuditLog');
const { checkDragLock, createLockForRequest, releaseDragLock } = require('../middleware/dragLocks');

class OrdersController {
  // GET /api/orders
  async getAllOrders(req, res) {
    try {
      const filters = {
        status: req.query.status,
        priority: req.query.priority,
        work_centre_id: req.query.work_centre_id ? parseInt(req.query.work_centre_id) : undefined,
        due_before: req.query.due_before,
        search: req.query.search
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const orders = ManufacturingOrder.findAll(filters);

      res.json({
        orders,
        count: orders.length
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        code: 'FETCH_FAILED'
      });
    }
  }

  // GET /api/orders/:id
  async getOrder(req, res) {
    try {
      const order = ManufacturingOrder.findById(req.params.id);

      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
          code: 'NOT_FOUND'
        });
      }

      res.json({
        order
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        code: 'FETCH_FAILED'
      });
    }
  }

  // POST /api/orders
  async createOrder(req, res) {
    try {
      const orderData = req.body;
      orderData.created_by = req.user.id;

      // Check if order number already exists
      if (ManufacturingOrder.orderNumberExists(orderData.order_number)) {
        return res.status(409).json({
          error: 'Order number already exists',
          code: 'DUPLICATE_ORDER_NUMBER'
        });
      }

      // Validate work centre if provided
      if (orderData.current_work_centre_id) {
        const workCentre = WorkCentre.findById(orderData.current_work_centre_id);
        if (!workCentre) {
          return res.status(400).json({
            error: 'Invalid work centre ID',
            code: 'INVALID_WORK_CENTRE'
          });
        }
      }

      const order = ManufacturingOrder.create(orderData);

      // Create manufacturing steps if provided
      if (orderData.manufacturing_steps && orderData.manufacturing_steps.length > 0) {
        ManufacturingStep.createStepsForOrder(order.id, orderData.manufacturing_steps);
        // Refresh order data to include steps
        const orderWithSteps = ManufacturingOrder.findById(order.id);
        order.manufacturingSteps = orderWithSteps.manufacturingSteps;
      }

      // Log the creation
      AuditLog.create({
        event_type: 'order_created',
        order_id: order.id,
        user_id: req.user.id,
        event_data: {
          order_number: order.orderNumber,
          stock_code: order.stockCode,
          created_by: req.user.username
        }
      });

      res.status(201).json({
        message: 'Order created successfully',
        order
      });
    } catch (error) {
      res.status(400).json({
        error: error.message,
        code: 'CREATION_FAILED'
      });
    }
  }

  // PUT /api/orders/:id
  async updateOrder(req, res) {
    try {
      const orderId = req.params.id;
      const updates = req.body;

      const existingOrder = ManufacturingOrder.findById(orderId);
      if (!existingOrder) {
        return res.status(404).json({
          error: 'Order not found',
          code: 'NOT_FOUND'
        });
      }

      // Check for order number conflicts
      if (updates.order_number && ManufacturingOrder.orderNumberExists(updates.order_number, orderId)) {
        return res.status(409).json({
          error: 'Order number already exists',
          code: 'DUPLICATE_ORDER_NUMBER'
        });
      }

      // Validate work centre if being updated
      if (updates.current_work_centre_id) {
        const workCentre = WorkCentre.findById(updates.current_work_centre_id);
        if (!workCentre) {
          return res.status(400).json({
            error: 'Invalid work centre ID',
            code: 'INVALID_WORK_CENTRE'
          });
        }
      }

      // Log status changes
      if (updates.status && updates.status !== existingOrder.status) {
        AuditLog.logOrderStatusChange(
          orderId, 
          existingOrder.status, 
          updates.status, 
          req.user.id
        );
      }

      const order = ManufacturingOrder.update(orderId, updates);

      // Log the update
      AuditLog.create({
        event_type: 'order_updated',
        order_id: orderId,
        user_id: req.user.id,
        event_data: {
          order_number: order.orderNumber,
          updated_fields: Object.keys(updates),
          updated_by: req.user.username
        }
      });

      res.json({
        message: 'Order updated successfully',
        order
      });
    } catch (error) {
      res.status(400).json({
        error: error.message,
        code: 'UPDATE_FAILED'
      });
    }
  }

  // DELETE /api/orders/:id
  async deleteOrder(req, res) {
    try {
      const orderId = req.params.id;

      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
          code: 'NOT_FOUND'
        });
      }

      ManufacturingOrder.delete(orderId);

      // Log the deletion
      AuditLog.create({
        event_type: 'order_deleted',
        order_id: orderId,
        user_id: req.user.id,
        event_data: {
          order_number: order.orderNumber,
          stock_code: order.stockCode,
          deleted_by: req.user.username
        }
      });

      res.json({
        message: 'Order deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        code: 'DELETE_FAILED'
      });
    }
  }

  // PUT /api/orders/:id/move
  async moveOrder(req, res) {
    try {
      const orderId = req.params.id;
      const { to_work_centre_id, reason } = req.body;

      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
          code: 'NOT_FOUND'
        });
      }

      // Validate destination work centre
      const toWorkCentre = WorkCentre.findById(to_work_centre_id);
      if (!toWorkCentre) {
        return res.status(400).json({
          error: 'Invalid destination work centre',
          code: 'INVALID_WORK_CENTRE'
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
      res.status(400).json({
        error: error.message,
        code: 'MOVE_FAILED'
      });
    }
  }

  // POST /api/orders/:id/start-move
  async startMove(req, res) {
    try {
      const orderId = req.params.id;
      const { orderNumber } = req.body;

      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
          code: 'NOT_FOUND'
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
      res.status(500).json({
        error: error.message,
        code: 'LOCK_FAILED'
      });
    }
  }

  // POST /api/orders/:id/end-move
  async endMove(req, res) {
    try {
      const orderId = req.params.id;
      const { completed } = req.body;

      const released = releaseDragLock(orderId, req.user.id);
      
      if (!released) {
        return res.status(400).json({
          error: 'No active lock found for this order',
          code: 'NO_ACTIVE_LOCK'
        });
      }

      res.json({
        message: completed ? 'Order move completed' : 'Order move cancelled',
        orderId: orderId
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        code: 'UNLOCK_FAILED'
      });
    }
  }

  // POST /api/orders/import
  async importOrders(req, res) {
    try {
      // TODO: Implement CSV/Excel import functionality
      // This would involve:
      // 1. File upload handling
      // 2. CSV/Excel parsing
      // 3. Data validation
      // 4. Batch creation of orders
      // 5. Error reporting for failed imports

      res.status(501).json({
        error: 'Import functionality not yet implemented',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        code: 'IMPORT_FAILED'
      });
    }
  }

  // GET /api/orders/:id/steps
  async getOrderSteps(req, res) {
    try {
      const orderId = req.params.id;

      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
          code: 'NOT_FOUND'
        });
      }

      const steps = ManufacturingStep.findByOrderId(orderId);

      res.json({
        steps
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        code: 'FETCH_FAILED'
      });
    }
  }

  // PUT /api/orders/:id/steps/:stepId
  async updateOrderStep(req, res) {
    try {
      const { id: orderId, stepId } = req.params;
      const updates = req.body;

      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
          code: 'NOT_FOUND'
        });
      }

      const step = ManufacturingStep.update(stepId, updates);
      if (!step) {
        return res.status(404).json({
          error: 'Step not found',
          code: 'STEP_NOT_FOUND'
        });
      }

      res.json({
        message: 'Step updated successfully',
        step
      });
    } catch (error) {
      res.status(400).json({
        error: error.message,
        code: 'STEP_UPDATE_FAILED'
      });
    }
  }

  // POST /api/orders/:id/steps/:stepId/start
  async startOrderStep(req, res) {
    try {
      const { id: orderId, stepId } = req.params;

      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
          code: 'NOT_FOUND'
        });
      }

      const step = ManufacturingStep.startStep(stepId, req.user.id);

      res.json({
        message: 'Step started successfully',
        step
      });
    } catch (error) {
      res.status(400).json({
        error: error.message,
        code: 'STEP_START_FAILED'
      });
    }
  }

  // POST /api/orders/:id/steps/:stepId/complete
  async completeOrderStep(req, res) {
    try {
      const { id: orderId, stepId } = req.params;
      const { quantity_completed } = req.body;

      const order = ManufacturingOrder.findById(orderId);
      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
          code: 'NOT_FOUND'
        });
      }

      const step = ManufacturingStep.completeStep(stepId, req.user.id, quantity_completed);

      res.json({
        message: 'Step completed successfully',
        step
      });
    } catch (error) {
      res.status(400).json({
        error: error.message,
        code: 'STEP_COMPLETE_FAILED'
      });
    }
  }
}

module.exports = new OrdersController();