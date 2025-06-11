const express = require('express');
const router = express.Router();
const WorkCentresController = require('../controllers/workCentresController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, schemas, validateId } = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// GET /api/work-centres
router.get('/',
  requirePermission('work_centres:read'),
  WorkCentresController.getAllWorkCentres
);

// GET /api/work-centres/:id
router.get('/:id',
  validateId(),
  requirePermission('work_centres:read'),
  WorkCentresController.getWorkCentre
);

// POST /api/work-centres
router.post('/',
  requirePermission('work_centres:write'),
  validate(schemas.workCentre.create),
  WorkCentresController.createWorkCentre
);

// PUT /api/work-centres/reorder - MUST come before /:id route
router.put('/reorder',
  requirePermission('work_centres:write'),
  validate(schemas.workCentre.reorder),
  WorkCentresController.reorderWorkCentres
);

// PUT /api/work-centres/:id
router.put('/:id',
  validateId(),
  requirePermission('work_centres:write'),
  validate(schemas.workCentre.update),
  WorkCentresController.updateWorkCentre
);

// DELETE /api/work-centres/:id
router.delete('/:id',
  validateId(),
  requirePermission('work_centres:delete'),
  WorkCentresController.deleteWorkCentre
);

// Machine management routes
// POST /api/work-centres/:id/machines
router.post('/:id/machines',
  validateId(),
  requirePermission('work_centres:write'),
  validate(schemas.machine.create),
  WorkCentresController.addMachine
);

// PUT /api/work-centres/:id/machines/:machineId
router.put('/:id/machines/:machineId',
  validateId(),
  validateId('machineId'),
  requirePermission('work_centres:write'),
  validate(schemas.machine.update),
  WorkCentresController.updateMachine
);

// DELETE /api/work-centres/:id/machines/:machineId
router.delete('/:id/machines/:machineId',
  validateId(),
  validateId('machineId'),
  requirePermission('work_centres:delete'),
  WorkCentresController.deleteMachine
);

module.exports = router;