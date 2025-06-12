const { getDatabase } = require('../utils/database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

/**
 * ApiKey Model
 * ============
 *
 * Handles database operations for API key management including creation,
 * verification, rotation, and access control with security features.
 *
 * Key Features:
 * - Secure key hashing with bcrypt
 * - IP whitelist validation support
 * - Rate limiting configuration
 * - Expiration date management
 * - Comprehensive audit logging
 */
class ApiKey {
  constructor() {
    this.db = getDatabase();
    this.table = 'api_keys';
  }

  // Create a new API key
  create(apiKeyData) {
    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (name, key, system_id, is_active, rate_limit, ip_whitelist, created_by, expires_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      apiKeyData.name,
      apiKeyData.key,
      apiKeyData.system_id,
      apiKeyData.is_active !== undefined ? apiKeyData.is_active : 1,
      apiKeyData.rate_limit || 1000,
      apiKeyData.ip_whitelist ? JSON.stringify(apiKeyData.ip_whitelist) : null,
      apiKeyData.created_by,
      apiKeyData.expires_at || null,
      apiKeyData.metadata ? JSON.stringify(apiKeyData.metadata) : '{}'
    );

    return this.findById(result.lastInsertRowid);
  }

  // Find API key by ID
  findById(id) {
    const stmt = this.db.prepare(`
      SELECT id, name, system_id, is_active, rate_limit, ip_whitelist, 
             created_at, last_used_at, expires_at, created_by, metadata
      FROM ${this.table}
      WHERE id = ?
    `);

    const result = stmt.get(id);
    if (result) {
      result.ip_whitelist = result.ip_whitelist ? JSON.parse(result.ip_whitelist) : [];
      result.metadata = result.metadata ? JSON.parse(result.metadata) : {};
    }
    return result;
  }

  // Find API key by system ID
  findBySystemId(systemId) {
    const stmt = this.db.prepare(`
      SELECT id, name, system_id, is_active, rate_limit, ip_whitelist,
             created_at, last_used_at, expires_at, created_by, metadata
      FROM ${this.table}
      WHERE system_id = ? AND is_active = 1
    `);

    const result = stmt.get(systemId);
    if (result) {
      result.ip_whitelist = result.ip_whitelist ? JSON.parse(result.ip_whitelist) : [];
      result.metadata = result.metadata ? JSON.parse(result.metadata) : {};
    }
    return result;
  }

  // Get all API keys
  findAll() {
    const stmt = this.db.prepare(`
      SELECT id, name, system_id, is_active, rate_limit, ip_whitelist,
             created_at, last_used_at, expires_at, created_by, metadata
      FROM ${this.table}
      ORDER BY created_at DESC
    `);

    const results = stmt.all();
    return results.map(result => {
      result.ip_whitelist = result.ip_whitelist ? JSON.parse(result.ip_whitelist) : [];
      result.metadata = result.metadata ? JSON.parse(result.metadata) : {};
      return result;
    });
  }

  /**
   * Generate a new API key with secure hashing
   * @param {string} name - Human-readable name for the API key
   * @param {string} systemId - Unique system identifier
   * @param {number} userId - User ID creating the key
   * @param {Object} [options={}] - Additional options
   * @param {number} [options.rateLimit=1000] - Rate limit per window
   * @param {Array} [options.ipWhitelist=[]] - Array of allowed IP addresses/CIDR blocks
   * @param {string} [options.expiresAt] - Expiration date (ISO string)
   * @param {Object} [options.metadata={}] - Additional metadata
   * @returns {Promise<Object>} Created API key object with plainKey (one-time only)
   */
  async generateKey(name, systemId, userId, options = {}) {
    const key = uuidv4();
    const hashedKey = await bcrypt.hash(key, 10);

    const apiKeyData = {
      name,
      key: hashedKey,
      system_id: systemId,
      is_active: 1,
      rate_limit: options.rateLimit || 1000,
      ip_whitelist: options.ipWhitelist || [],
      created_by: userId,
      expires_at: options.expiresAt,
      metadata: options.metadata || {}
    };

    const created = this.create(apiKeyData);
    return { ...created, plainKey: key }; // Return plain key only once
  }

  /**
   * Verify an API key against stored hash
   * @param {string} key - Plain text API key to verify
   * @param {string} systemId - System ID associated with the key
   * @returns {Promise<boolean>} True if key is valid and not expired
   * @note Updates last_used_at timestamp on successful verification
   */
  async verifyKey(key, systemId) {
    const stmt = this.db.prepare(`
      SELECT id, key, system_id, is_active, expires_at
      FROM ${this.table}
      WHERE system_id = ? AND is_active = 1
    `);

    const apiKey = stmt.get(systemId);
    if (!apiKey) return false;

    // Check expiration
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return false;
    }

    const isValid = await bcrypt.compare(key, apiKey.key);
    if (isValid) {
      this.updateLastUsed(apiKey.id);
    }
    return isValid;
  }

  // Update last used timestamp
  updateLastUsed(id) {
    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    return stmt.run(id);
  }

  /**
   * Rotate an existing API key (generate new key, keep same metadata)
   * @param {number} id - API key ID to rotate
   * @param {number} userId - User ID performing the rotation (for audit)
   * @returns {Promise<string>} New plain text API key (one-time only)
   */
  async rotateKey(id, userId) {
    const key = uuidv4();
    const hashedKey = await bcrypt.hash(key, 10);

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET key = ?
      WHERE id = ?
    `);

    stmt.run(hashedKey, id);
    return key; // Return plain key only once
  }

  // Update API key
  update(id, apiKeyData) {
    const fields = [];
    const values = [];

    if (apiKeyData.name !== undefined) {
      fields.push('name = ?');
      values.push(apiKeyData.name);
    }
    if (apiKeyData.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(apiKeyData.is_active);
    }
    if (apiKeyData.rate_limit !== undefined) {
      fields.push('rate_limit = ?');
      values.push(apiKeyData.rate_limit);
    }
    if (apiKeyData.ip_whitelist !== undefined) {
      fields.push('ip_whitelist = ?');
      values.push(JSON.stringify(apiKeyData.ip_whitelist));
    }
    if (apiKeyData.expires_at !== undefined) {
      fields.push('expires_at = ?');
      values.push(apiKeyData.expires_at);
    }
    if (apiKeyData.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(apiKeyData.metadata));
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const query = `
      UPDATE ${this.table}
      SET ${fields.join(', ')}
      WHERE id = ?
    `;

    // Parameter count safety check
    const questionMarks = query.match(/\?/g);
    if (questionMarks && questionMarks.length !== values.length) {
      throw new Error(`Parameter count mismatch: ${questionMarks.length} placeholders, ${values.length} values`);
    }

    const stmt = this.db.prepare(query);
    stmt.run(...values);
    return this.findById(id);
  }

  // Soft delete API key
  delete(id) {
    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET is_active = 0
      WHERE id = ?
    `);

    return stmt.run(id);
  }

  // Check if system ID exists
  systemIdExists(systemId, excludeId = null) {
    let stmt;
    if (excludeId) {
      stmt = this.db.prepare('SELECT id FROM api_keys WHERE system_id = ? AND id != ?');
      return !!stmt.get(systemId, excludeId);
    } else {
      stmt = this.db.prepare('SELECT id FROM api_keys WHERE system_id = ?');
      return !!stmt.get(systemId);
    }
  }
}

module.exports = new ApiKey();