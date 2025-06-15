# Manufacturing Planning Board API Documentation

## Overview

The Manufacturing Planning Board API provides a comprehensive REST interface for managing manufacturing orders, work centres, users, and analytics. Built with Node.js/Express and SQLite, it supports real-time updates via WebSocket connections.

## Base URL
```
http://localhost:3001/api
```

## Authentication

All API endpoints (except login/register) require JWT authentication via the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

### Obtaining a Token

**POST** `/auth/login`
```json
{
  "username": "scheduler1",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "scheduler1",
    "role": "scheduler",
    "first_name": "Test",
    "last_name": "Scheduler"
  }
}
```

## Roles & Permissions

- **admin**: Full access to all endpoints
- **scheduler**: Can manage orders, work centres, and view analytics
- **viewer**: Read-only access to orders and analytics

## Manufacturing Orders

### Get All Orders
**GET** `/orders`

**Query Parameters:**
- `status`: Filter by status (`not_started`, `in_progress`, `complete`, `overdue`, `on_hold`, `cancelled`)
- `priority`: Filter by priority (`low`, `medium`, `high`, `urgent`)
- `work_centre_id`: Filter by work centre ID
- `due_before`: Filter by due date (ISO date string)
- `search`: Search in order number, stock code, or description

**Example Request:**
```http
GET /api/orders?status=in_progress&priority=high
Authorization: Bearer <token>
```

**Response:**
```json
{
  "orders": [
    {
      "id": 1,
      "order_number": "MO-2024-001",
      "stock_code": "WIDGET-001",
      "description": "High Priority Widget Assembly",
      "quantity_to_make": 100,
      "quantity_completed": 25,
      "current_operation": "Assembly",
      "current_work_centre_id": 2,
      "work_centre_name": "Assembly Line 1",
      "status": "in_progress",
      "priority": "high",
      "due_date": "2024-12-31",
      "start_date": "2024-12-01",
      "created_by": 1,
      "created_at": "2024-12-01T10:00:00.000Z",
      "updated_at": "2024-12-15T14:30:00.000Z"
    }
  ],
  "count": 1
}
```

### Get Single Order
**GET** `/orders/:id`

**Response:**
```json
{
  "id": 1,
  "order_number": "MO-2024-001",
  "stock_code": "WIDGET-001",
  "description": "High Priority Widget Assembly",
  "quantity_to_make": 100,
  "quantity_completed": 25,
  "current_operation": "Assembly",
  "current_work_centre_id": 2,
  "work_centre_name": "Assembly Line 1",
  "status": "in_progress",
  "priority": "high",
  "due_date": "2024-12-31",
  "start_date": "2024-12-01",
  "created_by": 1,
  "created_at": "2024-12-01T10:00:00.000Z",
  "updated_at": "2024-12-15T14:30:00.000Z",
  "steps": [
    {
      "id": 1,
      "order_id": 1,
      "operation": "Assembly",
      "work_centre_id": 2,
      "status": "in_progress",
      "sequence": 1
    }
  ]
}
```

### Create Order
**POST** `/orders`

**Required Fields:**
- `order_number`: Unique order identifier
- `stock_code`: Product/part code
- `quantity_to_make`: Number of items to produce
- `current_work_centre_id`: Initial work centre ID

**Request:**
```json
{
  "order_number": "MO-2024-002",
  "stock_code": "WIDGET-002",
  "description": "Standard Widget Assembly",
  "quantity_to_make": 50,
  "current_operation": "Cutting",
  "current_work_centre_id": 1,
  "priority": "medium",
  "due_date": "2024-12-31",
  "start_date": "2024-12-01"
}
```

**Response:**
```json
{
  "id": 2,
  "order_number": "MO-2024-002",
  "stock_code": "WIDGET-002",
  "description": "Standard Widget Assembly",
  "quantity_to_make": 50,
  "quantity_completed": 0,
  "current_operation": "Cutting",
  "current_work_centre_id": 1,
  "status": "not_started",
  "priority": "medium",
  "due_date": "2024-12-31",
  "start_date": "2024-12-01",
  "created_by": 1,
  "created_at": "2024-12-15T15:00:00.000Z",
  "updated_at": "2024-12-15T15:00:00.000Z"
}
```

### Update Order
**PUT** `/orders/:id`

**Request:**
```json
{
  "description": "Updated Widget Assembly",
  "quantity_to_make": 75,
  "priority": "high",
  "status": "in_progress"
}
```

### Delete Order
**DELETE** `/orders/:id`

**Response:**
```json
{
  "message": "Order deleted successfully"
}
```

## Work Centres

### Get All Work Centres
**GET** `/work-centres`

**Response:**
```json
{
  "workCentres": [
    {
      "id": 1,
      "name": "Cutting Station",
      "code": "CUT-01",
      "description": "Primary cutting operations",
      "capacity": 3,
      "current_jobs": 2,
      "is_active": true,
      "display_order": 1,
      "created_at": "2024-12-01T10:00:00.000Z",
      "updated_at": "2024-12-01T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Create Work Centre
**POST** `/work-centres`

**Request:**
```json
{
  "name": "Assembly Line 2",
  "code": "ASM-02",
  "description": "Secondary assembly operations",
  "capacity": 5,
  "display_order": 3
}
```

## Planning Board

### Get Planning Board Data
**GET** `/planning-board`

**Response:**
```json
{
  "workCentres": [
    {
      "id": 1,
      "name": "Cutting Station",
      "code": "CUT-01",
      "capacity": 3,
      "current_jobs": 2,
      "orders": [
        {
          "id": 1,
          "order_number": "MO-2024-001",
          "stock_code": "WIDGET-001",
          "description": "High Priority Widget Assembly",
          "quantity_to_make": 100,
          "quantity_completed": 25,
          "status": "in_progress",
          "priority": "high",
          "due_date": "2024-12-31"
        }
      ]
    }
  ],
  "summary": {
    "total_orders": 15,
    "in_progress": 8,
    "not_started": 5,
    "overdue": 2
  }
}
```

### Move Order Between Work Centres
**PUT** `/planning-board/move`

**Request:**
```json
{
  "order_id": 1,
  "from_work_centre_id": 1,
  "to_work_centre_id": 2,
  "new_operation": "Assembly"
}
```

## Analytics

### Get Dashboard Statistics
**GET** `/analytics/dashboard`

**Response:**
```json
{
  "summary": {
    "total_orders": 150,
    "in_progress": 45,
    "completed_this_week": 23,
    "overdue": 8,
    "total_work_centres": 6,
    "active_work_centres": 5,
    "average_completion_time": 5.2
  },
  "status_breakdown": {
    "not_started": 32,
    "in_progress": 45,
    "complete": 65,
    "overdue": 8
  },
  "priority_breakdown": {
    "low": 25,
    "medium": 78,
    "high": 35,
    "urgent": 12
  },
  "work_centre_utilization": [
    {
      "work_centre_id": 1,
      "name": "Cutting Station",
      "capacity": 3,
      "current_jobs": 2,
      "utilization_percentage": 66.7
    }
  ]
}
```

## User Management

### Get All Users (Admin Only)
**GET** `/users`

**Response:**
```json
{
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "first_name": "System",
      "last_name": "Administrator",
      "is_active": true,
      "created_at": "2024-12-01T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Create User (Admin Only)
**POST** `/users`

**Request:**
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "securepassword",
  "role": "scheduler",
  "first_name": "New",
  "last_name": "User"
}
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details (optional)"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` (400): Request validation failed
- `UNAUTHORIZED` (401): Authentication required
- `INVALID_TOKEN` (401): JWT token invalid or expired
- `INSUFFICIENT_PERMISSIONS` (403): User lacks required permissions
- `NOT_FOUND` (404): Resource not found
- `DUPLICATE_ORDER_NUMBER` (409): Order number already exists
- `DUPLICATE_CODE` (409): Work centre code already exists
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

### Validation Error Example

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "order_number": "Order number is required",
    "quantity_to_make": "Quantity must be a positive number"
  }
}
```

## Rate Limiting

- **API Endpoints**: 100 requests per 15 minutes per IP
- **Authentication Endpoints**: 5 requests per 15 minutes per IP

## WebSocket Events

Real-time updates are available via WebSocket connection:

**Connection:** `ws://localhost:3001`

**Events:**
- `order_created`: New order added
- `order_updated`: Order modified
- `order_moved`: Order moved between work centres
- `work_centre_updated`: Work centre modified

**Example Event:**
```json
{
  "event": "order_updated",
  "data": {
    "id": 1,
    "order_number": "MO-2024-001",
    "status": "complete",
    "updated_by": "scheduler1"
  }
}
```

## API Keys (External Integration)

### Create API Key (Admin Only)
**POST** `/api-keys`

**Request:**
```json
{
  "system_id": "erp_system",
  "description": "ERP System Integration",
  "permissions": ["orders:read", "orders:write"],
  "allowed_ips": ["192.168.1.100"]
}
```

### Use API Key Authentication

Instead of JWT token, include API key in header:
```http
X-API-Key: api_key_here
```

## Best Practices

1. **Always handle errors**: Check response status codes and error messages
2. **Use appropriate HTTP methods**: GET for reading, POST for creating, PUT for updating, DELETE for removing
3. **Include pagination**: For large datasets, use query parameters for pagination
4. **Cache responses**: Cache GET responses when appropriate to reduce server load
5. **Handle rate limits**: Implement retry logic with exponential backoff
6. **Validate input**: Client-side validation improves user experience
7. **Use HTTPS**: Always use HTTPS in production environments

## Support

For API support, please refer to the error messages and status codes. All endpoints return detailed error information to help with debugging and integration.