const { getDatabase } = require('../utils/database');

/**
 * ERPOrderLink Model
 * ==================
 *
 * Handles database operations for linking manufacturing orders to external ERP systems.
 * Manages sync status, conflict detection, and external order tracking.
 *
 * Key Features:
 * - External order ID tracking and validation
 * - Sync status management with conflict detection
 * - Integration with manufacturing orders and ERP connections
 * - Conflict resolution data storage
 * - Comprehensive audit trails for sync operations
 */
class ERPOrderLink {
  constructor() {
    this.db = getDatabase();
    this.table = 'erp_order_links';
  }

  /**
   * Create a new ERP order link
   * @param {Object} linkData - Order link creation data
   * @param {number} linkData.order_id - Manufacturing order ID
   * @param {number} linkData.connection_id - ERP connection ID
   * @param {string} linkData.external_id - External system order ID
   * @param {string} linkData.external_system - External system name/type
   * @param {string} [linkData.external_updated_at] - Last update timestamp from external system
   * @param {string} [linkData.sync_status='synced'] - Initial sync status
   * @param {Object} [linkData.conflict_data] - Conflict resolution data
   * @returns {Object} Created order link object
   * @throws {Error} If validation fails or duplicate external ID exists
   */
  create(linkData) {
    this._validateLinkData(linkData);

    const sqlParams = [
      linkData.order_id,
      linkData.connection_id,
      linkData.external_id,
      linkData.external_system,
      linkData.external_updated_at || null,
      linkData.sync_status || 'synced',
      linkData.conflict_data ? JSON.stringify(linkData.conflict_data) : null
    ];

    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (
        order_id, connection_id, external_id, external_system,
        external_updated_at, sync_status, conflict_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = stmt.run(...sqlParams);
      return this.findById(result.lastInsertRowid);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('External ID already exists for this connection');
      }
      throw error;
    }
  }

  /**
   * Validate order link data
   * @param {Object} linkData - Link data to validate
   * @throws {Error} If validation fails
   * @private
   */
  _validateLinkData(linkData) {
    if (!linkData.order_id || !Number.isInteger(linkData.order_id)) {
      throw new Error('Order ID is required and must be an integer');
    }

    if (!linkData.connection_id || !Number.isInteger(linkData.connection_id)) {
      throw new Error('Connection ID is required and must be an integer');
    }

    if (!linkData.external_id || typeof linkData.external_id !== 'string' || linkData.external_id.trim().length === 0) {
      throw new Error('External ID is required and must be a non-empty string');
    }

    if (linkData.external_id.length > 255) {
      throw new Error('External ID must be 255 characters or less');
    }

    if (!linkData.external_system || typeof linkData.external_system !== 'string' || linkData.external_system.trim().length === 0) {
      throw new Error('External system is required and must be a non-empty string');
    }

    if (linkData.external_system.length > 100) {
      throw new Error('External system must be 100 characters or less');
    }

    const validSyncStatuses = ['synced', 'pending', 'conflict', 'error'];
    if (linkData.sync_status && !validSyncStatuses.includes(linkData.sync_status)) {
      throw new Error(`Sync status must be one of: ${validSyncStatuses.join(', ')}`);
    }

    if (linkData.conflict_data && typeof linkData.conflict_data !== 'object') {
      throw new Error('Conflict data must be an object');
    }
  }

  /**
   * Find order link by ID with all related data
   * @param {number} id - Order link ID
   * @returns {Object|null} Order link object with order and connection details, or null if not found
   */
  findById(id) {
    const orderLink = this.db.prepare(`
      SELECT 
        ol.*,
        mo.order_number,
        mo.stock_code,
        mo.description as order_description,
        mo.status as order_status,
        ec.name as connection_name,
        ec.erp_system_type
      FROM ${this.table} ol
      LEFT JOIN manufacturing_orders mo ON ol.order_id = mo.id
      LEFT JOIN erp_connections ec ON ol.connection_id = ec.id
      WHERE ol.id = ?
    `).get(id);

    if (!orderLink) return null;

    return this._parseOrderLinkData(orderLink);
  }

  /**
   * Find order link by external ID and connection
   * @param {string} externalId - External system order ID
   * @param {number} connectionId - ERP connection ID
   * @returns {Object|null} Order link object, or null if not found
   */
  findByExternalId(externalId, connectionId) {
    const orderLink = this.db.prepare(`
      SELECT 
        ol.*,
        mo.order_number,
        mo.stock_code,
        mo.description as order_description,
        mo.status as order_status,
        ec.name as connection_name,
        ec.erp_system_type
      FROM ${this.table} ol
      LEFT JOIN manufacturing_orders mo ON ol.order_id = mo.id
      LEFT JOIN erp_connections ec ON ol.connection_id = ec.id
      WHERE ol.external_id = ? AND ol.connection_id = ?
    `).get(externalId, connectionId);

    if (!orderLink) return null;

    return this._parseOrderLinkData(orderLink);
  }

  /**
   * Find order links by manufacturing order ID
   * @param {number} orderId - Manufacturing order ID
   * @returns {Array} Array of order link objects for the order
   */
  findByOrderId(orderId) {
    const orderLinks = this.db.prepare(`
      SELECT 
        ol.*,
        mo.order_number,
        mo.stock_code,
        mo.description as order_description,
        mo.status as order_status,
        ec.name as connection_name,
        ec.erp_system_type
      FROM ${this.table} ol
      LEFT JOIN manufacturing_orders mo ON ol.order_id = mo.id
      LEFT JOIN erp_connections ec ON ol.connection_id = ec.id
      WHERE ol.order_id = ?
      ORDER BY ol.created_at DESC
    `).all(orderId);

    return orderLinks.map(link => this._parseOrderLinkData(link));
  }

  /**
   * Parse JSON conflict data field
   * @param {Object} orderLink - Raw order link data from database
   * @returns {Object} Formatted order link object with parsed conflict data
   * @private
   */
  _parseOrderLinkData(orderLink) {
    try {
      orderLink.conflict_data = orderLink.conflict_data ? JSON.parse(orderLink.conflict_data) : null;
    } catch (error) {
      // console.error('Failed to parse conflict data for order link:', orderLink.id, error);
      orderLink.conflict_data = null;
    }

    return orderLink;
  }

  /**
   * Get all order links with filtering
   * @param {Object} [filters={}] - Filter criteria
   * @param {number} [filters.connection_id] - Filter by connection ID
   * @param {string} [filters.sync_status] - Filter by sync status
   * @param {string} [filters.external_system] - Filter by external system
   * @param {boolean} [filters.has_conflicts] - Filter by conflict presence
   * @param {number} [filters.limit=50] - Maximum number of results
   * @param {number} [filters.offset=0] - Results offset for pagination
   * @returns {Array} Array of order link objects
   */
  findAll(filters = {}) {
    const { whereClause, params } = this._buildWhereClause(filters);
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const orderLinks = this.db.prepare(`
      SELECT 
        ol.*,
        mo.order_number,
        mo.stock_code,
        mo.description as order_description,
        mo.status as order_status,
        ec.name as connection_name,
        ec.erp_system_type
      FROM ${this.table} ol
      LEFT JOIN manufacturing_orders mo ON ol.order_id = mo.id
      LEFT JOIN erp_connections ec ON ol.connection_id = ec.id
      ${whereClause}
      ORDER BY ol.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return orderLinks.map(link => this._parseOrderLinkData(link));
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

    if (filters.connection_id) {
      whereConditions.push('ol.connection_id = ?');
      params.push(filters.connection_id);
    }

    if (filters.sync_status) {
      whereConditions.push('ol.sync_status = ?');
      params.push(filters.sync_status);
    }

    if (filters.external_system) {
      whereConditions.push('ol.external_system = ?');
      params.push(filters.external_system);
    }

    if (filters.has_conflicts !== undefined) {
      if (filters.has_conflicts) {
        whereConditions.push('ol.sync_status = ?');
        params.push('conflict');
      } else {
        whereConditions.push('ol.sync_status != ?');
        params.push('conflict');
      }
    }

    if (filters.needs_sync) {
      whereConditions.push('ol.sync_status IN (?, ?)');
      params.push('pending', 'error');
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    return { whereClause, params };
  }

  /**
   * Update order link sync status
   * @param {number} id - Order link ID
   * @param {string} syncStatus - New sync status
   * @param {Object} [updateData={}] - Additional update data
   * @param {string} [updateData.external_updated_at] - External system update timestamp
   * @param {Object} [updateData.conflict_data] - Conflict resolution data
   * @returns {Object} Updated order link object
   */
  updateSyncStatus(id, syncStatus, updateData = {}) {
    const orderLink = this.findById(id);
    if (!orderLink) {
      throw new Error('Order link not found');
    }

    const validSyncStatuses = ['synced', 'pending', 'conflict', 'error'];
    if (!validSyncStatuses.includes(syncStatus)) {
      throw new Error(`Sync status must be one of: ${validSyncStatuses.join(', ')}`);
    }

    const fields = ['sync_status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [syncStatus];

    if (updateData.external_updated_at) {
      fields.push('external_updated_at = ?');
      values.push(updateData.external_updated_at);
    }

    if (updateData.conflict_data !== undefined) {
      fields.push('conflict_data = ?');
      values.push(updateData.conflict_data ? JSON.stringify(updateData.conflict_data) : null);
    }

    // Always update last_sync_at when status changes
    fields.push('last_sync_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  /**
   * Mark order link as having a conflict
   * @param {number} id - Order link ID
   * @param {Object} conflictData - Conflict details
   * @param {string} conflictData.conflict_type - Type of conflict detected
   * @param {Object} conflictData.local_data - Local system data
   * @param {Object} conflictData.external_data - External system data
   * @param {string} [conflictData.detected_at] - When conflict was detected
   * @returns {Object} Updated order link object
   */
  markAsConflict(id, conflictData) {
    if (!conflictData.conflict_type) {
      throw new Error('Conflict type is required');
    }

    const fullConflictData = {
      ...conflictData,
      detected_at: conflictData.detected_at || new Date().toISOString(),
      status: 'unresolved'
    };

    return this.updateSyncStatus(id, 'conflict', {
      conflict_data: fullConflictData
    });
  }

  /**
   * Resolve a conflict for an order link
   * @param {number} id - Order link ID
   * @param {Object} resolutionData - Conflict resolution data
   * @param {string} resolutionData.resolution_strategy - How the conflict was resolved
   * @param {Object} resolutionData.resolved_data - Final resolved data
   * @param {number} resolutionData.resolved_by - User ID who resolved the conflict
   * @returns {Object} Updated order link object
   */
  resolveConflict(id, resolutionData) {
    const orderLink = this.findById(id);
    if (!orderLink) {
      throw new Error('Order link not found');
    }

    if (orderLink.sync_status !== 'conflict') {
      throw new Error('Order link is not in conflict status');
    }

    const updatedConflictData = {
      ...orderLink.conflict_data,
      resolution_strategy: resolutionData.resolution_strategy,
      resolved_data: resolutionData.resolved_data,
      resolved_by: resolutionData.resolved_by,
      resolved_at: new Date().toISOString(),
      status: 'resolved'
    };

    return this.updateSyncStatus(id, 'synced', {
      conflict_data: updatedConflictData
    });
  }

  /**
   * Update external timestamp after successful sync
   * @param {number} id - Order link ID
   * @param {string} externalUpdatedAt - External system timestamp
   * @returns {Object} Updated order link object
   */
  updateExternalTimestamp(id, externalUpdatedAt) {
    return this.updateSyncStatus(id, 'synced', {
      external_updated_at: externalUpdatedAt
    });
  }

  /**
   * Get order links that need synchronization
   * @param {number} [connectionId] - Optional connection ID filter
   * @param {number} [limit=100] - Maximum number of results
   * @returns {Array} Array of order links requiring sync
   */
  getNeedingSync(connectionId = null, limit = 100) {
    const whereCondition = connectionId ?
      'WHERE ol.connection_id = ? AND ol.sync_status IN (?, ?)' :
      'WHERE ol.sync_status IN (?, ?)';

    const params = connectionId ?
      [connectionId, 'pending', 'error', limit] :
      ['pending', 'error', limit];

    const orderLinks = this.db.prepare(`
      SELECT 
        ol.*,
        mo.order_number,
        mo.stock_code,
        mo.description as order_description,
        mo.status as order_status,
        ec.name as connection_name,
        ec.erp_system_type
      FROM ${this.table} ol
      LEFT JOIN manufacturing_orders mo ON ol.order_id = mo.id
      LEFT JOIN erp_connections ec ON ol.connection_id = ec.id
      ${whereCondition}
      ORDER BY ol.updated_at ASC
      LIMIT ?
    `).all(...params);

    return orderLinks.map(link => this._parseOrderLinkData(link));
  }

  /**
   * Get order links with conflicts
   * @param {number} [connectionId] - Optional connection ID filter
   * @returns {Array} Array of order links with unresolved conflicts
   */
  getConflicts(connectionId = null) {
    const whereCondition = connectionId ?
      'WHERE ol.connection_id = ? AND ol.sync_status = ?' :
      'WHERE ol.sync_status = ?';

    const params = connectionId ? [connectionId, 'conflict'] : ['conflict'];

    const orderLinks = this.db.prepare(`
      SELECT 
        ol.*,
        mo.order_number,
        mo.stock_code,
        mo.description as order_description,
        mo.status as order_status,
        ec.name as connection_name,
        ec.erp_system_type
      FROM ${this.table} ol
      LEFT JOIN manufacturing_orders mo ON ol.order_id = mo.id
      LEFT JOIN erp_connections ec ON ol.connection_id = ec.id
      ${whereCondition}
      ORDER BY ol.updated_at DESC
    `).all(...params);

    return orderLinks.map(link => this._parseOrderLinkData(link));
  }

  /**
   * Get sync statistics for a connection
   * @param {number} connectionId - Connection ID
   * @returns {Object} Sync statistics summary
   */
  getSyncStats(connectionId) {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_links,
        SUM(CASE WHEN sync_status = 'synced' THEN 1 ELSE 0 END) as synced_count,
        SUM(CASE WHEN sync_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN sync_status = 'conflict' THEN 1 ELSE 0 END) as conflict_count,
        SUM(CASE WHEN sync_status = 'error' THEN 1 ELSE 0 END) as error_count,
        MAX(last_sync_at) as last_sync_at
      FROM ${this.table}
      WHERE connection_id = ?
    `).get(connectionId);

    const syncRate = stats.total_links > 0 ?
      (stats.synced_count / stats.total_links * 100).toFixed(1) : 0;

    return {
      ...stats,
      sync_rate_percent: parseFloat(syncRate),
      needs_attention: stats.pending_count + stats.conflict_count + stats.error_count
    };
  }

  /**
   * Delete order link
   * @param {number} id - Order link ID
   * @returns {Object} Result of delete operation
   */
  delete(id) {
    const orderLink = this.findById(id);
    if (!orderLink) {
      throw new Error('Order link not found');
    }

    // Check for dependent records in conflict resolution log
    const conflictLogCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM erp_conflict_resolution_log WHERE order_link_id = ?
    `).get(id);

    if (conflictLogCount.count > 0) {
      throw new Error('Cannot delete order link: has conflict resolution history');
    }

    const result = this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id);

    if (result.changes === 0) {
      throw new Error('Order link not found');
    }

    return result;
  }

  /**
   * Check if external ID exists for a connection
   * @param {string} externalId - External ID to check
   * @param {number} connectionId - Connection ID
   * @param {number} [excludeId] - Order link ID to exclude from check (for updates)
   * @returns {boolean} True if external ID exists
   */
  externalIdExists(externalId, connectionId, excludeId = null) {
    let stmt;
    if (excludeId) {
      stmt = this.db.prepare('SELECT id FROM erp_order_links WHERE external_id = ? AND connection_id = ? AND id != ?');
      return !!stmt.get(externalId, connectionId, excludeId);
    } else {
      stmt = this.db.prepare('SELECT id FROM erp_order_links WHERE external_id = ? AND connection_id = ?');
      return !!stmt.get(externalId, connectionId);
    }
  }

  /**
   * Bulk update sync status for multiple order links
   * @param {Array} orderLinkIds - Array of order link IDs
   * @param {string} syncStatus - New sync status
   * @returns {Object} Update result with count
   */
  bulkUpdateSyncStatus(orderLinkIds, syncStatus) {
    if (!Array.isArray(orderLinkIds) || orderLinkIds.length === 0) {
      throw new Error('Order link IDs array is required');
    }

    const validSyncStatuses = ['synced', 'pending', 'conflict', 'error'];
    if (!validSyncStatuses.includes(syncStatus)) {
      throw new Error(`Sync status must be one of: ${validSyncStatuses.join(', ')}`);
    }

    const placeholders = orderLinkIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET 
        sync_status = ?,
        last_sync_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `);

    const result = stmt.run(syncStatus, ...orderLinkIds);
    return { changes: result.changes };
  }
}

module.exports = new ERPOrderLink();