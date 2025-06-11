/**
 * Enhanced API Key Authentication Middleware
 * =========================================
 *
 * Replaces the previous implementation with architectural security improvements.
 * Addresses root causes: Method responsibility violation and incomplete policy enforcement.
 */

const SecurityService = require('../services/securityService');
const logger = require('../utils/logger');

/**
 * Enhanced API key validation middleware using unified security service
 * Addresses root cause: Separation of key verification and policy enforcement
 */
const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const systemId = req.headers['x-system-id'];
    const clientIp = SecurityService.getClientIp(req);

    // Create security context for this request
    const securityContext = SecurityService.createSecurityContext(req);
    securityContext.policyApplied = 'api-key';

    // Basic parameter validation
    if (!apiKey || !systemId) {
      securityContext.violations.push({
        type: 'missing_credentials',
        missing: !apiKey ? 'api-key' : 'system-id'
      });

      await SecurityService.auditSecurityEvent('api_auth_failed', req, securityContext, {
        reason: 'Missing API key or system ID'
      });

      return res.status(401).json({
        error: 'API key and system ID are required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Comprehensive API key validation with policy enforcement
    const validation = await SecurityService.validateApiKeyWithPolicy(apiKey, systemId, clientIp);

    if (!validation.isValid) {
      securityContext.violations.push({
        type: 'api_key_validation_failed',
        reason: validation.reason,
        code: validation.code
      });

      await SecurityService.auditSecurityEvent('api_auth_failed', req, securityContext, {
        reason: validation.reason,
        system_id: systemId
      });

      // Return appropriate HTTP status based on failure reason
      const statusCode = validation.code === 'IP_NOT_WHITELISTED' ? 403 : 401;

      return res.status(statusCode).json({
        error: validation.reason,
        code: validation.code
      });
    }

    // Successful validation - attach data to request
    req.apiKey = validation.apiKeyData;
    req.securityContext = securityContext;

    // Update security context with successful validation
    securityContext.apiKeyPolicy = {
      system_id: validation.apiKeyData.system_id,
      rate_limit: validation.rateLimit,
      ip_whitelist: validation.apiKeyData.ip_whitelist,
      validated_at: new Date().toISOString()
    };

    securityContext.ipValidation = validation.ipValidation;

    // Audit successful authentication
    await SecurityService.auditSecurityEvent('api_auth_success', req, securityContext, {
      system_id: systemId,
      rate_limit_applied: validation.rateLimit
    });

    logger.info('API key authentication successful', {
      system_id: systemId,
      ip: clientIp,
      rate_limit: validation.rateLimit
    });

    next();

  } catch (error) {
    logger.error('API key validation error:', error);

    // Audit the error
    const securityContext = SecurityService.createSecurityContext(req);
    securityContext.violations.push({
      type: 'validation_error',
      error: error.message
    });

    await SecurityService.auditSecurityEvent('api_auth_error', req, securityContext, {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

/**
 * Enhanced audit logging middleware with security context
 */
const logApiRequest = (req, res, next) => {
  const startTime = Date.now();

  // Capture original res.json to log response data if needed
  const originalJson = res.json;
  res.json = function(data) {
    res.responseData = data;
    return originalJson.call(this, data);
  };

  res.on('finish', async () => {
    const duration = Date.now() - startTime;

    try {
      // Enhanced logging with security context
      const logData = {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration,
        system_id: req.apiKey?.system_id,
        ip: req.securityContext?.clientIp || req.ip,
        user_agent: req.headers['user-agent'],
        security_context: {
          policy: req.securityContext?.policyApplied,
          violations: req.securityContext?.violations || [],
          rate_limit_status: req.securityContext?.rateLimitStatus
        }
      };

      // Log at appropriate level based on status
      if (res.statusCode >= 400) {
        logger.warn('API request failed', {
          ...logData,
          response_error: res.responseData?.error || 'Unknown error'
        });
      } else {
        logger.info('API request completed', logData);
      }

      // Audit high-value operations
      if (req.method !== 'GET' && req.securityContext) {
        await SecurityService.auditSecurityEvent('api_operation', req, req.securityContext, {
          operation: `${req.method} ${req.path}`,
          status_code: res.statusCode,
          duration,
          success: res.statusCode < 400
        });
      }

    } catch (error) {
      logger.error('Failed to log API request:', error);
    }
  });

  next();
};

/**
 * Rate limiting middleware specifically for API key endpoints
 * Uses the security service for consistent policy enforcement
 */
const apiKeyRateLimit = SecurityService.createPolicyMiddleware('api-key');

/**
 * Validation middleware for API key headers
 */
const validateApiKeyHeaders = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const systemId = req.headers['x-system-id'];

  // Basic format validation
  if (apiKey && (!apiKey.match(/^[A-Za-z0-9\-_]{32,}$/) || apiKey.length > 128)) {
    return res.status(400).json({
      error: 'Invalid API key format. Must be 32-128 characters, alphanumeric with hyphens and underscores only.',
      code: 'INVALID_API_KEY_FORMAT'
    });
  }

  if (systemId && (!systemId.match(/^[A-Za-z0-9\-_]{1,50}$/) || systemId.length > 50)) {
    return res.status(400).json({
      error: 'Invalid system ID format. Must be 1-50 characters, alphanumeric with hyphens and underscores only.',
      code: 'INVALID_SYSTEM_ID_FORMAT'
    });
  }

  next();
};

/**
 * Middleware to ensure API key is present and valid for protected endpoints
 */
const requireApiKey = [
  validateApiKeyHeaders,
  apiKeyRateLimit,
  validateApiKey,
  logApiRequest
];

module.exports = {
  validateApiKey,
  logApiRequest,
  apiKeyRateLimit,
  validateApiKeyHeaders,
  requireApiKey
};