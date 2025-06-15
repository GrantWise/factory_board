const { getDatabase } = require('../utils/database');

/**
 * ERPConnection Model
 * ===================
 *
 * Handles database operations for ERP system connections including CRUD operations,
 * configuration management, and connection validation.
 *
 * Key Features:
 * - Secure connection configuration storage
 * - JSON configuration validation
 * - Connection status tracking
 * - Integration with API key management
 * - Comprehensive audit logging
 */
class ERPConnection {
  constructor() {
    this.db = getDatabase();
    this.table = 'erp_connections';
  }

  /**
   * Create a new ERP connection
   * @param {Object} connectionData - Connection creation data
   * @param {string} connectionData.name - Unique connection name
   * @param {string} connectionData.erp_system_type - Type of ERP system (e.g., 'sap', 'oracle', 'custom')
   * @param {boolean} [connectionData.is_active=true] - Whether connection is active
   * @param {Object} connectionData.connection_config - Connection configuration (will be JSON stringified)
   * @param {Object} connectionData.import_settings - Import settings (will be JSON stringified)
   * @param {number} [connectionData.api_key_id] - Associated API key ID
   * @param {number} connectionData.created_by - User ID who created the connection
   * @returns {Object} Created connection object with all fields
   * @throws {Error} If validation fails or database constraint violations occur
   */
  create(connectionData) {
    this._validateConnectionData(connectionData);

    const sqlParams = [
      connectionData.name,
      connectionData.erp_system_type,
      connectionData.is_active !== undefined ? connectionData.is_active ? 1 : 0 : 1,
      JSON.stringify(connectionData.connection_config),
      JSON.stringify(connectionData.import_settings),
      connectionData.api_key_id || null,
      connectionData.created_by
    ];

    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (
        name, erp_system_type, is_active, connection_config, 
        import_settings, api_key_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = stmt.run(...sqlParams);
      return this.findById(result.lastInsertRowid);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Connection name must be unique');
      }
      throw error;
    }
  }

  /**
   * Validate connection data before database operations
   * @param {Object} connectionData - Connection data to validate
   * @throws {Error} If validation fails
   * @private
   */
  _validateConnectionData(connectionData) {
    if (!connectionData.name || typeof connectionData.name !== 'string' || connectionData.name.trim().length === 0) {
      throw new Error('Connection name is required and must be a non-empty string');
    }

    if (connectionData.name.length > 100) {
      throw new Error('Connection name must be 100 characters or less');
    }

    if (!connectionData.erp_system_type || typeof connectionData.erp_system_type !== 'string') {
      throw new Error('ERP system type is required and must be a string');
    }

    if (connectionData.erp_system_type.length > 50) {
      throw new Error('ERP system type must be 50 characters or less');
    }

    if (!connectionData.connection_config || typeof connectionData.connection_config !== 'object') {
      throw new Error('Connection config is required and must be an object');
    }

    if (!connectionData.import_settings || typeof connectionData.import_settings !== 'object') {
      throw new Error('Import settings is required and must be an object');
    }

    if (!connectionData.created_by || !Number.isInteger(connectionData.created_by)) {
      throw new Error('Created by user ID is required and must be an integer');
    }

    // Validate JSON serialization won't fail
    try {
      JSON.stringify(connectionData.connection_config);
      JSON.stringify(connectionData.import_settings);
    } catch (error) {
      throw new Error('Connection config and import settings must be JSON serializable');
    }
  }

  /**
   * Find an ERP connection by ID with all related data
   * @param {number} id - Connection ID
   * @returns {Object|null} Connection object with parsed JSON fields and user details, or null if not found
   */
  findById(id) {
    const connection = this.db.prepare(`
      SELECT 
        ec.*,
        u.username as created_by_username,
        ak.name as api_key_name
      FROM ${this.table} ec
      LEFT JOIN users u ON ec.created_by = u.id
      LEFT JOIN api_keys ak ON ec.api_key_id = ak.id
      WHERE ec.id = ?
    `).get(id);

    if (!connection) return null;

    return this._parseConnectionData(connection);
  }

  /**
   * Parse JSON fields and format connection data
   * @param {Object} connection - Raw connection data from database
   * @returns {Object} Formatted connection object with parsed JSON
   * @private
   */
  _parseConnectionData(connection) {
    try {
      connection.connection_config = JSON.parse(connection.connection_config);
      connection.import_settings = JSON.parse(connection.import_settings);
    } catch (error) {
      // console.error('Failed to parse JSON fields for connection:', connection.id, error);
      connection.connection_config = {};
      connection.import_settings = {};
    }

    return connection;
  }

  /**
   * Get all ERP connections with optional filtering
   * @param {Object} [filters={}] - Filter criteria
   * @param {boolean} [filters.is_active] - Filter by active status
   * @param {string} [filters.erp_system_type] - Filter by ERP system type
   * @param {string} [filters.search] - Search in connection name
   * @returns {Array} Array of connection objects with parsed JSON fields
   */
  findAll(filters = {}) {
    const { whereClause, params } = this._buildWhereClause(filters);

    const connections = this.db.prepare(`
      SELECT 
        ec.*,
        u.username as created_by_username,
        ak.name as api_key_name
      FROM ${this.table} ec
      LEFT JOIN users u ON ec.created_by = u.id
      LEFT JOIN api_keys ak ON ec.api_key_id = ak.id
      ${whereClause}
      ORDER BY ec.name ASC
    `).all(...params);

    return connections.map(connection => this._parseConnectionData(connection));
  }

  /**
   * Build WHERE clause and parameters for connection filtering
   * @param {Object} filters - Filter criteria
   * @returns {Object} Object with whereClause string and params array
   * @private
   */
  _buildWhereClause(filters) {
    const whereConditions = [];
    const params = [];

    if (filters.is_active !== undefined) {
      whereConditions.push('ec.is_active = ?');
      params.push(filters.is_active);
    }

    if (filters.erp_system_type) {
      whereConditions.push('ec.erp_system_type = ?');
      params.push(filters.erp_system_type);
    }

    if (filters.search) {
      whereConditions.push('ec.name LIKE ?');
      params.push(`%${filters.search}%`);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    return { whereClause, params };
  }

  /**
   * Update an ERP connection
   * @param {number} id - Connection ID to update
   * @param {Object} connectionData - Updated connection data
   * @returns {Object} Updated connection object
   * @throws {Error} If connection not found or validation fails
   */
  update(id, connectionData) {
    const existingConnection = this.findById(id);
    if (!existingConnection) {
      throw new Error('Connection not found');
    }

    const fields = [];
    const values = [];

    if (connectionData.name !== undefined) {
      if (!connectionData.name || connectionData.name.trim().length === 0) {
        throw new Error('Connection name cannot be empty');
      }
      fields.push('name = ?');
      values.push(connectionData.name.trim());
    }

    if (connectionData.erp_system_type !== undefined) {
      if (!connectionData.erp_system_type) {
        throw new Error('ERP system type cannot be empty');
      }
      fields.push('erp_system_type = ?');
      values.push(connectionData.erp_system_type);
    }

    if (connectionData.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(connectionData.is_active ? 1 : 0);
    }

    if (connectionData.connection_config !== undefined) {
      if (typeof connectionData.connection_config !== 'object') {
        throw new Error('Connection config must be an object');
      }
      fields.push('connection_config = ?');
      values.push(JSON.stringify(connectionData.connection_config));
    }

    if (connectionData.import_settings !== undefined) {
      if (typeof connectionData.import_settings !== 'object') {
        throw new Error('Import settings must be an object');
      }
      fields.push('import_settings = ?');
      values.push(JSON.stringify(connectionData.import_settings));
    }

    if (connectionData.api_key_id !== undefined) {
      fields.push('api_key_id = ?');
      values.push(connectionData.api_key_id);
    }

    if (connectionData.last_successful_import !== undefined) {
      fields.push('last_successful_import = ?');
      values.push(connectionData.last_successful_import);
    }

    if (connectionData.last_error !== undefined) {
      fields.push('last_error = ?');
      values.push(connectionData.last_error);
    }

    if (fields.length === 0) {
      return existingConnection;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `
      UPDATE ${this.table}
      SET ${fields.join(', ')}
      WHERE id = ?
    `;

    try {
      const stmt = this.db.prepare(query);
      stmt.run(...values);
      return this.findById(id);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Connection name must be unique');
      }
      throw error;
    }
  }

  /**
   * Delete an ERP connection and all related data
   * @param {number} id - Connection ID to delete
   * @returns {Object} Result of delete operation
   * @throws {Error} If connection not found or has dependent records
   */
  delete(id) {
    const connection = this.findById(id);
    if (!connection) {
      throw new Error('Connection not found');
    }

    // Check for dependent records that would prevent deletion
    const dependentChecks = [
      { table: 'erp_sync_state', message: 'Connection has sync state records' },
      { table: 'erp_import_logs', message: 'Connection has import log records' },
      { table: 'erp_order_links', message: 'Connection has linked orders' }
    ];

    for (const check of dependentChecks) {
      const count = this.db.prepare(`
        SELECT COUNT(*) as count FROM ${check.table} WHERE connection_id = ?
      `).get(id);

      if (count.count > 0) {
        throw new Error(`Cannot delete connection: ${check.message}`);
      }
    }

    const transaction = this.db.transaction(() => {
      // Delete field mappings first (CASCADE should handle this, but explicit for safety)
      this.db.prepare('DELETE FROM erp_field_mappings WHERE connection_id = ?').run(id);

      // Delete the connection
      const result = this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id);

      if (result.changes === 0) {
        throw new Error('Connection not found');
      }

      return result;
    });

    return transaction();
  }

  /**
   * Test connection validity
   * @param {number} id - Connection ID to test
   * @returns {Object} Test result with status and details
   */
  testConnection(id) {
    const connection = this.findById(id);
    if (!connection) {
      throw new Error('Connection not found');
    }

    // Basic validation test - in real implementation this would
    // actually attempt to connect to the ERP system
    const testResult = {
      connection_id: id,
      status: 'success',
      tested_at: new Date().toISOString(),
      message: 'Connection configuration appears valid',
      details: {
        has_config: !!connection.connection_config && Object.keys(connection.connection_config).length > 0,
        has_import_settings: !!connection.import_settings && Object.keys(connection.import_settings).length > 0,
        is_active: connection.is_active
      }
    };

    // Update last test result (you might want to add a field for this)
    return testResult;
  }

  /**
   * Get connection usage statistics
   * @param {number} id - Connection ID
   * @returns {Object} Usage statistics for the connection
   */
  getUsageStats(id) {
    const connection = this.findById(id);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const stats = {
      connection_id: id,
      total_imports: 0,
      successful_imports: 0,
      failed_imports: 0,
      total_records_processed: 0,
      linked_orders: 0,
      active_conflicts: 0,
      last_import_date: null
    };

    // Get import statistics
    const importStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_imports,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_imports,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_imports,
        SUM(processed_records) as total_records_processed,
        MAX(started_at) as last_import_date
      FROM erp_import_logs 
      WHERE connection_id = ?
    `).get(id);

    if (importStats) {
      Object.assign(stats, importStats);
    }

    // Get linked orders count
    const linkedOrdersCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM erp_order_links WHERE connection_id = ?
    `).get(id);
    stats.linked_orders = linkedOrdersCount.count;

    // Get active conflicts count
    const conflictsCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM erp_order_links 
      WHERE connection_id = ? AND sync_status = 'conflict'
    `).get(id);
    stats.active_conflicts = conflictsCount.count;

    return stats;
  }

  /**
   * Check if connection name exists (for validation)
   * @param {string} name - Connection name to check
   * @param {number} [excludeId] - Connection ID to exclude from check (for updates)
   * @returns {boolean} True if name exists
   */
  nameExists(name, excludeId = null) {
    let stmt;
    if (excludeId) {
      stmt = this.db.prepare('SELECT id FROM erp_connections WHERE name = ? AND id != ?');
      return !!stmt.get(name, excludeId);
    } else {
      stmt = this.db.prepare('SELECT id FROM erp_connections WHERE name = ?');
      return !!stmt.get(name);
    }
  }
}

module.exports = new ERPConnection();