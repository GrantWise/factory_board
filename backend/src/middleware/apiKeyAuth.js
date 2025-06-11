const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const ApiKey = require('../models/apiKey');
const { createLogger } = require('../utils/logger');

const logger = createLogger('apiKeyAuth');

/**
 * API Key Authentication Middleware
 * ================================
 *
 * Validates API keys for external system integration.
 * API keys should be provided in the X-API-Key header.
 *
 * Example usage:
 * router.post('/external/import',
 *   validateApiKey,
 *   validate(schemas.order.bulkImport),
 *   OrdersController.importExternalOrders
 * );
 */

// API Key validation schema
const apiKeySchema = Joi.object({
  'x-api-key': Joi.string()
    .required()
    .pattern(/^[A-Za-z0-9-_]{32,}$/)
    .messages({
      'string.pattern.base': 'API key must be at least 32 characters and contain only letters, numbers, hyphens, and underscores',
      'any.required': 'API key is required'
    })
});

// Rate limiter configuration
const createRateLimiter = (limit) => rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: limit,
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// IP whitelist check
const checkIpWhitelist = (ip, whitelist) => {
  if (!whitelist || whitelist.length === 0) return true;
  return whitelist.some(allowedIp => {
    if (allowedIp.includes('/')) {
      // Handle CIDR notation
      const [subnet, bits] = allowedIp.split('/');
      const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
      const subnetNum = subnet.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
      const mask = ~((1 << 32 - bits) - 1);
      return (ipNum & mask) === (subnetNum & mask);
    }
    return ip === allowedIp;
  });
};

// Enhanced API key validation middleware
const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const systemId = req.headers['x-system-id'];

    if (!apiKey || !systemId) {
      logger.warn('Missing API key or system ID', {
        ip: req.ip,
        headers: req.headers
      });
      return res.status(401).json({
        error: 'API key and system ID are required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Get API key details from database
    const keyDetails = ApiKey.findBySystemId(systemId);

    if (!keyDetails) {
      logger.warn('Invalid system ID', { systemId });
      return res.status(401).json({
        error: 'Invalid system ID',
        code: 'INVALID_SYSTEM'
      });
    }

    // Verify API key
    const isValid = await ApiKey.verifyKey(apiKey, systemId);
    if (!isValid) {
      logger.warn('Invalid API key', { systemId });
      return res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }

    // Check IP whitelist
    if (!checkIpWhitelist(req.ip, keyDetails.ip_whitelist)) {
      logger.warn('IP not in whitelist', {
        ip: req.ip,
        systemId
      });
      return res.status(403).json({
        error: 'IP not authorized',
        code: 'IP_NOT_AUTHORIZED'
      });
    }

    // Check expiration
    if (keyDetails.expires_at && new Date(keyDetails.expires_at) < new Date()) {
      logger.warn('API key expired', { systemId });
      return res.status(401).json({
        error: 'API key expired',
        code: 'API_KEY_EXPIRED'
      });
    }

    // Attach key details to request for use in controllers
    req.apiKey = keyDetails;

    // Apply rate limiting
    const limiter = createRateLimiter(keyDetails.rate_limit);
    return limiter(req, res, next);

  } catch (error) {
    logger.error('API key validation error', { error });
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Audit logging middleware
const logApiRequest = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('API request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      systemId: req.apiKey?.system_id,
      ip: req.ip
    });
  });

  next();
};

module.exports = {
  validateApiKey,
  logApiRequest,
  apiKeySchema
};