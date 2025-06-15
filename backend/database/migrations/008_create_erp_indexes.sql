-- ERP Integration Performance Indexes
-- This migration creates strategic indexes for efficient ERP operations
-- including incremental sync, change detection, and conflict resolution

-- ERP Connections Performance Indexes
CREATE INDEX idx_erp_connections_active ON erp_connections(is_active) WHERE is_active = 1;
CREATE INDEX idx_erp_connections_system_type ON erp_connections(erp_system_type, is_active);
CREATE INDEX idx_erp_connections_last_import ON erp_connections(last_successful_import DESC);

-- ERP Field Mappings Performance Indexes
CREATE INDEX idx_erp_field_mappings_connection ON erp_field_mappings(connection_id, source_field);
CREATE INDEX idx_erp_field_mappings_required ON erp_field_mappings(connection_id, is_required) WHERE is_required = 1;

-- ERP Sync State Performance Indexes
-- Critical for incremental sync operations
CREATE INDEX idx_erp_sync_state_connection ON erp_sync_state(connection_id);
CREATE INDEX idx_erp_sync_state_last_sync ON erp_sync_state(connection_id, last_sync_timestamp);
CREATE INDEX idx_erp_sync_state_failures ON erp_sync_state(consecutive_failures) WHERE consecutive_failures > 0;
CREATE INDEX idx_erp_sync_state_full_sync_required ON erp_sync_state(is_full_sync_required) WHERE is_full_sync_required = 1;

-- ERP Import Logs Performance Indexes
-- Essential for import operation tracking and reporting
CREATE INDEX idx_erp_import_logs_connection_status ON erp_import_logs(connection_id, status);
CREATE INDEX idx_erp_import_logs_status_date ON erp_import_logs(status, started_at DESC);
CREATE INDEX idx_erp_import_logs_type_date ON erp_import_logs(import_type, started_at DESC);
CREATE INDEX idx_erp_import_logs_running ON erp_import_logs(status, started_at) WHERE status = 'running';
CREATE INDEX idx_erp_import_logs_failed ON erp_import_logs(status, started_at DESC) WHERE status = 'failed';

-- ERP Import Details Performance Indexes
-- Optimized for batch processing and error analysis
CREATE INDEX idx_erp_import_details_log ON erp_import_details(import_log_id, action);
CREATE INDEX idx_erp_import_details_external_id ON erp_import_details(import_log_id, external_id);
CREATE INDEX idx_erp_import_details_order ON erp_import_details(manufacturing_order_id) WHERE manufacturing_order_id IS NOT NULL;
CREATE INDEX idx_erp_import_details_errors ON erp_import_details(import_log_id, action) WHERE action = 'error';
CREATE INDEX idx_erp_import_details_processed_at ON erp_import_details(processed_at DESC);

-- ERP Order Links Performance Indexes
-- Critical for efficient external order tracking and conflict detection
CREATE INDEX idx_erp_order_links_order_connection ON erp_order_links(order_id, connection_id);
CREATE INDEX idx_erp_order_links_external_id ON erp_order_links(connection_id, external_id);
CREATE INDEX idx_erp_order_links_external_updated ON erp_order_links(connection_id, external_updated_at DESC);
CREATE INDEX idx_erp_order_links_sync_status ON erp_order_links(connection_id, sync_status);
CREATE INDEX idx_erp_order_links_conflicts ON erp_order_links(connection_id, sync_status) WHERE sync_status = 'conflict';
CREATE INDEX idx_erp_order_links_pending_sync ON erp_order_links(sync_status, last_sync_at) WHERE sync_status = 'pending';
CREATE INDEX idx_erp_order_links_error_status ON erp_order_links(sync_status, updated_at DESC) WHERE sync_status = 'error';

-- ERP Conflict Resolution Performance Indexes
-- Optimized for conflict tracking and resolution workflows
CREATE INDEX idx_erp_conflict_resolution_order_link ON erp_conflict_resolution_log(order_link_id, conflict_detected_at DESC);
CREATE INDEX idx_erp_conflict_resolution_type ON erp_conflict_resolution_log(conflict_type, conflict_detected_at DESC);
CREATE INDEX idx_erp_conflict_resolution_unresolved ON erp_conflict_resolution_log(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_erp_conflict_resolution_resolved_by ON erp_conflict_resolution_log(resolved_by, resolved_at DESC) WHERE resolved_by IS NOT NULL;

-- ERP Change Detection Performance Indexes
-- Essential for monitoring sync performance and optimization
CREATE INDEX idx_erp_change_detection_connection ON erp_change_detection_log(connection_id, started_at DESC);
CREATE INDEX idx_erp_change_detection_operation ON erp_change_detection_log(operation_type, started_at DESC);
CREATE INDEX idx_erp_change_detection_duration ON erp_change_detection_log(operation_duration_ms DESC);
CREATE INDEX idx_erp_change_detection_performance ON erp_change_detection_log(connection_id, operation_type, started_at DESC);

-- Manufacturing Orders ERP Extension Indexes
-- Optimized for ERP-integrated order operations
CREATE INDEX idx_manufacturing_orders_external_erp ON manufacturing_orders(external_erp_system, external_erp_id) WHERE external_erp_id IS NOT NULL;
CREATE INDEX idx_manufacturing_orders_erp_updated ON manufacturing_orders(external_updated_at DESC) WHERE external_updated_at IS NOT NULL;
CREATE INDEX idx_manufacturing_orders_erp_sync_status ON manufacturing_orders(erp_sync_status) WHERE erp_sync_status != 'none';
CREATE INDEX idx_manufacturing_orders_last_erp_sync ON manufacturing_orders(last_erp_sync DESC) WHERE last_erp_sync IS NOT NULL;
CREATE INDEX idx_manufacturing_orders_erp_conflicts ON manufacturing_orders(erp_sync_status, external_updated_at DESC) WHERE erp_sync_status = 'conflict';

-- Composite Indexes for Complex ERP Queries
-- Optimized for common multi-table queries and reporting

-- Import efficiency tracking
CREATE INDEX idx_import_efficiency ON erp_import_logs(connection_id, import_type, started_at DESC, status);

-- Order synchronization status tracking
CREATE INDEX idx_order_sync_tracking ON erp_order_links(connection_id, sync_status, external_updated_at DESC);

-- Conflict resolution workflow optimization
CREATE INDEX idx_conflict_workflow ON erp_conflict_resolution_log(order_link_id, resolved_at, conflict_detected_at DESC);

-- Performance monitoring queries
CREATE INDEX idx_performance_monitoring ON erp_change_detection_log(connection_id, operation_type, operation_duration_ms, started_at DESC);