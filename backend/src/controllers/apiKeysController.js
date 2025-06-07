const ApiKey = require('../models/apiKey');
const { createLogger } = require('../utils/logger');

const logger = createLogger('apiKeysController');

/**
 * ApiKeysController
 * =================
 *
 * Handles API key management for external system integration.
 * Provides CRUD operations for API keys with proper validation and security.
 */
class ApiKeysController {
  // GET /api/admin/api-keys
  async getAllApiKeys(req, res, next) {
    try {
      const apiKeys = ApiKey.findAll();
      
      // Remove sensitive key data from response
      const sanitizedKeys = apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        system_id: key.system_id,
        is_active: key.is_active,
        rate_limit: key.rate_limit,
        ip_whitelist: key.ip_whitelist,
        created_at: key.created_at,
        last_used_at: key.last_used_at,
        expires_at: key.expires_at,
        created_by: key.created_by,
        metadata: key.metadata
      }));

      res.json({
        message: 'API keys retrieved successfully',
        data: sanitizedKeys
      });
    } catch (error) {
      logger.error('Error retrieving API keys', { error: error.message });
      next({ status: 500, code: 'API_KEYS_FETCH_ERROR', message: 'Failed to retrieve API keys' });
    }
  }

  // GET /api/admin/api-keys/:id
  async getApiKeyById(req, res, next) {
    try {
      const { id } = req.params;
      const apiKey = ApiKey.findById(parseInt(id));

      if (!apiKey) {
        return next({ status: 404, code: 'API_KEY_NOT_FOUND', message: 'API key not found' });
      }

      // Remove sensitive key data from response
      const sanitizedKey = {
        id: apiKey.id,
        name: apiKey.name,
        system_id: apiKey.system_id,
        is_active: apiKey.is_active,
        rate_limit: apiKey.rate_limit,
        ip_whitelist: apiKey.ip_whitelist,
        created_at: apiKey.created_at,
        last_used_at: apiKey.last_used_at,
        expires_at: apiKey.expires_at,
        created_by: apiKey.created_by,
        metadata: apiKey.metadata
      };

      res.json({
        message: 'API key retrieved successfully',
        data: sanitizedKey
      });
    } catch (error) {
      logger.error('Error retrieving API key', { error: error.message, id: req.params.id });
      next({ status: 500, code: 'API_KEY_FETCH_ERROR', message: 'Failed to retrieve API key' });
    }
  }

  // POST /api/admin/api-keys
  async createApiKey(req, res, next) {
    try {
      const { name, system_id, rate_limit, ip_whitelist, expires_at, metadata } = req.body;
      const userId = req.user.id;

      // Validate required fields
      if (!name || !system_id) {
        return next({ 
          status: 400, 
          code: 'MISSING_REQUIRED_FIELDS', 
          message: 'Name and system_id are required' 
        });
      }

      // Check if system_id already exists
      if (ApiKey.systemIdExists(system_id)) {
        return next({ 
          status: 409, 
          code: 'SYSTEM_ID_EXISTS', 
          message: 'System ID already exists' 
        });
      }

      // Create API key
      const result = await ApiKey.generateKey(name, system_id, userId, {
        rateLimit: rate_limit,
        ipWhitelist: ip_whitelist,
        expiresAt: expires_at,
        metadata: metadata
      });

      logger.info('API key created', { 
        system_id, 
        created_by: userId,
        expires_at
      });

      res.status(201).json({
        message: 'API key created successfully',
        data: {
          id: result.id,
          name: result.name,
          system_id: result.system_id,
          api_key: result.plainKey, // Only returned once
          rate_limit: result.rate_limit,
          ip_whitelist: result.ip_whitelist,
          expires_at: result.expires_at,
          metadata: result.metadata
        }
      });
    } catch (error) {
      logger.error('Error creating API key', { error: error.message });
      next({ status: 500, code: 'API_KEY_CREATE_ERROR', message: 'Failed to create API key' });
    }
  }

  // PUT /api/admin/api-keys/:id
  async updateApiKey(req, res, next) {
    try {
      const { id } = req.params;
      const { name, is_active, rate_limit, ip_whitelist, expires_at, metadata } = req.body;

      const existingKey = ApiKey.findById(parseInt(id));
      if (!existingKey) {
        return next({ status: 404, code: 'API_KEY_NOT_FOUND', message: 'API key not found' });
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (rate_limit !== undefined) updateData.rate_limit = rate_limit;
      if (ip_whitelist !== undefined) updateData.ip_whitelist = ip_whitelist;
      if (expires_at !== undefined) updateData.expires_at = expires_at;
      if (metadata !== undefined) updateData.metadata = metadata;

      const updatedKey = ApiKey.update(parseInt(id), updateData);

      logger.info('API key updated', { 
        id: parseInt(id), 
        system_id: existingKey.system_id,
        updated_by: req.user.id 
      });

      res.json({
        message: 'API key updated successfully',
        data: {
          id: updatedKey.id,
          name: updatedKey.name,
          system_id: updatedKey.system_id,
          is_active: updatedKey.is_active,
          rate_limit: updatedKey.rate_limit,
          ip_whitelist: updatedKey.ip_whitelist,
          expires_at: updatedKey.expires_at,
          metadata: updatedKey.metadata
        }
      });
    } catch (error) {
      logger.error('Error updating API key', { error: error.message, id: req.params.id });
      next({ status: 500, code: 'API_KEY_UPDATE_ERROR', message: 'Failed to update API key' });
    }
  }

  // POST /api/admin/api-keys/:id/rotate
  async rotateApiKey(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const existingKey = ApiKey.findById(parseInt(id));
      if (!existingKey) {
        return next({ status: 404, code: 'API_KEY_NOT_FOUND', message: 'API key not found' });
      }

      const newKey = await ApiKey.rotateKey(parseInt(id), userId);

      logger.info('API key rotated', { 
        id: parseInt(id), 
        system_id: existingKey.system_id,
        rotated_by: userId 
      });

      res.json({
        message: 'API key rotated successfully',
        data: {
          id: parseInt(id),
          system_id: existingKey.system_id,
          api_key: newKey // Only returned once
        }
      });
    } catch (error) {
      logger.error('Error rotating API key', { error: error.message, id: req.params.id });
      next({ status: 500, code: 'API_KEY_ROTATE_ERROR', message: 'Failed to rotate API key' });
    }
  }

  // DELETE /api/admin/api-keys/:id
  async deleteApiKey(req, res, next) {
    try {
      const { id } = req.params;

      const existingKey = ApiKey.findById(parseInt(id));
      if (!existingKey) {
        return next({ status: 404, code: 'API_KEY_NOT_FOUND', message: 'API key not found' });
      }

      ApiKey.delete(parseInt(id));

      logger.info('API key deleted', { 
        id: parseInt(id), 
        system_id: existingKey.system_id,
        deleted_by: req.user.id 
      });

      res.json({
        message: 'API key deactivated successfully'
      });
    } catch (error) {
      logger.error('Error deleting API key', { error: error.message, id: req.params.id });
      next({ status: 500, code: 'API_KEY_DELETE_ERROR', message: 'Failed to delete API key' });
    }
  }

  // GET /api/admin/api-keys/:id/usage
  async getApiKeyUsage(req, res, next) {
    try {
      const { id } = req.params;

      const apiKey = ApiKey.findById(parseInt(id));
      if (!apiKey) {
        return next({ status: 404, code: 'API_KEY_NOT_FOUND', message: 'API key not found' });
      }

      // For now, return basic usage info
      // In the future, this could include detailed analytics
      const usage = {
        id: apiKey.id,
        system_id: apiKey.system_id,
        last_used_at: apiKey.last_used_at,
        is_active: apiKey.is_active,
        expires_at: apiKey.expires_at,
        rate_limit: apiKey.rate_limit
      };

      res.json({
        message: 'API key usage retrieved successfully',
        data: usage
      });
    } catch (error) {
      logger.error('Error retrieving API key usage', { error: error.message, id: req.params.id });
      next({ status: 500, code: 'API_KEY_USAGE_ERROR', message: 'Failed to retrieve API key usage' });
    }
  }
}

module.exports = new ApiKeysController();