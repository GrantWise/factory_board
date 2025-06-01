const WorkCentre = require('../models/WorkCentre');
const AuditLog = require('../models/AuditLog');

/**
 * WorkCentresController
 * =====================
 *
 * Handles all endpoints related to work centres and machines.
 * Now uses next(err) for error propagation to the centralized error handler.
 */
class WorkCentresController {
  // GET /api/work-centres
  async getAllWorkCentres(req, res, next) {
    try {
      const includeInactive = req.query.include_inactive === 'true';
      const workCentres = WorkCentre.findAll(includeInactive);
      res.json({ workCentres });
    } catch (error) {
      next({ status: 500, code: 'FETCH_FAILED', message: error.message });
    }
  }

  // GET /api/work-centres/:id
  async getWorkCentre(req, res, next) {
    try {
      const workCentre = WorkCentre.findById(req.params.id);

      if (!workCentre) {
        return res.status(404).json({
          error: 'Work centre not found',
          code: 'NOT_FOUND'
        });
      }

      res.json({
        workCentre
      });
    } catch (error) {
      next({ status: 500, code: 'FETCH_FAILED', message: error.message });
    }
  }

  // POST /api/work-centres
  async createWorkCentre(req, res, next) {
    try {
      const workCentreData = req.body;

      // Check if code already exists
      if (WorkCentre.codeExists(workCentreData.code)) {
        return res.status(409).json({
          error: 'Work centre code already exists',
          code: 'DUPLICATE_CODE'
        });
      }

      const workCentre = WorkCentre.create(workCentreData);

      // Log the creation
      AuditLog.create({
        event_type: 'work_centre_created',
        user_id: req.user.id,
        event_data: {
          work_centre_id: workCentre.id,
          name: workCentre.name,
          code: workCentre.code,
          created_by: req.user.username
        }
      });

      res.status(201).json({
        message: 'Work centre created successfully',
        workCentre
      });
    } catch (error) {
      next({ status: 400, code: 'CREATION_FAILED', message: error.message });
    }
  }

  // PUT /api/work-centres/:id
  async updateWorkCentre(req, res, next) {
    try {
      const workCentreId = req.params.id;
      const updates = req.body;

      const existingWorkCentre = WorkCentre.findById(workCentreId);
      if (!existingWorkCentre) {
        return res.status(404).json({
          error: 'Work centre not found',
          code: 'NOT_FOUND'
        });
      }

      // Check if code conflicts with another work centre
      if (updates.code && WorkCentre.codeExists(updates.code, workCentreId)) {
        return res.status(409).json({
          error: 'Work centre code already exists',
          code: 'DUPLICATE_CODE'
        });
      }

      const workCentre = WorkCentre.update(workCentreId, updates);

      // Log the update
      AuditLog.create({
        event_type: 'work_centre_updated',
        user_id: req.user.id,
        event_data: {
          work_centre_id: workCentre.id,
          name: workCentre.name,
          code: workCentre.code,
          updated_fields: Object.keys(updates),
          updated_by: req.user.username
        }
      });

      res.json({
        message: 'Work centre updated successfully',
        workCentre
      });
    } catch (error) {
      next({ status: 400, code: 'UPDATE_FAILED', message: error.message });
    }
  }

  // DELETE /api/work-centres/:id
  async deleteWorkCentre(req, res, next) {
    try {
      const workCentreId = req.params.id;

      const workCentre = WorkCentre.findById(workCentreId);
      if (!workCentre) {
        return res.status(404).json({
          error: 'Work centre not found',
          code: 'NOT_FOUND'
        });
      }

      WorkCentre.delete(workCentreId);

      // Log the deletion
      AuditLog.create({
        event_type: 'work_centre_deleted',
        user_id: req.user.id,
        event_data: {
          work_centre_id: workCentreId,
          name: workCentre.name,
          code: workCentre.code,
          deleted_by: req.user.username
        }
      });

      res.json({
        message: 'Work centre deleted successfully'
      });
    } catch (error) {
      next({ status: 500, code: 'DELETE_FAILED', message: error.message });
    }
  }

  // PUT /api/work-centres/reorder
  async reorderWorkCentres(req, res, next) {
    try {
      const orderUpdates = req.body;

      if (!Array.isArray(orderUpdates) || orderUpdates.length === 0) {
        return res.status(400).json({
          error: 'Invalid reorder data',
          code: 'INVALID_DATA'
        });
      }

      WorkCentre.updateDisplayOrder(orderUpdates);

      // Log the reorder
      AuditLog.create({
        event_type: 'work_centres_reordered',
        user_id: req.user.id,
        event_data: {
          reorder_data: orderUpdates,
          reordered_by: req.user.username
        }
      });

      res.json({
        message: 'Work centres reordered successfully'
      });
    } catch (error) {
      next({ status: 400, code: 'REORDER_FAILED', message: error.message });
    }
  }

  // POST /api/work-centres/:id/machines
  async addMachine(req, res, next) {
    try {
      const workCentreId = req.params.id;
      const machineData = req.body;

      const workCentre = WorkCentre.findById(workCentreId);
      if (!workCentre) {
        return res.status(404).json({
          error: 'Work centre not found',
          code: 'NOT_FOUND'
        });
      }

      const machine = WorkCentre.addMachine(workCentreId, machineData);

      // Log the machine addition
      AuditLog.create({
        event_type: 'machine_added',
        user_id: req.user.id,
        event_data: {
          work_centre_id: workCentreId,
          work_centre_code: workCentre.code,
          machine_id: machine.id,
          machine_name: machine.name,
          machine_code: machine.code,
          added_by: req.user.username
        }
      });

      res.status(201).json({
        message: 'Machine added successfully',
        machine
      });
    } catch (error) {
      next({ status: 400, code: 'MACHINE_ADD_FAILED', message: error.message });
    }
  }

  // PUT /api/work-centres/:id/machines/:machineId
  async updateMachine(req, res, next) {
    try {
      const { id: workCentreId, machineId } = req.params;
      const updates = req.body;

      const workCentre = WorkCentre.findById(workCentreId);
      if (!workCentre) {
        return res.status(404).json({
          error: 'Work centre not found',
          code: 'NOT_FOUND'
        });
      }

      const machine = WorkCentre.updateMachine(machineId, updates);

      if (!machine) {
        return res.status(404).json({
          error: 'Machine not found',
          code: 'MACHINE_NOT_FOUND'
        });
      }

      // Log the machine update
      AuditLog.create({
        event_type: 'machine_updated',
        user_id: req.user.id,
        event_data: {
          work_centre_id: workCentreId,
          work_centre_code: workCentre.code,
          machine_id: machine.id,
          machine_name: machine.name,
          machine_code: machine.code,
          updated_fields: Object.keys(updates),
          updated_by: req.user.username
        }
      });

      res.json({
        message: 'Machine updated successfully',
        machine
      });
    } catch (error) {
      next({ status: 400, code: 'MACHINE_UPDATE_FAILED', message: error.message });
    }
  }

  // DELETE /api/work-centres/:id/machines/:machineId
  async deleteMachine(req, res, next) {
    try {
      const { id: workCentreId, machineId } = req.params;

      const workCentre = WorkCentre.findById(workCentreId);
      if (!workCentre) {
        return res.status(404).json({
          error: 'Work centre not found',
          code: 'NOT_FOUND'
        });
      }

      // Get machine info before deletion for logging
      const machine = workCentre.machines.find(m => m.id == machineId);
      if (!machine) {
        return res.status(404).json({
          error: 'Machine not found',
          code: 'MACHINE_NOT_FOUND'
        });
      }

      WorkCentre.deleteMachine(machineId);

      // Log the machine deletion
      AuditLog.create({
        event_type: 'machine_deleted',
        user_id: req.user.id,
        event_data: {
          work_centre_id: workCentreId,
          work_centre_code: workCentre.code,
          machine_id: machineId,
          machine_name: machine.name,
          machine_code: machine.code,
          deleted_by: req.user.username
        }
      });

      res.json({
        message: 'Machine deleted successfully'
      });
    } catch (error) {
      next({ status: 500, code: 'MACHINE_DELETE_FAILED', message: error.message });
    }
  }
}

module.exports = new WorkCentresController();