const express = require('express');
const router = express.Router();
const CharacteristicsController = require('../controllers/characteristicsController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validateId } = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// GET /api/characteristics - Get all available characteristics
router.get('/',
  requirePermission('orders:read'),
  CharacteristicsController.getAllCharacteristics
);

// GET /api/characteristics/types/:type - Get characteristics by type
router.get('/types/:type',
  requirePermission('orders:read'),
  CharacteristicsController.getCharacteristicsByType
);

// Note: Order-specific characteristics routes are now in the orders router

// PUT /api/characteristics/:id - Update a characteristic
router.put('/:id',
  validateId(),
  requirePermission('orders:write'),
  CharacteristicsController.updateCharacteristic
);

// DELETE /api/characteristics/:id - Delete a characteristic
router.delete('/:id',
  validateId(),
  requirePermission('orders:write'),
  CharacteristicsController.deleteCharacteristic
);

module.exports = router;