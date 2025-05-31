# Manufacturing Planning Board - Backend Specification

## Project Overview
Build a Node.js/Express backend API for a manufacturing planning board system with SQLite database, role-based access control, and real-time updates for drag-and-drop functionality.

## Technology Stack
- **Runtime**: Node.js with Express.js
- **Database**: SQLite with better-sqlite3 for performance
- **Authentication**: JWT tokens (simple for MVP)
- **Real-time**: WebSocket support for live updates
- **File Processing**: CSV/Excel import functionality
- **API Style**: RESTful with some real-time WebSocket endpoints

## Database Schema Design

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'scheduler', 'viewer') NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Work Centres Table
```sql
CREATE TABLE work_centres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    capacity INTEGER DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Manufacturing Orders Table
```sql
CREATE TABLE manufacturing_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    stock_code VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    quantity_to_make INTEGER NOT NULL,
    quantity_completed INTEGER DEFAULT 0,
    current_operation VARCHAR(100),
    current_work_centre_id INTEGER,
    status ENUM('not_started', 'in_progress', 'complete', 'on_hold', 'cancelled') DEFAULT 'not_started',
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    due_date DATE,
    start_date DATE,
    completion_date DATE,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (current_work_centre_id) REFERENCES work_centres(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### Manufacturing Steps Table
```sql
CREATE TABLE manufacturing_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    operation_name VARCHAR(100) NOT NULL,
    work_centre_id INTEGER NOT NULL,
    status ENUM('pending', 'in_progress', 'complete', 'skipped') DEFAULT 'pending',
    planned_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,
    quantity_completed INTEGER DEFAULT 0,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (work_centre_id) REFERENCES work_centres(id),
    UNIQUE(order_id, step_number)
);
```

### Audit Log Table (for Learning System)
```sql
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type VARCHAR(50) NOT NULL,
    order_id INTEGER,
    from_work_centre_id INTEGER,
    to_work_centre_id INTEGER,
    user_id INTEGER,
    event_data JSON,
    queue_depth_from INTEGER,
    queue_depth_to INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES manufacturing_orders(id),
    FOREIGN KEY (from_work_centre_id) REFERENCES work_centres(id),
    FOREIGN KEY (to_work_centre_id) REFERENCES work_centres(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Scanner Events Table (Future Integration)
```sql
CREATE TABLE scanner_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    work_centre_id INTEGER NOT NULL,
    operation_name VARCHAR(100),
    event_type ENUM('job_start', 'progress_update', 'job_complete') NOT NULL,
    quantity INTEGER,
    operator_badge VARCHAR(50),
    scanner_id VARCHAR(50),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES manufacturing_orders(id),
    FOREIGN KEY (work_centre_id) REFERENCES work_centres(id)
);
```

### Machine Performance Table (Future OEE Integration)
```sql
-- Future table for MQTT machine data
-- CREATE TABLE machine_performance (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     machine_id VARCHAR(50) NOT NULL,
--     work_centre_id INTEGER,
--     availability DECIMAL(5,2),
--     performance DECIMAL(5,2), 
--     quality DECIMAL(5,2),
--     oee DECIMAL(5,2),
--     recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (work_centre_id) REFERENCES work_centres(id)
-- );
```

## API Endpoints Design

### Authentication Endpoints
```
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/auth/me
```

### Users Management (Admin Only)
```
GET    /api/users
POST   /api/users
GET    /api/users/:id
PUT    /api/users/:id
DELETE /api/users/:id
```

### Work Centres Management
```
GET    /api/work-centres           # All roles
POST   /api/work-centres           # Admin only
PUT    /api/work-centres/:id       # Admin only
DELETE /api/work-centres/:id       # Admin only
PUT    /api/work-centres/reorder   # Admin only
```

### Manufacturing Orders
```
GET    /api/orders                 # All roles (filtered by permissions)
POST   /api/orders                 # Admin, Scheduler
GET    /api/orders/:id             # All roles
PUT    /api/orders/:id             # Admin, Scheduler
DELETE /api/orders/:id             # Admin only
PUT    /api/orders/:id/move        # Scheduler only (drag & drop)
POST   /api/orders/:id/start-move  # Scheduler only (conflict prevention)
POST   /api/orders/:id/end-move    # Scheduler only (conflict resolution)
POST   /api/orders/import          # Admin, Scheduler (CSV/Excel)
```

### Planning Board
```
GET    /api/planning-board         # All roles - returns kanban data
PUT    /api/planning-board/move    # Scheduler only - move orders between work centres
GET    /api/planning-board/stats   # All roles - dashboard analytics
```

### Analytics & Reporting
```
GET    /api/analytics/dashboard    # All roles
GET    /api/analytics/cycle-times  # Admin, Scheduler
GET    /api/analytics/routing      # Admin, Scheduler (future learning data)
```

### Future OEE Integration (Placeholder - Do Not Implement Yet)
```
# Future MQTT machine data endpoints
# POST   /api/oee/machine-data     # Webhook from MQTT broker
# GET    /api/oee/metrics          # Machine performance metrics
# GET    /api/oee/availability     # Machine availability data
# These will be built when OEE functionality is needed
```

### WebSocket Events (Real-time Updates)
```
# Client Events (sent to server)
'join_planning_board'     # User joins planning board session
'leave_planning_board'    # User leaves planning board session
'start_drag'              # User starts dragging an order
'end_drag'                # User finishes/cancels drag operation

# Server Events (broadcast to clients)
'user_joined'             # Another user joined the board
'user_left'               # Another user left the board
'order_locked'            # Order is being moved by another user
'order_unlocked'          # Order is available for interaction
'order_moved'             # Order position changed
'order_updated'           # Order data changed
'work_centre_updated'     # Work centre configuration changed
```

## Role-Based Access Control

### Role Definitions
```javascript
const ROLES = {
  ADMIN: {
    name: 'admin',
    permissions: [
      'users:read', 'users:write', 'users:delete',
      'work_centres:read', 'work_centres:write', 'work_centres:delete',
      'orders:read', 'orders:write', 'orders:delete', 'orders:move',
      'analytics:read', 'settings:write'
    ]
  },
  SCHEDULER: {
    name: 'scheduler', 
    permissions: [
      'work_centres:read',
      'orders:read', 'orders:write', 'orders:move',
      'analytics:read'
    ]
  },
  VIEWER: {
    name: 'viewer',
    permissions: [
      'work_centres:read',
      'orders:read',
      'analytics:read'
    ]
  }
};
```

### Middleware Implementation
```javascript
// Permission check middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
```

## Key Features to Implement

### 1. Drag & Drop API with Conflict Resolution
```javascript
// POST /api/orders/:id/start-move - Lock order for user
{
  "userId": "john_doe",
  "orderNumber": "MO-2024-001"
}

// PUT /api/orders/:id/move - Move order between work centres
{
  "fromWorkCentreId": 1,
  "toWorkCentreId": 3,
  "position": 2,  // Optional: position within work centre
  "reason": "user_decision"  // For audit log
}

// POST /api/orders/:id/end-move - Release order lock
{
  "completed": true  // true = moved successfully, false = cancelled
}
```

### 2. Real-time Conflict Prevention
```javascript
// In-memory drag lock tracking (simple MVP approach)
const activeDragOperations = new Map();
// Structure: orderId -> { userId, userName, startTime, orderNumber }

// WebSocket broadcast when drag starts
{
  "event": "order_locked",
  "orderId": "123",
  "orderNumber": "MO-2024-001", 
  "lockedBy": "john_doe",
  "lockedByName": "John Doe"
}

// Auto-expire locks after 30 seconds to prevent stuck locks
```

### 3. CSV/Excel Import
```javascript
// POST /api/orders/import
// Supports file upload with validation
// Returns import results with errors/warnings
```

### 4. Real-time Updates via WebSocket
```javascript
// WebSocket connection management
// Track connected users and their active sessions
const connectedUsers = new Map();
// Structure: socketId -> { userId, userName, joinedAt }

// Critical events that require real-time updates:
'order_moved' - When orders are dragged between work centres
'order_locked' - When user starts dragging (prevent conflicts)
'order_unlocked' - When drag operation completes
'order_updated' - When order status/progress changes  
'work_centre_updated' - When work centre configuration changes
'user_activity' - Show who else is online and active
```

### 5. Dashboard Analytics
```javascript
// GET /api/analytics/dashboard
{
  "activeOrders": 15,
  "completionRate": 87.5,
  "workCentreUtilization": 68.8,
  "dailyProduction": { "actual": 245, "target": 300 },
  "overdueOrders": 1,
  "avgCycleTime": 12.5
}
```

## File Structure
```
backend/
├── src/
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── usersController.js
│   │   ├── workCentresController.js
│   │   ├── ordersController.js
│   │   └── analyticsController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── permissions.js
│   │   ├── dragLocks.js        # Conflict resolution
│   │   └── validation.js
│   ├── models/
│   │   ├── User.js
│   │   ├── WorkCentre.js
│   │   ├── ManufacturingOrder.js
│   │   └── AuditLog.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── workCentres.js
│   │   ├── orders.js
│   │   └── analytics.js
│   ├── services/
│   │   ├── authService.js
│   │   ├── importService.js
│   │   ├── websocketService.js # Real-time updates
│   │   └── analyticsService.js
│   ├── utils/
│   │   ├── database.js
│   │   ├── validation.js
│   │   └── helpers.js
│   ├── websocket/
│   │   ├── socketHandler.js    # WebSocket connection management
│   │   └── eventHandlers.js    # WebSocket event handling
│   ├── config/
│   │   └── database.js
│   └── app.js
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── manufacturing.db
├── uploads/
├── package.json
└── README.md
```

## Security Considerations (MVP → Production)

### Current MVP Approach
- Simple JWT authentication
- Basic password hashing with bcrypt
- Input validation and sanitization
- Rate limiting on auth endpoints

### Future Production Enhancements
- OAuth 2.0/SAML integration
- Multi-factor authentication
- API key management for scanner integration
- Audit trail encryption
- Database encryption at rest
- HTTPS enforcement
- CORS configuration
- Input validation with comprehensive schema

## Performance Considerations
- Database indexing on frequently queried columns
- Connection pooling for SQLite
- Caching for dashboard analytics
- WebSocket connection management and cleanup
- Drag lock timeout handling (30-second auto-expire)
- File upload size limits
- Pagination for large datasets
- In-memory drag lock storage (reset on server restart - acceptable for MVP)

## Conflict Resolution Implementation Details

### Simple Drag Lock Middleware
```javascript
// src/middleware/dragLocks.js
const activeDragOperations = new Map();

const createDragLock = (orderId, userId, userName, orderNumber) => {
  activeDragOperations.set(orderId.toString(), {
    userId,
    userName,
    orderNumber,
    startTime: Date.now()
  });
  
  // Auto-expire after 30 seconds
  setTimeout(() => {
    activeDragOperations.delete(orderId.toString());
  }, 30000);
};

const checkDragLock = (req, res, next) => {
  const orderId = req.params.id;
  const lock = activeDragOperations.get(orderId);
  
  if (lock && lock.userId !== req.user.id) {
    return res.status(423).json({ 
      error: 'Order currently being moved by another user',
      lockedBy: lock.userName,
      orderNumber: lock.orderNumber
    });
  }
  next();
};
```

### WebSocket Integration Requirements
```javascript
// Key WebSocket events for conflict prevention
io.on('connection', (socket) => {
  socket.on('join_planning_board', (data) => {
    socket.join('planning_board');
    socket.broadcast.to('planning_board').emit('user_joined', {
      userId: data.userId,
      userName: data.userName
    });
  });
  
  socket.on('start_drag', (data) => {
    // Create drag lock and broadcast to all users
    socket.broadcast.to('planning_board').emit('order_locked', {
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      lockedBy: data.userName
    });
  });
});
```

## Sample Data Seeds
Include realistic sample data for:
- 3 users (one per role)
- 5 work centres (Cutting, Assembly, Quality Control, Packaging, Shipping)
- 10-15 manufacturing orders in various states
- Sample manufacturing steps
- Historical audit log entries

## Integration Points
- **Scanner API**: Webhook endpoints for receiving scanner data
- **ERP Integration**: Future API endpoints for external system integration
- **Reporting**: Export capabilities for external reporting tools

This specification provides Claude Code with everything needed to build a production-ready MVP backend that can scale to full production with security enhancements.