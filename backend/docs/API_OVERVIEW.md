# Manufacturing Planning Board API Overview

## Introduction

The Manufacturing Planning Board API provides comprehensive endpoints for managing manufacturing orders, work centres, users, and analytics in a manufacturing environment. The API follows REST principles and provides real-time updates via WebSocket connections.

## Base URL

- **Development**: `http://localhost:3001/api`
- **Production**: `https://your-domain.com/api`

## Authentication

The API supports two authentication methods:

### 1. JWT Token Authentication (Primary)

Used for web application access and user-facing operations.

```http
Authorization: Bearer <jwt_token>
```

**Getting a Token:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. API Key Authentication (External Systems)

Used for external system integration and automated processes.

```http
X-API-Key: <api_key>
X-System-ID: <system_identifier>
```

## User Roles and Permissions

| Role | Permissions |
|------|-------------|
| **admin** | Full access to all endpoints, user management, system configuration |
| **scheduler** | Create, read, update manufacturing orders and work centres |
| **viewer** | Read-only access to orders, work centres, and analytics |

## Core Resources

### 1. Authentication (`/api/auth`)

- `POST /login` - User login
- `POST /logout` - User logout
- `POST /refresh` - Refresh access token
- `GET /me` - Get current user profile
- `PUT /profile` - Update user profile
- `POST /change-password` - Change user password

### 2. Manufacturing Orders (`/api/orders`)

- `GET /orders` - List all orders with filtering
- `GET /orders/:id` - Get specific order details
- `POST /orders` - Create new order
- `PUT /orders/:id` - Update order
- `DELETE /orders/:id` - Delete order (soft delete if in progress)
- `PUT /orders/:id/move` - Move order to different work centre
- `POST /orders/import` - Bulk import orders
- `POST /orders/reorder` - Reorder orders within work centre

### 3. Work Centres (`/api/work-centres`)

- `GET /work-centres` - List all work centres
- `GET /work-centres/:id` - Get specific work centre
- `POST /work-centres` - Create new work centre
- `PUT /work-centres/:id` - Update work centre
- `DELETE /work-centres/:id` - Delete work centre
- `PUT /work-centres/reorder` - Reorder work centres

### 4. Planning Board (`/api/planning-board`)

- `GET /planning-board` - Get complete planning board data
- `PUT /planning-board/move` - Move order via planning board
- `GET /planning-board/stats` - Get planning board statistics

### 5. Analytics (`/api/analytics`)

- `GET /analytics/overview` - Overall system metrics
- `GET /analytics/orders` - Order analytics
- `GET /analytics/work-centres` - Work centre performance
- `GET /analytics/utilization` - Capacity utilization metrics

### 6. User Management (`/api/users`) [Admin Only]

- `GET /users` - List all users
- `GET /users/:id` - Get specific user
- `POST /users` - Create new user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Deactivate user

### 7. API Keys (`/api/admin/api-keys`) [Admin Only]

- `GET /api-keys` - List API keys
- `POST /api-keys` - Create new API key
- `PUT /api-keys/:id` - Update API key
- `DELETE /api-keys/:id` - Revoke API key
- `POST /api-keys/:id/rotate` - Rotate API key

## Request/Response Format

### Content Type
All requests and responses use JSON format:
```http
Content-Type: application/json
```

### Standard Response Format

**Success Response:**
```json
{
  "message": "Operation successful",
  "data": {
    // Resource data
  }
}
```

**Error Response:**
```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "details": {
    // Optional error details
  }
}
```

## Filtering and Pagination

### Query Parameters

Most list endpoints support filtering via query parameters:

```http
GET /api/orders?status=in_progress&priority=high&work_centre_id=5&limit=20&offset=0
```

**Common Parameters:**
- `limit` - Number of items to return (default: 20, max: 100)
- `offset` - Number of items to skip
- `search` - Text search across relevant fields
- `sort` - Sort field (prefix with `-` for descending)

### Order Filtering
- `status` - Filter by order status (not_started, in_progress, complete, overdue, on_hold, cancelled)
- `priority` - Filter by priority (low, medium, high, urgent)
- `work_centre_id` - Filter by current work centre
- `due_before` - Filter by due date (ISO date string)
- `created_after` - Filter by creation date

### Work Centre Filtering
- `include_inactive` - Include inactive work centres (true/false)
- `has_capacity` - Filter by available capacity

## Real-time Updates

The API provides real-time updates via WebSocket connection on port 3001:

```javascript
const socket = io('http://localhost:3001');

// Listen for order updates
socket.on('orderMoved', (data) => {
  console.log('Order moved:', data);
});

// Listen for planning board changes
socket.on('planningBoardUpdate', (data) => {
  console.log('Planning board updated:', data);
});
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Global**: 1000 requests per 15 minutes
- **Authentication**: 25 login attempts per 15 minutes
- **API Keys**: 100 requests per 15 minutes per key
- **Admin Operations**: 500 requests per 15 minutes

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Error Handling

### HTTP Status Codes

- `200 OK` - Successful GET, PUT operations
- `201 Created` - Successful POST operations
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate data)
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Common Error Codes

See [Error Handling Documentation](./ERROR_HANDLING.md) for complete error code reference.

## Data Models

### Manufacturing Order
```json
{
  "id": 1,
  "order_number": "MO-2024-001",
  "stock_code": "PART-123",
  "description": "Widget Assembly",
  "quantity_to_make": 100,
  "quantity_completed": 25,
  "current_operation": "Machining",
  "current_work_centre_id": 3,
  "work_centre_position": 2,
  "status": "in_progress",
  "priority": "high",
  "due_date": "2024-12-31T23:59:59.000Z",
  "start_date": "2024-01-15T08:00:00.000Z",
  "completion_date": null,
  "created_by": 1,
  "created_at": "2024-01-01T10:00:00.000Z",
  "updated_at": "2024-01-15T14:30:00.000Z",
  "manufacturing_steps": [
    {
      "id": 1,
      "step_number": 1,
      "operation_name": "Cut to length",
      "work_centre_id": 2,
      "status": "complete",
      "planned_duration_minutes": 30,
      "actual_duration_minutes": 28
    }
  ]
}
```

### Work Centre
```json
{
  "id": 1,
  "name": "CNC Machining Centre 1",
  "code": "CNC-001",
  "description": "3-axis CNC mill for precision parts",
  "capacity": 10,
  "current_jobs": 7,
  "display_order": 1,
  "is_active": true,
  "created_at": "2024-01-01T10:00:00.000Z",
  "updated_at": "2024-01-01T10:00:00.000Z",
  "machines": [
    {
      "id": 1,
      "name": "Haas VF-2",
      "code": "HAAS-VF2-001",
      "description": "Vertical machining center",
      "is_active": true
    }
  ]
}
```

## Examples

### Create a New Order

```http
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "order_number": "MO-2024-002",
  "stock_code": "WIDGET-456",
  "description": "Premium Widget Assembly",
  "quantity_to_make": 50,
  "current_work_centre_id": 1,
  "priority": "high",
  "due_date": "2024-06-30T23:59:59.000Z",
  "manufacturing_steps": [
    {
      "step_number": 1,
      "operation_name": "Material prep",
      "work_centre_id": 1,
      "planned_duration_minutes": 45
    },
    {
      "step_number": 2,
      "operation_name": "Machining",
      "work_centre_id": 2,
      "planned_duration_minutes": 120
    }
  ]
}
```

### Move Order to Different Work Centre

```http
PUT /api/orders/123/move
Authorization: Bearer <token>
Content-Type: application/json

{
  "to_work_centre_id": 5,
  "reason": "Capacity optimization",
  "new_position": 2
}
```

### Get Planning Board Data

```http
GET /api/planning-board
Authorization: Bearer <token>
```

Response includes complete board state with work centres, orders, and current locks:

```json
{
  "workCentres": [...],
  "orders": [...],
  "ordersByWorkCentre": {...},
  "activeLocks": {},
  "summary": {
    "totalWorkCentres": 8,
    "totalOrders": 45,
    "totalActiveOrders": 32,
    "totalCompletedOrders": 13
  },
  "lastUpdated": "2024-01-15T14:30:00.000Z"
}
```

## Testing

### Health Check
```http
GET /health
```

Returns system status and can be used for monitoring:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "environment": "development"
}
```

### API Documentation
Interactive API documentation is available at:
- **Swagger UI**: `http://localhost:3001/api/docs`
- **JSON Schema**: `http://localhost:3001/api/docs.json`

## Best Practices

### 1. Use Appropriate HTTP Methods
- `GET` for retrieving data
- `POST` for creating new resources
- `PUT` for updating existing resources
- `DELETE` for removing resources

### 2. Include Request IDs
For debugging, include a unique request ID in headers:
```http
X-Request-ID: abc123-def456-ghi789
```

### 3. Handle Rate Limits
Implement exponential backoff when receiving 429 responses.

### 4. Use HTTPS in Production
Always use HTTPS for production deployments to protect sensitive data.

### 5. Validate Input Data
Client applications should validate data before sending to reduce unnecessary API calls.

## Support

For API support and questions:
- Review this documentation and error handling guide
- Check the interactive Swagger documentation
- Examine the test files for usage examples
- Contact the development team for integration assistance