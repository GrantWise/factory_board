const Joi = require('joi');
const { VALID_STATUSES } = require('../utils/orderStatus');

/**
 * Validation Middleware
 * ====================
 *
 * Provides Joi-based validation for request bodies, query parameters, and route parameters.
 * Ensures all user input is validated before reaching controllers, improving security and reliability.
 *
 * Validation errors are returned as structured JSON responses with clear error messages and codes.
 * Example error response:
 *   {
 *     error: 'Validation failed',
 *     code: 'VALIDATION_ERROR',
 *     details: { field: 'Error message', ... }
 *   }
 *
 * This middleware is used in all routes that accept user input (POST, PUT, PATCH, etc.).
 *
 * For ID parameters, use validateId to ensure IDs are present and valid integers.
 *
 * Note: Validation errors are handled here and do not propagate to the centralized error handler.
 * Only non-validation errors (e.g., database, logic) are passed to next(err).
 */

// Define step statuses separately as they are different from order statuses
const STEP_STATUSES = ['pending', 'in_progress', 'complete', 'skipped'];

// Validation schema for order updates
const orderUpdateSchema = Joi.object({
  order_number: Joi.string().max(50).optional(),
  stock_code: Joi.string().max(50).optional(),
  description: Joi.string().max(255).optional(),
  quantity_to_make: Joi.number().integer().min(0).optional(),
  quantity_completed: Joi.number().integer().min(0).optional(),
  current_operation: Joi.string().max(100).optional(),
  current_work_centre_id: Joi.number().integer().min(1).optional(),
  status: Joi.string().valid(...VALID_STATUSES).optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  due_date: Joi.date().iso().optional(),
  start_date: Joi.date().iso().optional()
});

// Validation schema for order creation
const orderCreateSchema = orderUpdateSchema.keys({
  order_number: Joi.string().max(50).required(),
  stock_code: Joi.string().max(50).required(),
  description: Joi.string().max(255).required(),
  quantity_to_make: Joi.number().integer().min(0).required(),
  status: Joi.string().valid(...VALID_STATUSES).default('not_started')
});

// Validation schema for manufacturing steps
const stepSchema = Joi.object({
  step_number: Joi.number().integer().min(1).required(),
  operation_name: Joi.string().max(100).required(),
  work_centre_id: Joi.number().integer().min(1).required(),
  planned_duration_minutes: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid(...STEP_STATUSES).default('pending')
});

// Validation schema for order import
const orderImportSchema = Joi.object({
  order_number: Joi.string().max(50).required(),
  stock_code: Joi.string().max(50).required(),
  description: Joi.string().max(255).required(),
  quantity_to_make: Joi.number().integer().min(0).required(),
  quantity_completed: Joi.number().integer().min(0).optional(),
  current_operation: Joi.string().max(100).optional(),
  current_work_centre_id: Joi.number().integer().min(1).optional(),
  status: Joi.string().valid(...VALID_STATUSES).default('not_started'),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  due_date: Joi.date().iso().optional(),
  start_date: Joi.date().iso().optional(),
  manufacturing_steps: Joi.array().items(stepSchema).optional()
});

// Validation schema for step updates
const stepUpdateSchema = Joi.object({
  status: Joi.string().valid(...STEP_STATUSES).optional(),
  quantity_completed: Joi.number().integer().min(0).optional(),
  actual_duration_minutes: Joi.number().integer().min(0).optional()
});

// Validation schema for order status updates
const orderStatusSchema = Joi.object({
  status: Joi.string().valid(...VALID_STATUSES).required(),
  reason: Joi.string().max(100).optional()
});

// Common validation schemas
const schemas = {
  // User validation
  user: {
    create: Joi.object({
      username: Joi.string().alphanum().min(3).max(50).required(),
      email: Joi.string().email().max(100).required(),
      password: Joi.string().min(6).max(100).required(),
      role: Joi.string().valid('admin', 'scheduler', 'viewer').required(),
      first_name: Joi.string().max(50).optional(),
      last_name: Joi.string().max(50).optional()
    }),
    update: Joi.object({
      username: Joi.string().alphanum().min(3).max(50).optional(),
      email: Joi.string().email().max(100).optional(),
      password: Joi.string().min(6).max(100).optional(),
      role: Joi.string().valid('admin', 'scheduler', 'viewer').optional(),
      first_name: Joi.string().max(50).optional(),
      last_name: Joi.string().max(50).optional(),
      is_active: Joi.boolean().optional()
    }),
    login: Joi.object({
      username: Joi.string().required(),
      password: Joi.string().required()
    })
  },

  // Work centre validation
  workCentre: {
    create: Joi.object({
      name: Joi.string().max(100).required(),
      code: Joi.string().max(20).required(),
      description: Joi.string().optional(),
      capacity: Joi.number().integer().min(1).default(1),
      display_order: Joi.number().integer().min(0).default(0),
      is_active: Joi.boolean().default(true)
    }),
    update: Joi.object({
      name: Joi.string().max(100).optional(),
      code: Joi.string().max(20).optional(),
      description: Joi.string().optional(),
      capacity: Joi.number().integer().min(1).optional(),
      display_order: Joi.number().integer().min(0).optional(),
      is_active: Joi.boolean().optional()
    }),
    reorder: Joi.array().items(
      Joi.object({
        id: Joi.number().integer().required(),
        display_order: Joi.number().integer().min(0).required()
      })
    ).min(1).required()
  },

  // Machine validation
  machine: {
    create: Joi.object({
      name: Joi.string().max(50).required(),
      code: Joi.string().max(20).required(),
      description: Joi.string().optional(),
      is_active: Joi.boolean().default(true)
    }),
    update: Joi.object({
      name: Joi.string().max(50).optional(),
      code: Joi.string().max(20).optional(),
      description: Joi.string().optional(),
      is_active: Joi.boolean().optional()
    })
  },

  // Manufacturing order validation
  order: {
    create: orderCreateSchema,
    update: orderUpdateSchema,
    move: Joi.object({
      to_work_centre_id: Joi.number().integer().required(),
      reason: Joi.string().max(100).default('user_decision')
    }),
    bulkImport: Joi.object({
      source_system: Joi.string().max(50).required(),
      timestamp: Joi.string().isoDate().required(),
      orders: Joi.array().items(
        Joi.object({
          order_number: Joi.string().max(50).required(),
          stock_code: Joi.string().max(50).required(),
          description: Joi.string().required(),
          quantity_to_make: Joi.number().integer().min(1).required(),
          quantity_completed: Joi.number().integer().min(0).default(0),
          current_operation: Joi.string().max(100).optional(),
          current_work_centre_id: Joi.number().integer().optional(),
          status: Joi.string().valid('not_started', 'in_progress', 'complete', 'overdue', 'on_hold', 'cancelled').default('not_started'),
          priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
          due_date: Joi.string().isoDate().optional(),
          start_date: Joi.string().isoDate().optional(),
          external_reference: Joi.string().max(100).optional(),
          metadata: Joi.object().optional()
        })
      ).min(1).required()
    })
  },

  // Manufacturing step validation
  step: {
    update: stepUpdateSchema,
    complete: Joi.object({
      quantity_completed: Joi.number().integer().min(0).required()
    })
  },

  // Query parameter validation
  query: {
    pagination: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      offset: Joi.number().integer().min(0).default(0)
    }),
    orderFilters: Joi.object({
      status: Joi.string().valid('not_started', 'in_progress', 'complete', 'overdue', 'on_hold', 'cancelled').optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
      work_centre_id: Joi.number().integer().optional(),
      due_before: Joi.string().isoDate().optional(),
      search: Joi.string().max(100).optional()
    }),
    auditFilters: Joi.object({
      event_type: Joi.string().max(50).optional(),
      order_id: Joi.number().integer().optional(),
      user_id: Joi.number().integer().optional(),
      work_centre_id: Joi.number().integer().optional(),
      from_date: Joi.string().isoDate().optional(),
      to_date: Joi.string().isoDate().optional()
    })
  }
};

// Validation middleware factory
const validate = (schema, source = 'body') => (req, res, next) => {
  let dataToValidate;

  switch (source) {
  case 'body':
    dataToValidate = req.body;
    break;
  case 'query':
    dataToValidate = req.query;
    break;
  case 'params':
    dataToValidate = req.params;
    break;
  default:
    dataToValidate = req.body;
  }

  const { error, value } = schema.validate(dataToValidate, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });

  if (error) {
    const errors = {};
    error.details.forEach(detail => {
      const key = detail.path.join('.');
      errors[key] = detail.message;
    });

    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors
    });
  }

  // Replace the original data with validated/sanitized data
  switch (source) {
  case 'body':
    req.body = value;
    break;
  case 'query':
    req.query = value;
    break;
  case 'params':
    req.params = value;
    break;
  }

  next();
};

// ID parameter validation
const validateId = (paramName = 'id') => (req, res, next) => {
  const id = req.params[paramName];

  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({
      error: 'Invalid ID parameter',
      code: 'INVALID_ID',
      parameter: paramName
    });
  }

  req.params[paramName] = parseInt(id);
  next();
};

module.exports = {
  schemas,
  validate,
  validateId
};