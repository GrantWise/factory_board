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
  /**
   * Get all work centres with optional inclusion of inactive centres
   * @route GET /api/work-centres
   * @param {Object} req - Express request object
   * @param {Object} req.query - Query parameters
   * @param {string} [req.query.include_inactive] - Include inactive work centres if 'true'
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with work centres array
   * @example
   * // Get only active work centres
   * GET /api/work-centres
   * 
   * // Get all work centres including inactive
   * GET /api/work-centres?include_inactive=true
   */
  async getAllWorkCentres(req, res, next) {
    try {
      const includeInactive = req.query.include_inactive === 'true';
      const workCentres = WorkCentre.findAll(includeInactive);
      res.json({ work_centres: workCentres });
    } catch (error) {
      next({ status: 500, code: 'FETCH_FAILED', message: error.message });
    }
  }

  /**
   * Get a single work centre by ID with associated machines and current job count
   * @route GET /api/work-centres/:id
   * @param {Object} req - Express request object
   * @param {Object} req.params - URL parameters
   * @param {string} req.params.id - Work centre ID
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with work centre details including machines
   * @throws {404} Work centre not found
   */
  async getWorkCentre(req, res, next) {
    try {
      const workCentre = WorkCentre.findById(req.params.id);

      if (!workCentre) {
        return next({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Work centre not found'
        });
      }

      res.json({
        work_centre: workCentre
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
        return next({
          status: 409,
          code: 'DUPLICATE_CODE',
          message: 'Work centre code already exists'
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
        work_centre: workCentre
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
        return next({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Work centre not found'
        });
      }

      // Check if code conflicts with another work centre
      if (updates.code && WorkCentre.codeExists(updates.code, workCentreId)) {
        return next({
          status: 409,
          code: 'DUPLICATE_CODE',
          message: 'Work centre code already exists'
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
        work_centre: workCentre
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
        return next({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Work centre not found'
        });
      }

      // Check if work centre has any assigned jobs
      if (workCentre.current_jobs > 0) {
        return next({
          status: 409,
          code: 'HAS_ASSIGNED_JOBS',
          message: `Cannot delete work centre with ${workCentre.current_jobs} assigned job(s). Please move or complete these jobs first.`
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
        return next({
          status: 400,
          code: 'INVALID_DATA',
          message: 'Invalid reorder data'
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
        return next({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Work centre not found'
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
        return next({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Work centre not found'
        });
      }

      const machine = WorkCentre.updateMachine(machineId, updates);

      if (!machine) {
        return next({
          status: 404,
          code: 'MACHINE_NOT_FOUND',
          message: 'Machine not found'
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
        return next({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Work centre not found'
        });
      }

      // Get machine info before deletion for logging
      const machine = workCentre.machines.find(m => m.id == machineId);
      if (!machine) {
        return next({
          status: 404,
          code: 'MACHINE_NOT_FOUND',
          message: 'Machine not found'
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

  // External API Methods

  // GET /api/external/work-centres - Get work centres for external systems
  async getWorkCentresForExternal(req, res, next) {
    try {
      const activeOnly = req.query.active_only !== 'false'; // Default to true
      const workCentres = WorkCentre.findAll(!activeOnly);

      // Filter to only active work centres if requested
      const filteredWorkCentres = activeOnly ?
        workCentres.filter(wc => wc.is_active) :
        workCentres;

      // Return simplified data for external systems
      const externalData = filteredWorkCentres.map(wc => ({
        id: wc.id,
        name: wc.name,
        code: wc.code,
        description: wc.description,
        capacity: wc.capacity,
        is_active: wc.is_active
      }));

      res.json({
        message: 'Work centres retrieved successfully',
        data: externalData
      });
    } catch (error) {
      next({ status: 500, code: 'EXTERNAL_FETCH_FAILED', message: error.message });
    }
  }
}

module.exports = new WorkCentresController();