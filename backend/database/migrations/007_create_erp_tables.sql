-- ERP Integration Foundation - Database Schema
-- This migration creates all tables required for ERP system integration
-- including connection management, sync state tracking, import history, and order linking

-- ERP Connection Management Table
-- Stores configuration for different ERP system connections
CREATE TABLE erp_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    erp_system_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    connection_config TEXT NOT NULL, -- JSON stored as TEXT for SQLite compatibility
    import_settings TEXT NOT NULL,   -- JSON stored as TEXT for SQLite compatibility
    api_key_id INTEGER,
    last_successful_import DATETIME,
    last_error TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- ERP Field Mapping Configuration
-- Stores field mapping configurations per connection for flexible data transformation
CREATE TABLE erp_field_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id INTEGER NOT NULL,
    source_field VARCHAR(100) NOT NULL,
    target_field VARCHAR(100) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    is_required BOOLEAN DEFAULT 0,
    default_value TEXT,
    transformation_rule TEXT, -- JSON stored as TEXT for complex transformations
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (connection_id) REFERENCES erp_connections(id) ON DELETE CASCADE,
    UNIQUE(connection_id, source_field, target_field)
);

-- ERP Sync State Management
-- Tracks incremental synchronization state for each connection
CREATE TABLE erp_sync_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id INTEGER NOT NULL UNIQUE,
    last_sync_timestamp DATETIME,
    last_successful_sync DATETIME,
    last_erp_timestamp DATETIME,
    sync_cursor TEXT, -- For cursor-based pagination
    consecutive_failures INTEGER DEFAULT 0,
    is_full_sync_required BOOLEAN DEFAULT 0,
    sync_strategy VARCHAR(50) DEFAULT 'timestamp' CHECK(sync_strategy IN ('timestamp', 'cursor', 'incremental_id')),
    sync_metadata TEXT, -- JSON stored as TEXT for additional sync context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (connection_id) REFERENCES erp_connections(id) ON DELETE CASCADE
);

-- ERP Import Batch Tracking
-- Tracks import batches and their overall results
CREATE TABLE erp_import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id INTEGER NOT NULL,
    import_type VARCHAR(50) NOT NULL CHECK(import_type IN ('full', 'incremental', 'manual', 'scheduled')),
    status VARCHAR(50) DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    successful_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    error_summary TEXT,
    import_metadata TEXT, -- JSON stored as TEXT for batch context
    created_by INTEGER,
    FOREIGN KEY (connection_id) REFERENCES erp_connections(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ERP Import Detail Records
-- Tracks individual record import results within each batch
CREATE TABLE erp_import_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_log_id INTEGER NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL CHECK(action IN ('create', 'update', 'skip', 'error')),
    manufacturing_order_id INTEGER,
    error_message TEXT,
    record_data TEXT, -- JSON stored as TEXT for the imported record
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (import_log_id) REFERENCES erp_import_logs(id) ON DELETE CASCADE,
    FOREIGN KEY (manufacturing_order_id) REFERENCES manufacturing_orders(id) ON DELETE SET NULL
);

-- ERP Order External Linking
-- Links manufacturing orders to external ERP system records
CREATE TABLE erp_order_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    connection_id INTEGER NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    external_system VARCHAR(100) NOT NULL,
    external_updated_at DATETIME,
    last_sync_at DATETIME,
    sync_status VARCHAR(50) DEFAULT 'synced' CHECK(sync_status IN ('synced', 'pending', 'conflict', 'error')),
    conflict_data TEXT, -- JSON stored as TEXT for conflict resolution context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (connection_id) REFERENCES erp_connections(id) ON DELETE CASCADE,
    UNIQUE(connection_id, external_id) -- Prevent duplicate external IDs per connection
);

-- ERP Conflict Resolution Audit Log
-- Tracks conflict detection and resolution for audit purposes
CREATE TABLE erp_conflict_resolution_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_link_id INTEGER NOT NULL,
    conflict_type VARCHAR(100) NOT NULL,
    conflict_detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolution_strategy VARCHAR(100),
    resolved_at DATETIME,
    resolved_by INTEGER,
    local_data TEXT, -- JSON stored as TEXT for local system data
    external_data TEXT, -- JSON stored as TEXT for external system data
    resolution_data TEXT, -- JSON stored as TEXT for final resolved data
    FOREIGN KEY (order_link_id) REFERENCES erp_order_links(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ERP Change Detection Performance Log
-- Tracks performance metrics for change detection operations
CREATE TABLE erp_change_detection_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id INTEGER NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    records_checked INTEGER DEFAULT 0,
    changes_detected INTEGER DEFAULT 0,
    operation_duration_ms INTEGER DEFAULT 0,
    memory_usage_mb INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    performance_notes TEXT,
    FOREIGN KEY (connection_id) REFERENCES erp_connections(id) ON DELETE CASCADE
);

-- Extend manufacturing_orders table with ERP-related fields
-- Add columns to support ERP integration without breaking existing functionality
ALTER TABLE manufacturing_orders ADD COLUMN external_erp_id VARCHAR(255);
ALTER TABLE manufacturing_orders ADD COLUMN external_erp_system VARCHAR(100);
ALTER TABLE manufacturing_orders ADD COLUMN external_updated_at DATETIME;
ALTER TABLE manufacturing_orders ADD COLUMN last_erp_sync DATETIME;
ALTER TABLE manufacturing_orders ADD COLUMN erp_sync_status VARCHAR(50) DEFAULT 'none' CHECK(erp_sync_status IN ('none', 'synced', 'pending', 'conflict', 'error'));
ALTER TABLE manufacturing_orders ADD COLUMN erp_metadata TEXT; -- JSON stored as TEXT for flexible ERP data