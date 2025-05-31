const Joi = require('joi');

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
    create: Joi.object({
      order_number: Joi.string().max(50).required(),
      stock_code: Joi.string().max(50).required(),
      description: Joi.string().required(),
      quantity_to_make: Joi.number().integer().min(1).required(),
      quantity_completed: Joi.number().integer().min(0).default(0),
      current_operation: Joi.string().max(100).optional(),
      current_work_centre_id: Joi.number().integer().optional(),
      status: Joi.string().valid('not_started', 'in_progress', 'complete', 'overdue', 'on_hold', 'cancelled').default('not_started'),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
      due_date: Joi.date().iso().optional(),
      start_date: Joi.date().iso().optional(),
      manufacturing_steps: Joi.array().items(
        Joi.object({
          step_number: Joi.number().integer().min(1).required(),
          operation_name: Joi.string().max(100).required(),
          work_centre_id: Joi.number().integer().required(),
          planned_duration_minutes: Joi.number().integer().min(0).optional()
        })
      ).optional()
    }),
    update: Joi.object({
      order_number: Joi.string().max(50).optional(),
      stock_code: Joi.string().max(50).optional(),
      description: Joi.string().optional(),
      quantity_to_make: Joi.number().integer().min(1).optional(),
      quantity_completed: Joi.number().integer().min(0).optional(),
      current_operation: Joi.string().max(100).optional(),
      current_work_centre_id: Joi.number().integer().optional(),
      status: Joi.string().valid('not_started', 'in_progress', 'complete', 'overdue', 'on_hold', 'cancelled').optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
      due_date: Joi.date().iso().optional(),
      start_date: Joi.date().iso().optional(),
      completion_date: Joi.date().iso().optional()
    }),
    move: Joi.object({
      to_work_centre_id: Joi.number().integer().required(),
      reason: Joi.string().max(100).default('user_decision')
    })
  },
  
  // Manufacturing step validation
  step: {
    update: Joi.object({
      operation_name: Joi.string().max(100).optional(),
      work_centre_id: Joi.number().integer().optional(),
      status: Joi.string().valid('pending', 'in_progress', 'complete', 'skipped').optional(),
      planned_duration_minutes: Joi.number().integer().min(0).optional(),
      actual_duration_minutes: Joi.number().integer().min(0).optional(),
      quantity_completed: Joi.number().integer().min(0).optional(),
      started_at: Joi.date().iso().optional(),
      completed_at: Joi.date().iso().optional()
    }),
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
      due_before: Joi.date().iso().optional(),
      search: Joi.string().max(100).optional()
    }),
    auditFilters: Joi.object({
      event_type: Joi.string().max(50).optional(),
      order_id: Joi.number().integer().optional(),
      user_id: Joi.number().integer().optional(),
      work_centre_id: Joi.number().integer().optional(),
      from_date: Joi.date().iso().optional(),
      to_date: Joi.date().iso().optional()
    })
  }
};

// Validation middleware factory
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
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
};

// ID parameter validation
const validateId = (paramName = 'id') => {
  return (req, res, next) => {
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
};

module.exports = {
  schemas,
  validate,
  validateId
};