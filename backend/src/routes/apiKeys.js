const express = require('express');
const router = express.Router();
const ApiKeysController = require('../controllers/apiKeysController');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { requireRole } = require('../middleware/permissions');
const Joi = require('joi');

/**
 * @swagger
 * components:
 *   schemas:
 *     ApiKey:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the API key
 *         name:
 *           type: string
 *           description: Human-readable name for the API key
 *         system_id:
 *           type: string
 *           description: Unique identifier for the external system
 *         is_active:
 *           type: boolean
 *           description: Whether the API key is active
 *         rate_limit:
 *           type: integer
 *           description: Number of requests per 15-minute window
 *         ip_whitelist:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of allowed IP addresses or CIDR ranges
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: When the API key was created
 *         last_used_at:
 *           type: string
 *           format: date-time
 *           description: When the API key was last used
 *         expires_at:
 *           type: string
 *           format: date-time
 *           description: When the API key expires (optional)
 *         metadata:
 *           type: object
 *           description: Additional metadata for the API key
 *     ApiKeyCreate:
 *       type: object
 *       required:
 *         - name
 *         - system_id
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: Human-readable name for the API key
 *         system_id:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           pattern: '^[a-zA-Z0-9_-]+$'
 *           description: Unique identifier for the external system
 *         rate_limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           default: 1000
 *           description: Number of requests per 15-minute window
 *         ip_whitelist:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of allowed IP addresses or CIDR ranges
 *         expires_at:
 *           type: string
 *           format: date-time
 *           description: When the API key should expire (optional)
 *         metadata:
 *           type: object
 *           description: Additional metadata for the API key
 *     ApiKeyUpdate:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: Human-readable name for the API key
 *         is_active:
 *           type: boolean
 *           description: Whether the API key is active
 *         rate_limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           description: Number of requests per 15-minute window
 *         ip_whitelist:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of allowed IP addresses or CIDR ranges
 *         expires_at:
 *           type: string
 *           format: date-time
 *           description: When the API key should expire (optional)
 *         metadata:
 *           type: object
 *           description: Additional metadata for the API key
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *     ApiKeyAuth:
 *       type: apiKey
 *       in: header
 *       name: X-API-Key
 */

// Validation schemas for API key operations
const apiKeyCreateSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  system_id: Joi.string().min(1).max(50).pattern(/^[a-zA-Z0-9_-]+$/).required(),
  rate_limit: Joi.number().integer().min(1).max(10000).optional(),
  ip_whitelist: Joi.array().items(Joi.string()).optional(),
  expires_at: Joi.date().iso().optional(),
  metadata: Joi.object().optional()
});

const apiKeyUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  is_active: Joi.boolean().optional(),
  rate_limit: Joi.number().integer().min(1).max(10000).optional(),
  ip_whitelist: Joi.array().items(Joi.string()).optional(),
  expires_at: Joi.date().iso().optional(),
  metadata: Joi.object().optional()
});

/**
 * @swagger
 * /api/admin/api-keys:
 *   get:
 *     summary: Get all API keys
 *     description: Retrieve a list of all API keys (admin only)
 *     tags: [API Keys]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ApiKey'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/', 
  authenticateToken, 
  requireRole(['admin']), 
  ApiKeysController.getAllApiKeys
);

/**
 * @swagger
 * /api/admin/api-keys/{id}:
 *   get:
 *     summary: Get API key by ID
 *     description: Retrieve a specific API key by its ID (admin only)
 *     tags: [API Keys]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/ApiKey'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  ApiKeysController.getApiKeyById
);

/**
 * @swagger
 * /api/admin/api-keys:
 *   post:
 *     summary: Create a new API key
 *     description: Create a new API key for external system integration (admin only)
 *     tags: [API Keys]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApiKeyCreate'
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     system_id:
 *                       type: string
 *                     api_key:
 *                       type: string
 *                       description: The generated API key (only returned once)
 *                     rate_limit:
 *                       type: integer
 *                     ip_whitelist:
 *                       type: array
 *                       items:
 *                         type: string
 *                     expires_at:
 *                       type: string
 *                       format: date-time
 *                     metadata:
 *                       type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 */
router.post('/', 
  authenticateToken, 
  requireRole(['admin']), 
  validate(apiKeyCreateSchema),
  ApiKeysController.createApiKey
);

/**
 * @swagger
 * /api/admin/api-keys/{id}:
 *   put:
 *     summary: Update an API key
 *     description: Update an existing API key (admin only)
 *     tags: [API Keys]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: API key ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApiKeyUpdate'
 *     responses:
 *       200:
 *         description: API key updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/ApiKey'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  validate(apiKeyUpdateSchema),
  ApiKeysController.updateApiKey
);

/**
 * @swagger
 * /api/admin/api-keys/{id}/rotate:
 *   post:
 *     summary: Rotate an API key
 *     description: Generate a new API key for the specified system (admin only)
 *     tags: [API Keys]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key rotated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     system_id:
 *                       type: string
 *                     api_key:
 *                       type: string
 *                       description: The new API key (only returned once)
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/:id/rotate', 
  authenticateToken, 
  requireRole(['admin']), 
  ApiKeysController.rotateApiKey
);

/**
 * @swagger
 * /api/admin/api-keys/{id}:
 *   delete:
 *     summary: Deactivate an API key
 *     description: Deactivate (soft delete) an API key (admin only)
 *     tags: [API Keys]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  ApiKeysController.deleteApiKey
);

/**
 * @swagger
 * /api/admin/api-keys/{id}/usage:
 *   get:
 *     summary: Get API key usage statistics
 *     description: Retrieve usage statistics for a specific API key (admin only)
 *     tags: [API Keys]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key usage retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     system_id:
 *                       type: string
 *                     last_used_at:
 *                       type: string
 *                       format: date-time
 *                     is_active:
 *                       type: boolean
 *                     expires_at:
 *                       type: string
 *                       format: date-time
 *                     rate_limit:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id/usage', 
  authenticateToken, 
  requireRole(['admin']), 
  ApiKeysController.getApiKeyUsage
);

module.exports = router;