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

    // Validate ERP system type follows plan specification
    this._validateERPSystemType(connectionData.erp_system_type);

    // Validate connection configuration structure
    this._validateConnectionConfig(connectionData.connection_config);

    // Validate import settings structure
    this._validateImportSettings(connectionData.import_settings);

    // Validate JSON serialization won't fail
    try {
      JSON.stringify(connectionData.connection_config);
      JSON.stringify(connectionData.import_settings);
    } catch (error) {
      throw new Error('Connection config and import settings must be JSON serializable');
    }
  }

  /**
   * Validate ERP system type follows implementation plan specification
   * @param {string} systemType - ERP system type to validate
   * @throws {Error} If system type is invalid
   * @private
   */
  _validateERPSystemType(systemType) {
    const validTypes = [
      'sap_rest', 'sap_soap', 'oracle_erp', 'netsuite',
      'dynamics365', 'generic_rest', 'generic_soap',
      'csv_file', 'excel_file', 'custom'
    ];

    if (!validTypes.includes(systemType)) {
      throw new Error(`Invalid ERP system type. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  /**
   * Validate connection configuration structure following plan specification
   * @param {Object} config - Connection configuration to validate
   * @throws {Error} If configuration is invalid
   * @private
   */
  _validateConnectionConfig(config) {
    // Validate auth_type is required and valid
    if (!config.auth_type) {
      throw new Error('auth_type is required in connection config');
    }

    const validAuthTypes = ['api_key', 'oauth2', 'basic', 'bearer', 'custom'];
    if (!validAuthTypes.includes(config.auth_type)) {
      throw new Error(`Invalid auth_type. Must be one of: ${validAuthTypes.join(', ')}`);
    }

    // Validate auth_config is present
    if (!config.auth_config || typeof config.auth_config !== 'object') {
      throw new Error('auth_config object is required in connection config');
    }

    // Validate auth configuration based on auth_type
    this._validateAuthConfig(config.auth_type, config.auth_config);

    // Validate endpoints if provided
    if (config.endpoints && typeof config.endpoints !== 'object') {
      throw new Error('endpoints must be an object if provided');
    }

    // Validate base_url format if provided
    if (config.base_url && !this._isValidUrl(config.base_url)) {
      throw new Error('base_url must be a valid URL');
    }

    // Validate numeric settings
    if (config.rate_limit_per_minute !== undefined && (!Number.isInteger(config.rate_limit_per_minute) || config.rate_limit_per_minute < 1)) {
      throw new Error('rate_limit_per_minute must be a positive integer');
    }

    if (config.retry_attempts !== undefined && (!Number.isInteger(config.retry_attempts) || config.retry_attempts < 0)) {
      throw new Error('retry_attempts must be a non-negative integer');
    }

    if (config.timeout_seconds !== undefined && (!Number.isInteger(config.timeout_seconds) || config.timeout_seconds < 1)) {
      throw new Error('timeout_seconds must be a positive integer');
    }

    if (config.polling_interval_minutes !== undefined && (!Number.isInteger(config.polling_interval_minutes) || config.polling_interval_minutes < 1)) {
      throw new Error('polling_interval_minutes must be a positive integer');
    }
  }

  /**
   * Validate authentication configuration based on auth type
   * @param {string} authType - Authentication type
   * @param {Object} authConfig - Authentication configuration
   * @throws {Error} If auth config is invalid for the given type
   * @private
   */
  _validateAuthConfig(authType, authConfig) {
    switch (authType) {
      case 'api_key':
        if (!authConfig.api_key && !authConfig.api_key_header) {
          throw new Error('api_key or api_key_header is required for API key authentication');
        }
        if (authConfig.api_key && typeof authConfig.api_key !== 'string') {
          throw new Error('api_key must be a string');
        }
        if (authConfig.api_key_header && typeof authConfig.api_key_header !== 'string') {
          throw new Error('api_key_header must be a string');
        }
        break;

      case 'oauth2':
        if (!authConfig.client_id || !authConfig.client_secret) {
          throw new Error('client_id and client_secret are required for OAuth2 authentication');
        }
        if (typeof authConfig.client_id !== 'string' || typeof authConfig.client_secret !== 'string') {
          throw new Error('client_id and client_secret must be strings');
        }
        break;

      case 'basic':
        if (!authConfig.username || !authConfig.password) {
          throw new Error('username and password are required for basic authentication');
        }
        if (typeof authConfig.username !== 'string' || typeof authConfig.password !== 'string') {
          throw new Error('username and password must be strings');
        }
        break;

      case 'bearer':
        if (!authConfig.token) {
          throw new Error('token is required for bearer authentication');
        }
        if (typeof authConfig.token !== 'string') {
          throw new Error('token must be a string');
        }
        break;

      case 'custom':
        // Custom auth allows flexible configuration, just ensure it's an object
        break;

      default:
        throw new Error(`Unsupported auth_type: ${authType}`);
    }
  }

  /**
   * Validate import settings structure following plan specification
   * @param {Object} settings - Import settings to validate
   * @throws {Error} If settings are invalid
   * @private
   */
  _validateImportSettings(settings) {
    // Validate duplicate_handling
    if (!settings.duplicate_handling) {
      throw new Error('duplicate_handling is required in import settings');
    }

    const validDuplicateHandling = ['skip', 'update', 'create_new'];
    if (!validDuplicateHandling.includes(settings.duplicate_handling)) {
      throw new Error(`duplicate_handling must be one of: ${validDuplicateHandling.join(', ')}`);
    }

    // Validate update_existing_orders
    if (settings.update_existing_orders !== undefined && typeof settings.update_existing_orders !== 'boolean') {
      throw new Error('update_existing_orders must be a boolean');
    }

    // Validate required_fields if provided
    if (settings.required_fields && !Array.isArray(settings.required_fields)) {
      throw new Error('required_fields must be an array if provided');
    }

    // Validate field_validation_rules if provided
    if (settings.field_validation_rules && typeof settings.field_validation_rules !== 'object') {
      throw new Error('field_validation_rules must be an object if provided');
    }

    // Validate auto_generate_characteristics
    if (settings.auto_generate_characteristics !== undefined && typeof settings.auto_generate_characteristics !== 'boolean') {
      throw new Error('auto_generate_characteristics must be a boolean');
    }

    // Validate characteristic_detection_rules if provided
    if (settings.characteristic_detection_rules && !Array.isArray(settings.characteristic_detection_rules)) {
      throw new Error('characteristic_detection_rules must be an array if provided');
    }

    // Validate batch_size
    if (settings.batch_size !== undefined && (!Number.isInteger(settings.batch_size) || settings.batch_size < 1)) {
      throw new Error('batch_size must be a positive integer');
    }

    // Validate auto_import_enabled
    if (settings.auto_import_enabled !== undefined && typeof settings.auto_import_enabled !== 'boolean') {
      throw new Error('auto_import_enabled must be a boolean');
    }

    // Validate notification_email format if provided
    if (settings.notification_email && !this._isValidEmail(settings.notification_email)) {
      throw new Error('notification_email must be a valid email address');
    }
  }

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean} True if URL is valid
   * @private
   */
  _isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if email is valid
   * @private
   */
  _isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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

    if (filters.created_by) {
      whereConditions.push('ec.created_by = ?');
      params.push(filters.created_by);
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
   * Test connection validity with comprehensive validation
   * @param {number} id - Connection ID to test
   * @returns {Object} Test result with status and details
   */
  testConnection(id) {
    const connection = this.findById(id);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const testStartTime = Date.now();
    const testResult = {
      connection_id: id,
      tested_at: new Date().toISOString(),
      status: 'failed', // Default to failed, will be updated if successful
      message: '',
      details: {
        has_config: false,
        has_import_settings: false,
        is_active: connection.is_active,
        config_validation: { valid: false, errors: [] },
        auth_validation: { valid: false, errors: [] },
        import_settings_validation: { valid: false, errors: [] },
        response_time_ms: 0
      },
      warnings: [],
      suggestions: []
    };

    try {
      // Test 1: Configuration validation
      testResult.details.has_config = !!connection.connection_config && 
                                      Object.keys(connection.connection_config).length > 0;

      if (!testResult.details.has_config) {
        testResult.details.config_validation.errors.push('Connection configuration is empty or missing');
      } else {
        try {
          this._validateConnectionConfig(connection.connection_config);
          testResult.details.config_validation.valid = true;
        } catch (error) {
          testResult.details.config_validation.errors.push(error.message);
        }
      }

      // Test 2: Authentication validation
      try {
        this._validateAuthConfig(
          connection.connection_config.auth_type,
          connection.connection_config.auth_config
        );
        testResult.details.auth_validation.valid = true;
      } catch (error) {
        testResult.details.auth_validation.errors.push(error.message);
      }

      // Test 3: Import settings validation
      testResult.details.has_import_settings = !!connection.import_settings && 
                                                Object.keys(connection.import_settings).length > 0;

      if (!testResult.details.has_import_settings) {
        testResult.details.import_settings_validation.errors.push('Import settings are empty or missing');
      } else {
        try {
          this._validateImportSettings(connection.import_settings);
          testResult.details.import_settings_validation.valid = true;
        } catch (error) {
          testResult.details.import_settings_validation.errors.push(error.message);
        }
      }

      // Test 4: Comprehensive validation checks
      this._performConnectionHealthChecks(connection, testResult);

      // Calculate overall status
      const hasErrors = testResult.details.config_validation.errors.length > 0 ||
                       testResult.details.auth_validation.errors.length > 0 ||
                       testResult.details.import_settings_validation.errors.length > 0;

      if (!hasErrors) {
        testResult.status = 'success';
        testResult.message = 'Connection configuration is valid and ready for use';
      } else {
        testResult.status = 'failed';
        testResult.message = 'Connection configuration has validation errors';
      }

      // Add helpful suggestions
      this._addConnectionSuggestions(connection, testResult);

    } catch (error) {
      testResult.status = 'failed';
      testResult.message = `Connection test failed: ${error.message}`;
    }

    testResult.details.response_time_ms = Date.now() - testStartTime;
    return testResult;
  }

  /**
   * Perform additional health checks on connection configuration
   * @param {Object} connection - Connection object
   * @param {Object} testResult - Test result object to update
   * @private
   */
  _performConnectionHealthChecks(connection, testResult) {
    const config = connection.connection_config;
    const settings = connection.import_settings;

    // Check for potentially insecure configurations
    if (config.base_url && !config.base_url.startsWith('https://')) {
      testResult.warnings.push('Using HTTP instead of HTTPS may be insecure');
    }

    // Check for overly permissive settings
    if (config.timeout_seconds && config.timeout_seconds > 300) {
      testResult.warnings.push('Timeout is very high (>5 minutes), may cause performance issues');
    }

    if (settings.batch_size && settings.batch_size > 1000) {
      testResult.warnings.push('Large batch size may cause memory issues');
    }

    // Check for missing recommended settings
    if (!config.rate_limit_per_minute) {
      testResult.warnings.push('No rate limiting configured, may overwhelm ERP system');
    }

    if (!config.retry_attempts) {
      testResult.warnings.push('No retry attempts configured, may fail on temporary network issues');
    }

    // Check authentication security
    if (config.auth_type === 'basic' && config.auth_config.password) {
      testResult.warnings.push('Basic authentication stores passwords in plain text');
    }

    // Check for required endpoints based on ERP type
    if (connection.erp_system_type.includes('rest') && !config.endpoints?.orders_list) {
      testResult.warnings.push('No orders_list endpoint configured for REST connection');
    }
  }

  /**
   * Add helpful suggestions based on connection configuration
   * @param {Object} connection - Connection object
   * @param {Object} testResult - Test result object to update
   * @private
   */
  _addConnectionSuggestions(connection, testResult) {
    const config = connection.connection_config;
    const settings = connection.import_settings;

    // Suggest security improvements
    if (config.auth_type === 'api_key' && !config.auth_config.api_key_header) {
      testResult.suggestions.push('Consider specifying custom API key header for better security');
    }

    if (config.auth_type === 'basic') {
      testResult.suggestions.push('Consider upgrading to API key or OAuth2 for better security');
    }

    // Suggest performance improvements
    if (!settings.batch_size) {
      testResult.suggestions.push('Set batch_size to optimize import performance (recommended: 100-500)');
    }

    if (!config.polling_interval_minutes && !settings.auto_import_enabled) {
      testResult.suggestions.push('Enable auto_import or set polling_interval for automated synchronization');
    }

    // Suggest monitoring improvements
    if (!settings.notification_email) {
      testResult.suggestions.push('Set notification_email to receive alerts about import issues');
    }

    // ERP-specific suggestions
    if (connection.erp_system_type === 'sap_rest' && !config.endpoints?.order_detail) {
      testResult.suggestions.push('Configure order_detail endpoint for detailed SAP order information');
    }
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
      // Handle null values from SUM operations when no records exist
      stats.total_imports = importStats.total_imports || 0;
      stats.successful_imports = importStats.successful_imports || 0;
      stats.failed_imports = importStats.failed_imports || 0;
      stats.total_records_processed = importStats.total_records_processed || 0;
      stats.last_import_date = importStats.last_import_date;
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

  /**
   * Get connections created by a specific user
   * @param {number} userId - User ID
   * @param {Object} [filters={}] - Additional filters
   * @returns {Array} Array of connections
   */
  findByUser(userId, filters = {}) {
    const userFilter = { ...filters, created_by: userId };
    const { whereClause, params } = this._buildWhereClause(userFilter);

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
   * Get configuration template for specific ERP system type
   * @param {string} erpSystemType - ERP system type
   * @returns {Object} Configuration template with default values
   */
  getConfigurationTemplate(erpSystemType) {
    const templates = {
      sap_rest: {
        connection_config: {
          auth_type: 'basic',
          auth_config: {
            username: '',
            password: ''
          },
          base_url: 'https://your-sap-server.com',
          endpoints: {
            orders_list: '/api/production-orders',
            order_detail: '/api/production-orders/{id}',
            update_status: '/api/production-orders/{id}/status'
          },
          rate_limit_per_minute: 60,
          retry_attempts: 3,
          timeout_seconds: 30
        },
        import_settings: {
          duplicate_handling: 'skip',
          update_existing_orders: false,
          required_fields: ['order_number', 'part_number', 'quantity_to_make'],
          auto_generate_characteristics: true,
          batch_size: 100,
          auto_import_enabled: false
        }
      },
      sap_soap: {
        connection_config: {
          auth_type: 'basic',
          auth_config: {
            username: '',
            password: ''
          },
          base_url: 'https://your-sap-server.com',
          endpoints: {
            orders_list: '/soap/production-orders',
            order_detail: '/soap/production-orders/details'
          },
          timeout_seconds: 60
        },
        import_settings: {
          duplicate_handling: 'update',
          update_existing_orders: true,
          required_fields: ['order_number', 'part_number', 'quantity_to_make'],
          auto_generate_characteristics: true,
          batch_size: 50,
          auto_import_enabled: false
        }
      },
      generic_rest: {
        connection_config: {
          auth_type: 'api_key',
          auth_config: {
            api_key: '',
            api_key_header: 'X-API-Key'
          },
          base_url: 'https://api.your-erp.com',
          endpoints: {
            orders_list: '/api/orders'
          },
          rate_limit_per_minute: 100,
          retry_attempts: 3,
          timeout_seconds: 30
        },
        import_settings: {
          duplicate_handling: 'skip',
          update_existing_orders: false,
          required_fields: ['external_id', 'order_number'],
          auto_generate_characteristics: false,
          batch_size: 200,
          auto_import_enabled: false
        }
      },
      csv_file: {
        connection_config: {
          auth_type: 'custom',
          auth_config: {},
          file_settings: {
            watch_directory: '/path/to/csv/files',
            file_pattern: '.*\\.csv$',
            archive_directory: '/path/to/processed/files'
          }
        },
        import_settings: {
          duplicate_handling: 'create_new',
          update_existing_orders: false,
          required_fields: ['order_number', 'part_number', 'quantity_to_make'],
          auto_generate_characteristics: true,
          batch_size: 500,
          auto_import_enabled: true
        }
      }
    };

    return templates[erpSystemType] || {
      connection_config: {
        auth_type: 'api_key',
        auth_config: {},
        base_url: '',
        endpoints: {}
      },
      import_settings: {
        duplicate_handling: 'skip',
        update_existing_orders: false,
        required_fields: [],
        auto_generate_characteristics: false,
        batch_size: 100,
        auto_import_enabled: false
      }
    };
  }

  /**
   * Create connection configuration from template
   * @param {string} erpSystemType - ERP system type
   * @param {Object} customConfig - Custom configuration to merge
   * @returns {Object} Complete connection configuration
   */
  createFromTemplate(erpSystemType, customConfig = {}) {
    const template = this.getConfigurationTemplate(erpSystemType);
    
    // Deep merge custom config with template
    const mergedConfig = {
      ...template.connection_config,
      ...customConfig.connection_config,
      auth_config: {
        ...template.connection_config.auth_config,
        ...customConfig.connection_config?.auth_config
      },
      endpoints: {
        ...template.connection_config.endpoints,
        ...customConfig.connection_config?.endpoints
      }
    };

    const mergedSettings = {
      ...template.import_settings,
      ...customConfig.import_settings
    };

    return {
      connection_config: mergedConfig,
      import_settings: mergedSettings
    };
  }

  /**
   * Validate connection before save with enhanced security checks
   * @param {Object} connectionData - Connection data to validate
   * @returns {Object} Validation result with security recommendations
   */
  validateConnectionSecurity(connectionData) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      security_score: 100
    };

    try {
      // Run standard validation first
      this._validateConnectionData(connectionData);
    } catch (error) {
      result.valid = false;
      result.errors.push(error.message);
      result.security_score -= 30;
    }

    // Security-specific validations
    const config = connectionData.connection_config;

    // Check for insecure protocols
    if (config.base_url && !config.base_url.startsWith('https://')) {
      result.warnings.push('Using HTTP instead of HTTPS is not recommended for production');
      result.security_score -= 20;
    }

    // Check authentication strength
    if (config.auth_type === 'basic') {
      result.warnings.push('Basic authentication is less secure than API keys or OAuth2');
      result.security_score -= 15;
    }

    // Check for default/weak passwords (basic heuristics)
    if (config.auth_config?.password) {
      const password = config.auth_config.password;
      if (password.length < 8) {
        result.warnings.push('Password should be at least 8 characters long');
        result.security_score -= 10;
      }
      if (/^(password|123456|admin)$/i.test(password)) {
        result.warnings.push('Password appears to be a common/default value');
        result.security_score -= 25;
      }
    }

    // Check for overly permissive settings
    if (config.rate_limit_per_minute > 1000) {
      result.warnings.push('Very high rate limit may overwhelm the ERP system');
      result.security_score -= 5;
    }

    // Check for missing security features
    if (!config.retry_attempts || config.retry_attempts > 10) {
      result.warnings.push('Configure reasonable retry attempts (1-5) to prevent system abuse');
      result.security_score -= 5;
    }

    return result;
  }
}

module.exports = new ERPConnection();