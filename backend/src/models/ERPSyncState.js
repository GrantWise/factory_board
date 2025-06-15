const { getDatabase } = require('../utils/database');

/**
 * ERPSyncState Model
 * ==================
 *
 * Handles database operations for ERP synchronization state management.
 * Tracks incremental sync progress, handles sync failures, and manages sync strategies.
 *
 * Key Features:
 * - Incremental sync state tracking
 * - Multiple sync strategy support (timestamp, cursor, incremental_id)
 * - Failure tracking and recovery management
 * - Flexible metadata storage for sync context
 * - Full sync requirement detection
 */
class ERPSyncState {
  constructor() {
    this.db = getDatabase();
    this.table = 'erp_sync_state';
  }

  /**
   * Create or initialize sync state for a connection
   * @param {Object} syncData - Sync state creation data
   * @param {number} syncData.connection_id - ERP connection ID
   * @param {string} [syncData.sync_strategy='timestamp'] - Sync strategy type
   * @param {Object} [syncData.sync_metadata={}] - Additional sync context
   * @returns {Object} Created sync state object
   * @throws {Error} If connection already has sync state or validation fails
   */
  create(syncData) {
    this._validateSyncData(syncData);

    const sqlParams = [
      syncData.connection_id,
      syncData.sync_strategy || 'timestamp',
      JSON.stringify(syncData.sync_metadata || {})
    ];

    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (
        connection_id, sync_strategy, sync_metadata
      ) VALUES (?, ?, ?)
    `);

    try {
      stmt.run(...sqlParams);
      return this.findByConnectionId(syncData.connection_id);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Sync state already exists for this connection');
      }
      throw error;
    }
  }

  /**
   * Validate sync state data
   * @param {Object} syncData - Sync data to validate
   * @throws {Error} If validation fails
   * @private
   */
  _validateSyncData(syncData) {
    if (!syncData.connection_id || !Number.isInteger(syncData.connection_id)) {
      throw new Error('Connection ID is required and must be an integer');
    }

    if (syncData.sync_strategy && !['timestamp', 'cursor', 'incremental_id'].includes(syncData.sync_strategy)) {
      throw new Error('Sync strategy must be one of: timestamp, cursor, incremental_id');
    }

    if (syncData.sync_metadata && typeof syncData.sync_metadata !== 'object') {
      throw new Error('Sync metadata must be an object');
    }
  }

  /**
   * Find sync state by connection ID
   * @param {number} connectionId - ERP connection ID
   * @returns {Object|null} Sync state object with parsed metadata, or null if not found
   */
  findByConnectionId(connectionId) {
    const syncState = this.db.prepare(`
      SELECT 
        ss.*,
        ec.name as connection_name,
        ec.erp_system_type
      FROM ${this.table} ss
      LEFT JOIN erp_connections ec ON ss.connection_id = ec.id
      WHERE ss.connection_id = ?
    `).get(connectionId);

    if (!syncState) return null;

    return this._parseSyncStateData(syncState);
  }

  /**
   * Find sync state by ID
   * @param {number} id - Sync state ID
   * @returns {Object|null} Sync state object with parsed metadata, or null if not found
   */
  findById(id) {
    const syncState = this.db.prepare(`
      SELECT 
        ss.*,
        ec.name as connection_name,
        ec.erp_system_type
      FROM ${this.table} ss
      LEFT JOIN erp_connections ec ON ss.connection_id = ec.id
      WHERE ss.id = ?
    `).get(id);

    if (!syncState) return null;

    return this._parseSyncStateData(syncState);
  }

  /**
   * Parse JSON metadata field
   * @param {Object} syncState - Raw sync state data from database
   * @returns {Object} Formatted sync state object with parsed metadata
   * @private
   */
  _parseSyncStateData(syncState) {
    try {
      syncState.sync_metadata = JSON.parse(syncState.sync_metadata || '{}');
    } catch (error) {
      // console.error('Failed to parse sync metadata for connection:', syncState.connection_id, error);
      syncState.sync_metadata = {};
    }

    return syncState;
  }

  /**
   * Get all sync states with filtering
   * @param {Object} [filters={}] - Filter criteria
   * @param {boolean} [filters.full_sync_required] - Filter by full sync requirement
   * @param {boolean} [filters.has_failures] - Filter by failure status
   * @param {string} [filters.sync_strategy] - Filter by sync strategy
   * @returns {Array} Array of sync state objects
   */
  findAll(filters = {}) {
    const { whereClause, params } = this._buildWhereClause(filters);

    const syncStates = this.db.prepare(`
      SELECT 
        ss.*,
        ec.name as connection_name,
        ec.erp_system_type
      FROM ${this.table} ss
      LEFT JOIN erp_connections ec ON ss.connection_id = ec.id
      ${whereClause}
      ORDER BY ss.updated_at DESC
    `).all(...params);

    return syncStates.map(syncState => this._parseSyncStateData(syncState));
  }

  /**
   * Build WHERE clause for filtering
   * @param {Object} filters - Filter criteria
   * @returns {Object} Object with whereClause string and params array
   * @private
   */
  _buildWhereClause(filters) {
    const whereConditions = [];
    const params = [];

    if (filters.full_sync_required !== undefined) {
      whereConditions.push('ss.is_full_sync_required = ?');
      params.push(filters.full_sync_required);
    }

    if (filters.has_failures !== undefined) {
      if (filters.has_failures) {
        whereConditions.push('ss.consecutive_failures > 0');
      } else {
        whereConditions.push('ss.consecutive_failures = 0');
      }
    }

    if (filters.sync_strategy) {
      whereConditions.push('ss.sync_strategy = ?');
      params.push(filters.sync_strategy);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    return { whereClause, params };
  }

  /**
   * Update sync state after successful sync
   * @param {number} connectionId - Connection ID
   * @param {Object} syncResult - Sync operation result
   * @param {string} [syncResult.last_erp_timestamp] - Last timestamp from ERP system
   * @param {string} [syncResult.sync_cursor] - Cursor for pagination-based sync
   * @param {Object} [syncResult.sync_metadata] - Additional sync context
   * @returns {Object} Updated sync state object
   */
  updateAfterSuccessfulSync(connectionId, syncResult) {
    const currentState = this.findByConnectionId(connectionId);
    if (!currentState) {
      throw new Error('Sync state not found for connection');
    }

    const now = new Date().toISOString();
    const fields = [
      'last_sync_timestamp = ?',
      'last_successful_sync = ?',
      'consecutive_failures = 0',
      'is_full_sync_required = 0',
      'updated_at = CURRENT_TIMESTAMP'
    ];
    const values = [now, now];

    if (syncResult.last_erp_timestamp) {
      fields.push('last_erp_timestamp = ?');
      values.push(syncResult.last_erp_timestamp);
    }

    if (syncResult.sync_cursor) {
      fields.push('sync_cursor = ?');
      values.push(syncResult.sync_cursor);
    }

    if (syncResult.sync_metadata) {
      fields.push('sync_metadata = ?');
      values.push(JSON.stringify({
        ...currentState.sync_metadata,
        ...syncResult.sync_metadata
      }));
    }

    values.push(connectionId);

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET ${fields.join(', ')}
      WHERE connection_id = ?
    `);

    stmt.run(...values);
    return this.findByConnectionId(connectionId);
  }

  /**
   * Update sync state after failed sync
   * @param {number} connectionId - Connection ID
   * @param {string} errorMessage - Error message from failed sync
   * @param {number} [maxFailures=5] - Maximum consecutive failures before requiring full sync
   * @returns {Object} Updated sync state object
   */
  updateAfterFailedSync(connectionId, errorMessage, maxFailures = 5) {
    const currentState = this.findByConnectionId(connectionId);
    if (!currentState) {
      throw new Error('Sync state not found for connection');
    }

    const newFailureCount = (currentState.consecutive_failures || 0) + 1;
    const requireFullSync = newFailureCount >= maxFailures;

    const updatedMetadata = {
      ...currentState.sync_metadata,
      last_error: errorMessage,
      last_error_timestamp: new Date().toISOString(),
      failure_count: newFailureCount
    };

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET 
        last_sync_timestamp = CURRENT_TIMESTAMP,
        consecutive_failures = ?,
        is_full_sync_required = ?,
        sync_metadata = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE connection_id = ?
    `);

    stmt.run(newFailureCount, requireFullSync ? 1 : 0, JSON.stringify(updatedMetadata), connectionId);
    return this.findByConnectionId(connectionId);
  }

  /**
   * Mark connection as requiring full sync
   * @param {number} connectionId - Connection ID
   * @param {string} [reason] - Reason for requiring full sync
   * @returns {Object} Updated sync state object
   */
  requireFullSync(connectionId, reason = 'Manual request') {
    const currentState = this.findByConnectionId(connectionId);
    if (!currentState) {
      throw new Error('Sync state not found for connection');
    }

    const updatedMetadata = {
      ...currentState.sync_metadata,
      full_sync_reason: reason,
      full_sync_requested_at: new Date().toISOString()
    };

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET 
        is_full_sync_required = 1,
        sync_metadata = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE connection_id = ?
    `);

    stmt.run(JSON.stringify(updatedMetadata), connectionId);
    return this.findByConnectionId(connectionId);
  }

  /**
   * Reset sync state (clear timestamps and cursors)
   * @param {number} connectionId - Connection ID
   * @returns {Object} Reset sync state object
   */
  resetSyncState(connectionId) {
    const currentState = this.findByConnectionId(connectionId);
    if (!currentState) {
      throw new Error('Sync state not found for connection');
    }

    const resetMetadata = {
      ...currentState.sync_metadata,
      reset_at: new Date().toISOString(),
      reset_reason: 'Manual reset'
    };

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET 
        last_sync_timestamp = NULL,
        last_successful_sync = NULL,
        last_erp_timestamp = NULL,
        sync_cursor = NULL,
        consecutive_failures = 0,
        is_full_sync_required = 1,
        sync_metadata = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE connection_id = ?
    `);

    stmt.run(JSON.stringify(resetMetadata), connectionId);
    return this.findByConnectionId(connectionId);
  }

  /**
   * Get sync statistics for a connection
   * @param {number} connectionId - Connection ID
   * @returns {Object} Sync statistics and health metrics
   */
  getSyncStats(connectionId) {
    const syncState = this.findByConnectionId(connectionId);
    if (!syncState) {
      throw new Error('Sync state not found for connection');
    }

    const now = new Date();
    const lastSync = syncState.last_successful_sync ? new Date(syncState.last_successful_sync) : null;
    const hoursSinceLastSync = lastSync ? Math.floor((now - lastSync) / (1000 * 60 * 60)) : null;

    // Get recent import success rate
    const recentImports = this.db.prepare(`
      SELECT status, COUNT(*) as count
      FROM erp_import_logs 
      WHERE connection_id = ? 
        AND started_at > datetime('now', '-7 days')
      GROUP BY status
    `).all(connectionId);

    const importStats = recentImports.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});

    const totalRecentImports = Object.values(importStats).reduce((sum, count) => sum + count, 0);
    const successRate = totalRecentImports > 0 ?
      ((importStats.completed || 0) / totalRecentImports * 100).toFixed(1) : null;

    return {
      connection_id: connectionId,
      connection_name: syncState.connection_name,
      sync_strategy: syncState.sync_strategy,
      last_successful_sync: syncState.last_successful_sync,
      hours_since_last_sync: hoursSinceLastSync,
      consecutive_failures: syncState.consecutive_failures,
      is_full_sync_required: !!syncState.is_full_sync_required,
      sync_health: this._calculateSyncHealth(syncState, hoursSinceLastSync),
      recent_imports: importStats,
      success_rate_7d: successRate,
      has_cursor: !!syncState.sync_cursor,
      has_erp_timestamp: !!syncState.last_erp_timestamp
    };
  }

  /**
   * Calculate sync health status based on various factors
   * @param {Object} syncState - Current sync state
   * @param {number} hoursSinceLastSync - Hours since last successful sync
   * @returns {string} Health status: 'healthy', 'warning', 'critical', 'unknown'
   * @private
   */
  _calculateSyncHealth(syncState, hoursSinceLastSync) {
    if (!syncState.last_successful_sync) return 'unknown';

    if (syncState.consecutive_failures >= 5) return 'critical';
    if (syncState.consecutive_failures >= 3) return 'warning';
    if (hoursSinceLastSync > 48) return 'warning';
    if (hoursSinceLastSync > 72) return 'critical';

    return 'healthy';
  }

  /**
   * Delete sync state for a connection
   * @param {number} connectionId - Connection ID
   * @returns {Object} Result of delete operation
   */
  delete(connectionId) {
    const syncState = this.findByConnectionId(connectionId);
    if (!syncState) {
      throw new Error('Sync state not found for connection');
    }

    const result = this.db.prepare(`DELETE FROM ${this.table} WHERE connection_id = ?`).run(connectionId);
    return result;
  }

  /**
   * Get all connections that need sync attention
   * @returns {Array} Array of sync states requiring attention
   */
  getNeedingAttention() {
    return this.db.prepare(`
      SELECT 
        ss.*,
        ec.name as connection_name,
        ec.erp_system_type
      FROM ${this.table} ss
      LEFT JOIN erp_connections ec ON ss.connection_id = ec.id
      WHERE 
        ss.is_full_sync_required = 1 
        OR ss.consecutive_failures >= 3
        OR (ss.last_successful_sync IS NOT NULL AND ss.last_successful_sync < datetime('now', '-48 hours'))
        OR ss.last_successful_sync IS NULL
      ORDER BY 
        ss.consecutive_failures DESC,
        ss.last_successful_sync ASC
    `).all().map(syncState => this._parseSyncStateData(syncState));
  }
}

module.exports = new ERPSyncState();