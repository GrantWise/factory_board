const express = require('express');
const router = express.Router();
const OrdersController = require('../controllers/ordersController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, schemas, validateId } = require('../middleware/validation');
const { checkDragLock, createLockForRequest } = require('../middleware/dragLocks');
const { validateApiKey } = require('../middleware/apiKeyAuth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/orders
router.get('/',
  requirePermission('orders:read'),
  validate(schemas.query.orderFilters, 'query'),
  OrdersController.getAllOrders
);

// GET /api/orders/:id
router.get('/:id',
  validateId(),
  requirePermission('orders:read'),
  OrdersController.getOrder
);

// POST /api/orders
router.post('/',
  requirePermission('orders:write'),
  validate(schemas.order.create),
  OrdersController.createOrder
);

// PUT /api/orders/:id
router.put('/:id',
  validateId(),
  requirePermission('orders:write'),
  checkDragLock,
  validate(schemas.order.update),
  OrdersController.updateOrder
);

// DELETE /api/orders/:id
router.delete('/:id',
  validateId(),
  requirePermission('orders:delete'),
  OrdersController.deleteOrder
);

// PUT /api/orders/:id/move - Move order between work centres
router.put('/:id/move',
  validateId(),
  requirePermission('orders:move'),
  checkDragLock,
  validate(schemas.order.move),
  OrdersController.moveOrder
);

// POST /api/orders/:id/start-move - Lock order for drag operation
router.post('/:id/start-move',
  validateId(),
  requirePermission('orders:move'),
  createLockForRequest,
  OrdersController.startMove
);

// POST /api/orders/:id/end-move - Release order lock
router.post('/:id/end-move',
  validateId(),
  requirePermission('orders:move'),
  OrdersController.endMove
);

// POST /api/orders/import - Import orders from CSV/Excel
router.post('/import',
  requirePermission('orders:write'),
  OrdersController.importOrders
);

// POST /api/orders/reorder - Reorder orders within a work centre
router.post('/reorder',
  requirePermission('orders:move'),
  OrdersController.reorderOrders
);

// Manufacturing steps routes
// GET /api/orders/:id/steps
router.get('/:id/steps',
  validateId(),
  requirePermission('orders:read'),
  OrdersController.getOrderSteps
);

// PUT /api/orders/:id/steps/:stepId
router.put('/:id/steps/:stepId',
  validateId(),
  validateId('stepId'),
  requirePermission('orders:write'),
  validate(schemas.step.update),
  OrdersController.updateOrderStep
);

// POST /api/orders/:id/steps/:stepId/start
router.post('/:id/steps/:stepId/start',
  validateId(),
  validateId('stepId'),
  requirePermission('orders:write'),
  OrdersController.startOrderStep
);

// POST /api/orders/:id/steps/:stepId/complete
router.post('/:id/steps/:stepId/complete',
  validateId(),
  validateId('stepId'),
  requirePermission('orders:write'),
  validate(schemas.step.complete),
  OrdersController.completeOrderStep
);

// POST /api/orders/external/import - Import orders from external system
router.post('/external/import',
  validateApiKey,
  validate(schemas.order.bulkImport),
  OrdersController.importExternalOrders
);

// Characteristics routes for orders
const CharacteristicsController = require('../controllers/characteristicsController');

// GET /api/orders/:id/characteristics - Get characteristics for an order
router.get('/:id/characteristics',
  validateId(),
  requirePermission('orders:read'),
  CharacteristicsController.getOrderCharacteristics
);

// POST /api/orders/:id/characteristics - Create characteristic for an order
router.post('/:id/characteristics',
  validateId(),
  requirePermission('orders:write'),
  CharacteristicsController.createOrderCharacteristic
);

// POST /api/orders/:id/characteristics/refresh - Refresh system-generated characteristics
router.post('/:id/characteristics/refresh',
  validateId(),
  requirePermission('orders:write'),
  CharacteristicsController.refreshOrderCharacteristics
);

// POST /api/orders/:id/characteristics/detect - Detect potential characteristics without creating
router.post('/:id/characteristics/detect',
  validateId(),
  requirePermission('orders:read'),
  CharacteristicsController.detectCharacteristics
);

module.exports = router;