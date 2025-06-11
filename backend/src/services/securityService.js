/**
 * Centralized Security Service
 *
 * Implements unified security policy enforcement with proper separation of concerns.
 * Addresses root cause: Middleware composition without security orchestration.
 */

const rateLimit = require('express-rate-limit');
const ApiKey = require('../models/apiKey');
const { createLogger } = require('../utils/logger');
const { RATE_LIMITS, SECURITY_POLICIES, TIME } = require('../config/constants');

const logger = createLogger('SecurityService');

class SecurityService {
  constructor() {
    // Rate limiters cache for different policies
    this.rateLimiters = new Map();

    // Security policy cache
    this.securityPolicies = new Map();

    this.initializeDefaultPolicies();
    this.initializeRateLimiters();
  }

  /**
   * Initialize default security policies for different endpoint types
   */
  initializeDefaultPolicies() {
    // Global rate limiting policy
    this.securityPolicies.set(SECURITY_POLICIES.GLOBAL, {
      rateLimit: {
        windowMs: RATE_LIMITS.WINDOW_MS,
        max: process.env.NODE_ENV === 'production' ? RATE_LIMITS.GLOBAL_PRODUCTION : RATE_LIMITS.GLOBAL_DEVELOPMENT,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
      },
      requiresAuth: true,
      requiresApiKey: false,
      ipWhitelistEnabled: false
    });

    // API key endpoints (more restrictive)
    this.securityPolicies.set(SECURITY_POLICIES.API_KEY, {
      rateLimit: {
        windowMs: RATE_LIMITS.WINDOW_MS,
        max: process.env.NODE_ENV === 'production' ? RATE_LIMITS.API_KEY_PRODUCTION : RATE_LIMITS.API_KEY_DEVELOPMENT
      },
      requiresAuth: false,
      requiresApiKey: true,
      ipWhitelistEnabled: true,
      auditAllRequests: true
    });

    // Authentication endpoints (most restrictive)
    this.securityPolicies.set(SECURITY_POLICIES.AUTH, {
      rateLimit: {
        windowMs: RATE_LIMITS.WINDOW_MS,
        max: process.env.NODE_ENV === 'production' ? RATE_LIMITS.AUTH_PRODUCTION : RATE_LIMITS.AUTH_DEVELOPMENT
      },
      requiresAuth: false,
      requiresApiKey: false,
      ipWhitelistEnabled: false,
      auditAllRequests: true
    });

    // Admin endpoints
    this.securityPolicies.set(SECURITY_POLICIES.ADMIN, {
      rateLimit: {
        windowMs: RATE_LIMITS.WINDOW_MS,
        max: process.env.NODE_ENV === 'production' ? RATE_LIMITS.ADMIN_PRODUCTION : RATE_LIMITS.ADMIN_DEVELOPMENT
      },
      requiresAuth: true,
      requiresApiKey: false,
      ipWhitelistEnabled: false,
      requiresRole: ['admin'],
      auditAllRequests: true
    });
  }

  /**
   * Create security context for a request
   */
  createSecurityContext(req) {
    return {
      authentication: null,
      authorization: null,
      apiKeyPolicy: null,
      rateLimitStatus: null,
      ipValidation: null,
      auditTrail: [],
      violations: [],
      policyApplied: null,
      clientIp: this.getClientIp(req)
    };
  }

  /**
   * Get client IP address with proxy support
   */
  getClientIp(req) {
    return req.ip ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           'unknown';
  }

  /**
   * Get or create rate limiter for a specific policy
   */
  getRateLimiter(policyName) {
    if (!this.rateLimiters.has(policyName)) {
      const policy = this.securityPolicies.get(policyName);
      if (!policy) {
        throw new Error(`Security policy '${policyName}' not found`);
      }

      const limiter = rateLimit({
        windowMs: policy.rateLimit.windowMs,
        max: policy.rateLimit.max,
        skipSuccessfulRequests: policy.rateLimit.skipSuccessfulRequests || false,
        skipFailedRequests: policy.rateLimit.skipFailedRequests || false,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: `Too many requests for ${policyName} endpoints`,
          code: 'RATE_LIMIT_EXCEEDED',
          policy: policyName
        }
      });

      this.rateLimiters.set(policyName, limiter);
    }

    return this.rateLimiters.get(policyName);
  }

  /**
   * Initialize all rate limiters at startup to avoid creation during request handling
   */
  initializeRateLimiters() {
    for (const policyName of this.securityPolicies.keys()) {
      this.getRateLimiter(policyName);
    }
    logger.info('Rate limiters initialized for all security policies');
  }

  /**
   * Comprehensive API key validation with policy enforcement
   * Addresses root cause: Method responsibility violation in ApiKey.verifyKey
   */
  async validateApiKeyWithPolicy(apiKey, systemId, clientIp) {
    try {
      // Get complete API key data including security policy
      const apiKeyData = await ApiKey.findBySystemId(systemId);

      if (!apiKeyData) {
        return {
          isValid: false,
          reason: 'API key not found',
          code: 'INVALID_API_KEY'
        };
      }

      // Check if API key is active
      if (!apiKeyData.is_active) {
        return {
          isValid: false,
          reason: 'API key is disabled',
          code: 'API_KEY_DISABLED'
        };
      }

      // Check expiration
      if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
        return {
          isValid: false,
          reason: 'API key has expired',
          code: 'API_KEY_EXPIRED'
        };
      }

      // Verify the actual key hash
      const bcrypt = require('bcryptjs');
      const isValidKey = await bcrypt.compare(apiKey, apiKeyData.key);

      if (!isValidKey) {
        return {
          isValid: false,
          reason: 'Invalid API key',
          code: 'INVALID_API_KEY'
        };
      }

      // Validate IP whitelist if configured
      const ipValidation = this.validateIpWhitelist(clientIp, apiKeyData.ip_whitelist);
      if (!ipValidation.allowed) {
        return {
          isValid: false,
          reason: ipValidation.reason,
          code: 'IP_NOT_WHITELISTED'
        };
      }

      // Update last used timestamp
      await ApiKey.updateLastUsed(apiKeyData.id);

      return {
        isValid: true,
        apiKeyData,
        ipValidation,
        rateLimit: apiKeyData.rate_limit
      };
    } catch (error) {
      logger.error('API key validation error:', error);
      return {
        isValid: false,
        reason: 'Validation error',
        code: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * IP whitelist validation with proper CIDR and range support
   * Addresses root cause: Missing IP whitelist enforcement architecture
   */
  validateIpWhitelist(clientIp, whitelist) {
    // If no whitelist is configured, allow all IPs
    if (!whitelist || !Array.isArray(whitelist) || whitelist.length === 0) {
      return {
        allowed: true,
        reason: 'No IP restrictions configured'
      };
    }

    // Handle various IP formats
    for (const allowedIp of whitelist) {
      if (this.isIpInRange(clientIp, allowedIp)) {
        return {
          allowed: true,
          reason: `IP matches whitelist entry: ${allowedIp}`
        };
      }
    }

    return {
      allowed: false,
      reason: `IP ${clientIp} not in whitelist: ${whitelist.join(', ')}`
    };
  }

  /**
   * Check if IP is in range (supports exact match, CIDR, and simple ranges)
   */
  isIpInRange(clientIp, allowedIp) {
    // Exact match
    if (clientIp === allowedIp) {
      return true;
    }

    // Wildcard match (e.g., 192.168.1.*)
    if (allowedIp.includes('*')) {
      const pattern = allowedIp.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(clientIp);
    }

    // CIDR notation (e.g., 192.168.1.0/24)
    if (allowedIp.includes('/')) {
      return this.isIpInCidr(clientIp, allowedIp);
    }

    // IP range (e.g., 192.168.1.1-192.168.1.100)
    if (allowedIp.includes('-')) {
      return this.isIpInRange(clientIp, allowedIp);
    }

    return false;
  }

  /**
   * Check if IP is in CIDR range
   */
  isIpInCidr(ip, cidr) {
    try {
      const [network, prefixLength] = cidr.split('/');
      const prefix = parseInt(prefixLength, 10);

      if (prefix < 0 || prefix > 32) {
        return false;
      }

      const ipInt = this.ipToInt(ip);
      const networkInt = this.ipToInt(network);
      const mask = -1 << 32 - prefix;

      return (ipInt & mask) === (networkInt & mask);
    } catch (error) {
      logger.warn('Invalid CIDR notation:', cidr);
      return false;
    }
  }

  /**
   * Convert IP address to integer
   */
  ipToInt(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  /**
   * Audit security events with comprehensive context
   */
  async auditSecurityEvent(eventType, req, securityContext, additionalData = {}) {
    try {
      // For now, just log security events to application logs
      // TODO: Implement proper security audit table
      logger.info('Security audit event:', {
        event_type: eventType,
        user_id: req.user?.id || null,
        ip_address: securityContext.clientIp,
        user_agent: req.headers['user-agent'],
        endpoint: `${req.method} ${req.originalUrl}`,
        security_context: {
          policy_applied: securityContext.policyApplied,
          authentication_method: securityContext.authentication?.method,
          api_key_system_id: securityContext.apiKeyPolicy?.system_id,
          violations: securityContext.violations
        },
        ...additionalData
      });

      // Log security violations at higher level
      if (securityContext.violations.length > 0) {
        logger.warn('Security violations detected:', {
          violations: securityContext.violations,
          endpoint: `${req.method} ${req.originalUrl}`,
          ip: securityContext.clientIp
        });
      }
    } catch (error) {
      logger.error('Failed to audit security event:', error);
    }
  }

  /**
   * Create middleware for specific security policy
   */
  createPolicyMiddleware(policyName) {
    const policy = this.securityPolicies.get(policyName);
    if (!policy) {
      throw new Error(`Security policy '${policyName}' not found`);
    }

    return (req, res, next) => {
      const securityContext = this.createSecurityContext(req);
      securityContext.policyApplied = policyName;

      // Attach security context to request early
      req.securityContext = securityContext;

      // Apply rate limiting using traditional middleware pattern
      const rateLimiter = this.getRateLimiter(policyName);

      rateLimiter(req, res, async (err) => {
        if (err) {
          // Rate limit exceeded
          securityContext.violations.push({
            type: 'rate_limit_exceeded',
            policy: policyName
          });

          await this.auditSecurityEvent('security_violation', req, securityContext, {
            violation_type: 'rate_limit',
            error: err.message
          });

          return res.status(429).json({
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            policy: policyName
          });
        }

        // Rate limiting passed
        securityContext.rateLimitStatus = {
          remaining: res.getHeader('X-RateLimit-Remaining'),
          limit: res.getHeader('X-RateLimit-Limit'),
          reset: res.getHeader('X-RateLimit-Reset')
        };

        // Audit if required by policy
        if (policy.auditAllRequests) {
          await this.auditSecurityEvent('security_policy_applied', req, securityContext);
        }

        next();
      });
    };
  }
}

module.exports = new SecurityService();