const { getDatabase } = require('../utils/database');

/**
 * ERPImportLog Model
 * ==================
 *
 * Handles database operations for ERP import batch tracking and detailed record processing.
 * Manages import sessions, tracks progress, and provides comprehensive audit trails.
 *
 * Key Features:
 * - Import batch tracking with progress monitoring
 * - Detailed record-level import results
 * - Comprehensive error tracking and reporting
 * - Performance metrics and statistics
 * - Integration with ERP connections and sync states
 */
class ERPImportLog {
  constructor() {
    this.db = getDatabase();
    this.table = 'erp_import_logs';
    this.detailsTable = 'erp_import_details';
  }

  /**
   * Start a new import batch
   * @param {Object} importData - Import batch data
   * @param {number} importData.connection_id - ERP connection ID
   * @param {string} importData.import_type - Type of import (full, incremental, manual, scheduled)
   * @param {number} [importData.created_by] - User ID who initiated the import
   * @param {Object} [importData.import_metadata={}] - Additional import context
   * @returns {Object} Created import log object
   * @throws {Error} If validation fails
   */
  startImport(importData) {
    this._validateImportData(importData);

    const sqlParams = [
      importData.connection_id,
      importData.import_type,
      JSON.stringify(importData.import_metadata || {}),
      importData.created_by || null
    ];

    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (
        connection_id, import_type, import_metadata, created_by
      ) VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(...sqlParams);
    return this.findById(result.lastInsertRowid);
  }

  /**
   * Validate import data
   * @param {Object} importData - Import data to validate
   * @throws {Error} If validation fails
   * @private
   */
  _validateImportData(importData) {
    if (!importData.connection_id || !Number.isInteger(importData.connection_id)) {
      throw new Error('Connection ID is required and must be an integer');
    }

    const validImportTypes = ['full', 'incremental', 'manual', 'scheduled'];
    if (!importData.import_type || !validImportTypes.includes(importData.import_type)) {
      throw new Error(`Import type must be one of: ${validImportTypes.join(', ')}`);
    }

    if (importData.import_metadata && typeof importData.import_metadata !== 'object') {
      throw new Error('Import metadata must be an object');
    }
  }

  /**
   * Find import log by ID with details
   * @param {number} id - Import log ID
   * @param {boolean} [includeDetails=false] - Whether to include detail records
   * @returns {Object|null} Import log object with connection info, or null if not found
   */
  findById(id, includeDetails = false) {
    const importLog = this.db.prepare(`
      SELECT 
        il.*,
        ec.name as connection_name,
        ec.erp_system_type,
        u.username as created_by_username
      FROM ${this.table} il
      LEFT JOIN erp_connections ec ON il.connection_id = ec.id
      LEFT JOIN users u ON il.created_by = u.id
      WHERE il.id = ?
    `).get(id);

    if (!importLog) return null;

    const parsedLog = this._parseImportLogData(importLog);

    if (includeDetails) {
      parsedLog.details = this.getImportDetails(id);
    }

    return parsedLog;
  }

  /**
   * Parse JSON metadata field
   * @param {Object} importLog - Raw import log data from database
   * @returns {Object} Formatted import log object with parsed metadata
   * @private
   */
  _parseImportLogData(importLog) {
    try {
      importLog.import_metadata = JSON.parse(importLog.import_metadata || '{}');
    } catch (error) {
      // console.error('Failed to parse import metadata for log:', importLog.id, error);
      importLog.import_metadata = {};
    }

    return importLog;
  }

  /**
   * Get all import logs with filtering
   * @param {Object} [filters={}] - Filter criteria
   * @param {number} [filters.connection_id] - Filter by connection ID
   * @param {string} [filters.status] - Filter by import status
   * @param {string} [filters.import_type] - Filter by import type
   * @param {number} [filters.limit=50] - Maximum number of results
   * @param {number} [filters.offset=0] - Results offset for pagination
   * @returns {Array} Array of import log objects
   */
  findAll(filters = {}) {
    const { whereClause, params } = this._buildWhereClause(filters);
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const importLogs = this.db.prepare(`
      SELECT 
        il.*,
        ec.name as connection_name,
        ec.erp_system_type,
        u.username as created_by_username
      FROM ${this.table} il
      LEFT JOIN erp_connections ec ON il.connection_id = ec.id
      LEFT JOIN users u ON il.created_by = u.id
      ${whereClause}
      ORDER BY il.started_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return importLogs.map(log => this._parseImportLogData(log));
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
      whereConditions.push('il.connection_id = ?');
      params.push(filters.connection_id);
    }

    if (filters.status) {
      whereConditions.push('il.status = ?');
      params.push(filters.status);
    }

    if (filters.import_type) {
      whereConditions.push('il.import_type = ?');
      params.push(filters.import_type);
    }

    if (filters.date_from) {
      whereConditions.push('il.started_at >= ?');
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      whereConditions.push('il.started_at <= ?');
      params.push(filters.date_to);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    return { whereClause, params };
  }

  /**
   * Update import progress
   * @param {number} id - Import log ID
   * @param {Object} progressData - Progress update data
   * @param {number} [progressData.total_records] - Total records to process
   * @param {number} [progressData.processed_records] - Records processed so far
   * @param {number} [progressData.successful_records] - Successfully processed records
   * @param {number} [progressData.failed_records] - Failed record processing attempts
   * @returns {Object} Updated import log object
   */
  updateProgress(id, progressData) {
    const importLog = this.findById(id);
    if (!importLog) {
      throw new Error('Import log not found');
    }

    const fields = [];
    const values = [];

    if (progressData.total_records !== undefined) {
      fields.push('total_records = ?');
      values.push(progressData.total_records);
    }

    if (progressData.processed_records !== undefined) {
      fields.push('processed_records = ?');
      values.push(progressData.processed_records);
    }

    if (progressData.successful_records !== undefined) {
      fields.push('successful_records = ?');
      values.push(progressData.successful_records);
    }

    if (progressData.failed_records !== undefined) {
      fields.push('failed_records = ?');
      values.push(progressData.failed_records);
    }

    if (fields.length === 0) {
      return importLog;
    }

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
   * Complete an import batch
   * @param {number} id - Import log ID
   * @param {string} status - Final status (completed, failed, cancelled)
   * @param {string} [errorSummary] - Error summary if import failed
   * @returns {Object} Completed import log object
   */
  completeImport(id, status, errorSummary = null) {
    const importLog = this.findById(id);
    if (!importLog) {
      throw new Error('Import log not found');
    }

    const validStatuses = ['completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET 
        status = ?,
        completed_at = CURRENT_TIMESTAMP,
        error_summary = ?
      WHERE id = ?
    `);

    stmt.run(status, errorSummary, id);
    return this.findById(id);
  }

  /**
   * Add detail record to import batch
   * @param {Object} detailData - Import detail data
   * @param {number} detailData.import_log_id - Import log ID
   * @param {string} detailData.external_id - External record ID
   * @param {string} detailData.action - Action taken (create, update, skip, error)
   * @param {number} [detailData.manufacturing_order_id] - Related manufacturing order ID
   * @param {string} [detailData.error_message] - Error message if action failed
   * @param {Object} [detailData.record_data] - The imported record data
   * @returns {Object} Created import detail object
   */
  addDetail(detailData) {
    this._validateDetailData(detailData);

    const sqlParams = [
      detailData.import_log_id,
      detailData.external_id,
      detailData.action,
      detailData.manufacturing_order_id || null,
      detailData.error_message || null,
      detailData.record_data ? JSON.stringify(detailData.record_data) : null
    ];

    const stmt = this.db.prepare(`
      INSERT INTO ${this.detailsTable} (
        import_log_id, external_id, action, manufacturing_order_id, 
        error_message, record_data
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(...sqlParams);
    return this.getDetailById(result.lastInsertRowid);
  }

  /**
   * Validate detail data
   * @param {Object} detailData - Detail data to validate
   * @throws {Error} If validation fails
   * @private
   */
  _validateDetailData(detailData) {
    if (!detailData.import_log_id || !Number.isInteger(detailData.import_log_id)) {
      throw new Error('Import log ID is required and must be an integer');
    }

    if (!detailData.external_id || typeof detailData.external_id !== 'string') {
      throw new Error('External ID is required and must be a string');
    }

    const validActions = ['create', 'update', 'skip', 'error'];
    if (!detailData.action || !validActions.includes(detailData.action)) {
      throw new Error(`Action must be one of: ${validActions.join(', ')}`);
    }

    if (detailData.record_data && typeof detailData.record_data !== 'object') {
      throw new Error('Record data must be an object');
    }
  }

  /**
   * Get import detail by ID
   * @param {number} id - Import detail ID
   * @returns {Object|null} Import detail object, or null if not found
   */
  getDetailById(id) {
    const detail = this.db.prepare(`
      SELECT 
        id.*,
        mo.order_number as manufacturing_order_number
      FROM ${this.detailsTable} id
      LEFT JOIN manufacturing_orders mo ON id.manufacturing_order_id = mo.id
      WHERE id.id = ?
    `).get(id);

    if (!detail) return null;

    return this._parseDetailData(detail);
  }

  /**
   * Get all details for an import batch
   * @param {number} importLogId - Import log ID
   * @param {Object} [filters={}] - Additional filters
   * @param {string} [filters.action] - Filter by action type
   * @returns {Array} Array of import detail objects
   */
  getImportDetails(importLogId, filters = {}) {
    const whereConditions = ['id.import_log_id = ?'];
    const params = [importLogId];

    if (filters.action) {
      whereConditions.push('id.action = ?');
      params.push(filters.action);
    }

    const details = this.db.prepare(`
      SELECT 
        id.*,
        mo.order_number as manufacturing_order_number
      FROM ${this.detailsTable} id
      LEFT JOIN manufacturing_orders mo ON id.manufacturing_order_id = mo.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY id.processed_at ASC
    `).all(...params);

    return details.map(detail => this._parseDetailData(detail));
  }

  /**
   * Parse detail record data
   * @param {Object} detail - Raw detail data from database
   * @returns {Object} Formatted detail object with parsed record data
   * @private
   */
  _parseDetailData(detail) {
    try {
      detail.record_data = detail.record_data ? JSON.parse(detail.record_data) : null;
    } catch (error) {
      // console.error('Failed to parse record data for detail:', detail.id, error);
      detail.record_data = null;
    }

    return detail;
  }

  /**
   * Get import statistics summary
   * @param {number} [connectionId] - Optional connection ID filter
   * @param {number} [days=30] - Number of days to look back
   * @returns {Object} Import statistics summary
   */
  getImportStats(connectionId = null, days = 30) {
    const whereCondition = connectionId ? 'WHERE il.connection_id = ?' : '';
    const params = connectionId ? [connectionId, days] : [days];

    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_imports,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_imports,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_imports,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_imports,
        SUM(total_records) as total_records_processed,
        SUM(successful_records) as total_successful_records,
        SUM(failed_records) as total_failed_records,
        AVG(
          CASE 
            WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
            THEN (julianday(completed_at) - julianday(started_at)) * 24 * 60 
            ELSE NULL 
          END
        ) as avg_duration_minutes
      FROM ${this.table} il
      ${whereCondition}
      ${whereCondition ? 'AND' : 'WHERE'} il.started_at > datetime('now', '-' || ? || ' days')
    `).get(...params);

    const successRate = stats.total_imports > 0 ?
      (stats.completed_imports / stats.total_imports * 100).toFixed(1) : 0;

    const recordSuccessRate = stats.total_records_processed > 0 ?
      (stats.total_successful_records / stats.total_records_processed * 100).toFixed(1) : 0;

    return {
      ...stats,
      success_rate_percent: parseFloat(successRate),
      record_success_rate_percent: parseFloat(recordSuccessRate),
      avg_duration_minutes: stats.avg_duration_minutes ? parseFloat(stats.avg_duration_minutes.toFixed(2)) : 0
    };
  }

  /**
   * Get currently running imports
   * @returns {Array} Array of running import logs
   */
  getRunningImports() {
    return this.findAll({ status: 'running' });
  }

  /**
   * Cancel a running import
   * @param {number} id - Import log ID
   * @param {string} [reason] - Cancellation reason
   * @returns {Object} Cancelled import log object
   */
  cancelImport(id, reason = 'Manual cancellation') {
    const importLog = this.findById(id);
    if (!importLog) {
      throw new Error('Import log not found');
    }

    if (importLog.status !== 'running') {
      throw new Error('Can only cancel running imports');
    }

    return this.completeImport(id, 'cancelled', reason);
  }

  /**
   * Delete import log and all its details
   * @param {number} id - Import log ID
   * @returns {Object} Result of delete operation
   */
  delete(id) {
    const importLog = this.findById(id);
    if (!importLog) {
      throw new Error('Import log not found');
    }

    const transaction = this.db.transaction(() => {
      // Delete details first (foreign key constraint)
      this.db.prepare(`DELETE FROM ${this.detailsTable} WHERE import_log_id = ?`).run(id);

      // Delete the import log
      const result = this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id);

      if (result.changes === 0) {
        throw new Error('Import log not found');
      }

      return result;
    });

    return transaction();
  }

  /**
   * Clean up old import logs based on retention policy
   * @param {number} [retentionDays=90] - Number of days to retain logs
   * @returns {Object} Cleanup result with counts
   */
  cleanupOldLogs(retentionDays = 90) {
    const transaction = this.db.transaction(() => {
      // Get logs to be deleted
      const logsToDelete = this.db.prepare(`
        SELECT id FROM ${this.table} 
        WHERE started_at < datetime('now', '-' || ? || ' days')
        AND status IN ('completed', 'failed', 'cancelled')
      `).all(retentionDays);

      let deletedLogs = 0;
      let deletedDetails = 0;

      for (const log of logsToDelete) {
        // Count details before deletion
        const detailCount = this.db.prepare(`
          SELECT COUNT(*) as count FROM ${this.detailsTable} WHERE import_log_id = ?
        `).get(log.id);

        deletedDetails += detailCount.count;

        // Delete details
        this.db.prepare(`DELETE FROM ${this.detailsTable} WHERE import_log_id = ?`).run(log.id);

        // Delete log
        this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(log.id);
        deletedLogs++;
      }

      return { deletedLogs, deletedDetails };
    });

    return transaction();
  }
}

module.exports = new ERPImportLog();