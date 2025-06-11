const express = require('express');
const router = express.Router();
const OrdersController = require('../controllers/ordersController');
const { validateApiKey, logApiRequest } = require('../middleware/apiKeyAuth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const { VALID_STATUSES } = require('../utils/orderStatus');

// Define step statuses separately as they are different from order statuses
const STEP_STATUSES = ['pending', 'in_progress', 'complete', 'skipped'];

/**
 * @swagger
 * /api/external/orders:
 *   post:
 *     summary: Import manufacturing orders from external system
 *     description: Import a batch of manufacturing orders for processing (API key required)
 *     tags: [External Integration]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: header
 *         name: X-System-ID
 *         required: true
 *         schema:
 *           type: string
 *         description: External system identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orders
 *             properties:
 *               orders:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - order_number
 *                     - stock_code
 *                     - description
 *                     - quantity_to_make
 *                   properties:
 *                     order_number:
 *                       type: string
 *                       example: "MO-2024-001"
 *                       description: Unique order number
 *                     stock_code:
 *                       type: string
 *                       example: "PART-001"
 *                       description: Stock/part code
 *                     description:
 *                       type: string
 *                       example: "Widget Assembly"
 *                       description: Order description
 *                     quantity_to_make:
 *                       type: integer
 *                       minimum: 1
 *                       example: 100
 *                       description: Quantity to manufacture
 *                     due_date:
 *                       type: string
 *                       format: date
 *                       example: "2024-12-31"
 *                       description: Due date for completion
 *                     priority:
 *                       type: string
 *                       enum: [low, medium, high, urgent]
 *                       default: medium
 *                       description: Order priority
 *                     current_operation:
 *                       type: string
 *                       example: "Machining"
 *                       description: Current operation
 *                     manufacturing_steps:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required:
 *                           - step_number
 *                           - operation_name
 *                           - work_centre_code
 *                         properties:
 *                           step_number:
 *                             type: integer
 *                             minimum: 1
 *                             description: Step sequence number
 *                           operation_name:
 *                             type: string
 *                             description: Operation name
 *                           work_centre_code:
 *                             type: string
 *                             description: Work centre code
 *                           planned_duration_minutes:
 *                             type: integer
 *                             minimum: 1
 *                             description: Planned duration in minutes
 *               validate_only:
 *                 type: boolean
 *                 default: false
 *                 description: Only validate data without saving
 *     responses:
 *       200:
 *         description: Orders imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Orders imported successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_orders:
 *                       type: integer
 *                       description: Total number of orders processed
 *                     imported:
 *                       type: integer
 *                       description: Number of orders successfully imported
 *                     updated:
 *                       type: integer
 *                       description: Number of orders updated
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           order_number:
 *                             type: string
 *                           error:
 *                             type: string
 *                       description: List of orders that failed to import
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
// Validation schema for external orders
const externalOrdersSchema = Joi.object({
  orders: Joi.array().min(1).max(100).items(
    Joi.object({
      order_number: Joi.string().min(1).max(50).required(),
      stock_code: Joi.string().min(1).max(50).required(),
      description: Joi.string().min(1).max(255).required(),
      quantity_to_make: Joi.number().integer().min(1).required(),
      due_date: Joi.date().iso().optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
      current_operation: Joi.string().max(100).optional(),
      manufacturing_steps: Joi.array().items(
        Joi.object({
          step_number: Joi.number().integer().min(1).required(),
          operation_name: Joi.string().min(1).max(100).required(),
          work_centre_code: Joi.string().min(1).max(20).required(),
          planned_duration_minutes: Joi.number().integer().min(1).optional()
        })
      ).optional()
    })
  ).required(),
  validate_only: Joi.boolean().optional()
});

router.post('/orders',
  validateApiKey,
  logApiRequest,
  validate(externalOrdersSchema),
  OrdersController.importExternalOrders
);

/**
 * @swagger
 * /api/external/orders/{orderNumber}/status:
 *   get:
 *     summary: Get order status from external system
 *     description: Retrieve the current status of a specific manufacturing order (API key required)
 *     tags: [External Integration]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: header
 *         name: X-System-ID
 *         required: true
 *         schema:
 *           type: string
 *         description: External system identifier
 *       - in: path
 *         name: orderNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Order number to query
 *     responses:
 *       200:
 *         description: Order status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Order status retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     order_number:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [not_started, in_progress, complete, overdue, on_hold, cancelled]
 *                     current_operation:
 *                       type: string
 *                     current_work_centre:
 *                       type: string
 *                     quantity_completed:
 *                       type: integer
 *                     quantity_to_make:
 *                       type: integer
 *                     progress_percentage:
 *                       type: number
 *                       format: float
 *                     due_date:
 *                       type: string
 *                       format: date
 *                     last_updated:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/orders/:orderNumber/status',
  validateApiKey,
  logApiRequest,
  OrdersController.getOrderStatusForExternal
);

/**
 * @swagger
 * /api/external/orders/{orderNumber}/progress:
 *   put:
 *     summary: Update order progress from external system
 *     description: Update the progress of a manufacturing order (API key required)
 *     tags: [External Integration]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: header
 *         name: X-System-ID
 *         required: true
 *         schema:
 *           type: string
 *         description: External system identifier
 *       - in: path
 *         name: orderNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Order number to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity_completed:
 *                 type: integer
 *                 minimum: 0
 *                 description: Quantity completed so far
 *               current_operation:
 *                 type: string
 *                 description: Current operation name
 *               current_work_centre_code:
 *                 type: string
 *                 description: Current work centre code
 *               status:
 *                 type: string
 *                 enum: [not_started, in_progress, complete, overdue, on_hold, cancelled]
 *                 description: Order status
 *               step_updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - step_number
 *                   properties:
 *                     step_number:
 *                       type: integer
 *                       minimum: 1
 *                     status:
 *                       type: string
 *                       enum: [pending, in_progress, complete, skipped]
 *                     quantity_completed:
 *                       type: integer
 *                       minimum: 0
 *                     actual_duration_minutes:
 *                       type: integer
 *                       minimum: 0
 *                 description: Updates for specific manufacturing steps
 *     responses:
 *       200:
 *         description: Order progress updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Order progress updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     order_number:
 *                       type: string
 *                     status:
 *                       type: string
 *                     quantity_completed:
 *                       type: integer
 *                     progress_percentage:
 *                       type: number
 *                       format: float
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Validation schema for order progress updates
const orderProgressSchema = Joi.object({
  quantity_completed: Joi.number().integer().min(0).optional(),
  current_operation: Joi.string().max(100).optional(),
  current_work_centre_code: Joi.string().max(20).optional(),
  status: Joi.string().valid(...VALID_STATUSES).optional(),
  step_updates: Joi.array().items(
    Joi.object({
      step_number: Joi.number().integer().min(1).required(),
      status: Joi.string().valid(...STEP_STATUSES).optional(),
      quantity_completed: Joi.number().integer().min(0).optional(),
      actual_duration_minutes: Joi.number().integer().min(0).optional()
    })
  ).optional()
});

router.put('/orders/:orderNumber/progress',
  validateApiKey,
  logApiRequest,
  validate(orderProgressSchema),
  OrdersController.updateOrderProgressFromExternal
);

/**
 * @swagger
 * /api/external/work-centres:
 *   get:
 *     summary: Get work centres list for external system
 *     description: Retrieve list of available work centres for planning (API key required)
 *     tags: [External Integration]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: header
 *         name: X-System-ID
 *         required: true
 *         schema:
 *           type: string
 *         description: External system identifier
 *       - in: query
 *         name: active_only
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Only return active work centres
 *     responses:
 *       200:
 *         description: Work centres retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Work centres retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       code:
 *                         type: string
 *                       description:
 *                         type: string
 *                       capacity:
 *                         type: integer
 *                       is_active:
 *                         type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/work-centres',
  validateApiKey,
  logApiRequest,
  require('../controllers/workCentresController').getWorkCentresForExternal
);

/**
 * @swagger
 * /api/external/orders/{orderNumber}/move:
 *   put:
 *     summary: Move order to different work centre
 *     description: Move a manufacturing order from one work centre to another with optional position specification
 *     tags: [External Integration]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: header
 *         name: X-System-ID
 *         required: true
 *         schema:
 *           type: string
 *         description: External system identifier
 *       - in: path
 *         name: orderNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Order number to move
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to_work_centre_code
 *             properties:
 *               to_work_centre_code:
 *                 type: string
 *                 description: Target work centre code
 *                 example: "ASSEMBLY-01"
 *               reason:
 *                 type: string
 *                 description: Reason for the move
 *                 example: "Priority change"
 *                 maxLength: 100
 *               new_position:
 *                 type: integer
 *                 description: Optional specific position in the target work centre (1-based)
 *                 minimum: 1
 *                 example: 2
 *     responses:
 *       200:
 *         description: Order moved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Order moved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     order_number:
 *                       type: string
 *                     from_work_centre:
 *                       type: string
 *                     to_work_centre:
 *                       type: string
 *                     moved_at:
 *                       type: string
 *                       format: date-time
 *                     new_position:
 *                       type: integer
 *                       description: The new position in the target work centre
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

// Validation schema for order movement
const orderMoveSchema = Joi.object({
  to_work_centre_code: Joi.string().min(1).max(20).required(),
  reason: Joi.string().max(100).optional(),
  new_position: Joi.number().integer().min(1).optional()
});

router.put('/orders/:orderNumber/move',
  validateApiKey,
  logApiRequest,
  validate(orderMoveSchema),
  OrdersController.moveOrderFromExternal
);

/**
 * @swagger
 * /api/external/orders/{orderNumber}/status:
 *   put:
 *     summary: Update order status
 *     description: Change the status of a manufacturing order (API key required)
 *     tags: [External Integration]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: header
 *         name: X-System-ID
 *         required: true
 *         schema:
 *           type: string
 *         description: External system identifier
 *       - in: path
 *         name: orderNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Order number to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [not_started, in_progress, complete, overdue, on_hold, cancelled]
 *                 description: New order status
 *                 example: "in_progress"
 *               reason:
 *                 type: string
 *                 description: Reason for status change
 *                 example: "Started production"
 *                 maxLength: 100
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Order status updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     order_number:
 *                       type: string
 *                     old_status:
 *                       type: string
 *                     new_status:
 *                       type: string
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

// Validation schema for status updates
const orderStatusSchema = Joi.object({
  status: Joi.string().valid(...VALID_STATUSES).required(),
  reason: Joi.string().max(100).optional()
});

router.put('/orders/:orderNumber/status',
  validateApiKey,
  logApiRequest,
  validate(orderStatusSchema),
  OrdersController.updateOrderStatusFromExternal
);

module.exports = router;