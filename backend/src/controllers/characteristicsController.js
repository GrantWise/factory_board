const JobCharacteristic = require('../models/JobCharacteristic');
const ManufacturingOrder = require('../models/ManufacturingOrder');

/**
 * CharacteristicsController
 * ========================
 *
 * Handles all endpoints related to job characteristics and visual grouping.
 */
class CharacteristicsController {
  /**
   * Get comprehensive characteristics data including statistics and available values
   * @route GET /api/characteristics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with stats and available characteristics
   */
  async getAllCharacteristics(req, res, next) {
    try {
      const stats = JobCharacteristic.getCharacteristicStats();
      const available = JobCharacteristic.getAvailableCharacteristicsFromTypes();

      res.json({
        stats,
        available
      });
    } catch (error) {
      next({ status: 500, code: 'FETCH_FAILED', message: error.message });
    }
  }

  // GET /api/characteristics/types/:type
  async getCharacteristicsByType(req, res, next) {
    try {
      const { type } = req.params;
      const characteristics = JobCharacteristic.findByType(type);

      res.json(characteristics);
    } catch (error) {
      next({ status: 500, code: 'FETCH_FAILED', message: error.message });
    }
  }

  // GET /api/orders/:id/characteristics
  async getOrderCharacteristics(req, res, next) {
    try {
      const { id: orderId } = req.params;
      const characteristics = JobCharacteristic.findByOrderId(parseInt(orderId));

      res.json(characteristics);
    } catch (error) {
      next({ status: 500, code: 'FETCH_FAILED', message: error.message });
    }
  }

  /**
   * Create a new job characteristic for a specific order
   * @route POST /api/orders/:id/characteristics
   * @param {Object} req - Express request object
   * @param {Object} req.params - Route parameters
   * @param {number} req.params.id - Order ID
   * @param {Object} req.body - Request body
   * @param {string} req.body.type - Characteristic type (e.g., 'material', 'priority')
   * @param {string} req.body.value - Characteristic value
   * @param {string} [req.body.color] - Display color (auto-assigned if not provided)
   * @param {string} [req.body.display_name] - Human-readable name
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with created characteristic
   */
  async createOrderCharacteristic(req, res, next) {
    try {
      const { id: orderId } = req.params;
      const { type, value, color, display_name } = req.body;

      // Validate required fields
      if (!type || !value) {
        return next({
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Type and value are required'
        });
      }

      // Check if order exists
      const order = ManufacturingOrder.findById(parseInt(orderId));
      if (!order) {
        return next({
          status: 404,
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found'
        });
      }

      // Get existing color assignments for consistency
      const existingColors = JobCharacteristic.getExistingColorAssignments();
      const assignedColor = color || JobCharacteristic.assignColor(type, value, existingColors);

      const characteristic = JobCharacteristic.create({
        order_id: parseInt(orderId),
        type,
        value,
        color: assignedColor,
        display_name: display_name || value,
        is_system_generated: false
      });

      res.status(201).json(characteristic);
    } catch (error) {
      next({ status: 500, code: 'CREATE_FAILED', message: error.message });
    }
  }

  // PUT /api/characteristics/:id
  async updateCharacteristic(req, res, next) {
    try {
      const { id } = req.params;
      const { type, value, color, display_name } = req.body;

      const existing = JobCharacteristic.findById(parseInt(id));
      if (!existing) {
        return next({
          status: 404,
          code: 'CHARACTERISTIC_NOT_FOUND',
          message: 'Characteristic not found'
        });
      }

      const updated = JobCharacteristic.update(parseInt(id), {
        type,
        value,
        color,
        display_name
      });

      res.json(updated);
    } catch (error) {
      next({ status: 500, code: 'UPDATE_FAILED', message: error.message });
    }
  }

  // DELETE /api/characteristics/:id
  async deleteCharacteristic(req, res, next) {
    try {
      const { id } = req.params;

      const existing = JobCharacteristic.findById(parseInt(id));
      if (!existing) {
        return next({
          status: 404,
          code: 'CHARACTERISTIC_NOT_FOUND',
          message: 'Characteristic not found'
        });
      }

      JobCharacteristic.delete(parseInt(id));
      res.status(204).send();
    } catch (error) {
      next({ status: 500, code: 'DELETE_FAILED', message: error.message });
    }
  }

  /**
   * Refresh system-generated characteristics for an order
   * @route POST /api/orders/:id/characteristics/refresh
   * @param {Object} req - Express request object
   * @param {Object} req.params - Route parameters
   * @param {number} req.params.id - Order ID
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>} JSON response with refreshed characteristics
   * @note Deletes existing system characteristics and regenerates them
   */
  async refreshOrderCharacteristics(req, res, next) {
    try {
      const { id: orderId } = req.params;

      const order = ManufacturingOrder.findById(parseInt(orderId));
      if (!order) {
        return next({
          status: 404,
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found'
        });
      }

      // Delete existing system-generated characteristics and recreate
      const characteristics = ManufacturingOrder.refreshCharacteristics(parseInt(orderId));

      res.json(characteristics);
    } catch (error) {
      next({ status: 500, code: 'REFRESH_FAILED', message: error.message });
    }
  }

  // POST /api/orders/:id/characteristics/detect
  async detectCharacteristics(req, res, next) {
    try {
      const { id: orderId } = req.params;

      const order = ManufacturingOrder.findById(parseInt(orderId));
      if (!order) {
        return next({
          status: 404,
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found'
        });
      }

      // Get potential characteristics without creating them
      const detectedCharacteristics = JobCharacteristic.detectCharacteristicsForOrder(order);

      // Add color assignments
      const existingColors = JobCharacteristic.getExistingColorAssignments();
      const withColors = detectedCharacteristics.map(char => ({
        ...char,
        color: JobCharacteristic.assignColor(char.type, char.value, existingColors)
      }));

      res.json(withColors);
    } catch (error) {
      next({ status: 500, code: 'DETECTION_FAILED', message: error.message });
    }
  }
}

module.exports = new CharacteristicsController();