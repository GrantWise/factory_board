/**
 * Application Constants
 * =====================
 *
 * Centralized constants file to eliminate magic numbers and provide
 * a single source of truth for configuration values across the application.
 *
 * Benefits:
 * - Eliminates magic numbers scattered throughout codebase
 * - Makes configuration changes easier to manage
 * - Improves code maintainability and readability
 * - Prevents inconsistencies between similar values
 */

module.exports = {
  // Authentication & Security
  AUTH: {
    BCRYPT_SALT_ROUNDS: 12,
    JWT_ACCESS_TOKEN_EXPIRES_IN: '24h',
    JWT_REFRESH_TOKEN_EXPIRES_IN: '7d',
    MIN_PASSWORD_LENGTH: 6
  },

  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    LOCKED: 423,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500
  },

  // Rate Limiting Configuration
  RATE_LIMITS: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes in milliseconds
    GLOBAL_PRODUCTION: 1000,
    GLOBAL_DEVELOPMENT: 2000,
    API_KEY_PRODUCTION: 100,
    API_KEY_DEVELOPMENT: 500,
    AUTH_PRODUCTION: 25,
    AUTH_DEVELOPMENT: 100,
    ADMIN_PRODUCTION: 500,
    ADMIN_DEVELOPMENT: 1000
  },

  // User Management
  USER_ROLES: {
    ADMIN: 'admin',
    SCHEDULER: 'scheduler',
    VIEWER: 'viewer'
  },

  // Order Status Management
  ORDER_STATUSES: {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETE: 'complete',
    OVERDUE: 'overdue',
    ON_HOLD: 'on_hold',
    CANCELLED: 'cancelled'
  },

  // Order Priority Levels
  ORDER_PRIORITIES: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent',
    VALUES: ['low', 'medium', 'high', 'urgent'] // For validation arrays
  },

  // Manufacturing Step States
  MANUFACTURING_STEPS: {
    STATUSES: {
      PENDING: 'pending',
      IN_PROGRESS: 'in_progress',
      COMPLETE: 'complete',
      SKIPPED: 'skipped',
      VALUES: ['pending', 'in_progress', 'complete', 'skipped'] // For validation arrays
    }
  },

  // API Keys Configuration
  API_KEYS: {
    BCRYPT_ROUNDS: 10,
    DEFAULT_RATE_LIMIT: 1000,
    MIN_KEY_LENGTH: 32,
    MAX_KEY_LENGTH: 128,
    MAX_SYSTEM_ID_LENGTH: 50
  },

  // Drag & Drop Lock Management
  DRAG_LOCKS: {
    TIMEOUT_MS: 30 * 1000, // 30 seconds
    CLEANUP_INTERVAL_MS: 30 * 1000 // 30 seconds
  },

  // Server Configuration
  SERVER: {
    DEFAULT_PORT: 3001,
    CORS_ORIGIN: 'http://localhost:3000'
  },

  // File Upload Limits
  UPLOAD: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB in bytes
    MAX_FILE_SIZE_STRING: '10mb' // For Express body parser
  },

  // Request Limits
  REQUEST: {
    BODY_SIZE_LIMIT: '10mb',
    URL_ENCODED_LIMIT: '10mb'
  },

  // Validation Constraints
  VALIDATION: {
    // String length limits
    MAX_ORDER_NUMBER_LENGTH: 50,
    MAX_STOCK_CODE_LENGTH: 50,
    MAX_DESCRIPTION_LENGTH: 255,
    MAX_OPERATION_NAME_LENGTH: 100,
    MAX_USERNAME_LENGTH: 50,
    MAX_EMAIL_LENGTH: 100,
    MAX_NAME_LENGTH: 50,

    // Pagination
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    MIN_PAGE_SIZE: 1,

    // Quantities and positions
    MIN_QUANTITY: 1,
    MIN_POSITION: 1,
    MAX_IMPORT_BATCH_SIZE: 100
  },

  // Default Values for Orders
  ORDERS: {
    DEFAULT_STATUS: 'not_started',
    DEFAULT_PRIORITY: 'medium',
    MIN_POSITION: 1,
    DEFAULT_QUANTITY_COMPLETED: 0
  },

  // Analytics Time Periods
  ANALYTICS: {
    DEFAULT_DAYS: 30,
    MAX_DAYS: 365,
    MIN_DAYS: 1
  },

  // Work Centre Configuration
  WORK_CENTRES: {
    DEFAULT_CAPACITY: 1,
    DEFAULT_DISPLAY_ORDER: 0,
    MAX_CODE_LENGTH: 20,
    MAX_NAME_LENGTH: 100
  },

  // Audit Log Types
  AUDIT_EVENTS: {
    ORDER_CREATED: 'order_created',
    ORDER_UPDATED: 'order_updated',
    ORDER_DELETED: 'order_deleted',
    ORDER_MOVED: 'order_moved',
    STEP_STARTED: 'step_started',
    STEP_COMPLETED: 'step_completed',
    USER_LOGIN: 'user_login',
    USER_LOGOUT: 'user_logout',
    PASSWORD_CHANGED: 'password_changed',
    API_AUTH_SUCCESS: 'api_auth_success',
    API_AUTH_FAILED: 'api_auth_failed',
    SECURITY_VIOLATION: 'security_violation'
  },

  // Database Configuration
  DATABASE: {
    CONNECTION_TIMEOUT: 5000, // 5 seconds
    QUERY_TIMEOUT: 30000, // 30 seconds
    MAX_RETRIES: 3
  },

  // Security Policies
  SECURITY_POLICIES: {
    GLOBAL: 'global',
    API_KEY: 'api-key',
    AUTH: 'auth',
    ADMIN: 'admin'
  },

  // Time Constants (in milliseconds)
  TIME: {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000
  }
};