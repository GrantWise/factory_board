# Error Handling Guide

This document outlines the error handling patterns and best practices used in the Manufacturing Planning Board API.

## Architecture Overview

The API uses a centralized error handling approach with consistent error response formats across all endpoints:

```
Request → Route → Middleware → Controller → Model → Database
                     ↓
                Error Handler Middleware
                     ↓
                Standardized Error Response
```

## Error Handler Middleware

All errors are processed by the centralized error handler located in `src/middleware/errorHandler.js`:

```javascript
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const errorResponse = {
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR'
  };
  
  if (err.details) {
    errorResponse.details = err.details;
  }
  
  res.status(status).json(errorResponse);
}
```

## Error Response Format

All API errors follow this consistent structure:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "details": {
    "field": "Additional context (optional)"
  }
}
```

### Examples

**Validation Error:**
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

**Not Found Error:**
```json
{
  "error": "Order not found",
  "code": "NOT_FOUND"
}
```

**Conflict Error:**
```json
{
  "error": "Order number already exists",
  "code": "DUPLICATE_ORDER_NUMBER"
}
```

## HTTP Status Codes

The API uses standard HTTP status codes with specific meanings:

### 400 Bad Request
- **Usage**: Client errors, validation failures, malformed requests
- **Common Codes**: `VALIDATION_ERROR`, `CREATION_FAILED`, `UPDATE_FAILED`

### 401 Unauthorized
- **Usage**: Authentication required or failed
- **Common Codes**: `UNAUTHORIZED`, `INVALID_TOKEN`, `LOGIN_FAILED`

### 403 Forbidden
- **Usage**: User lacks required permissions
- **Common Codes**: `INSUFFICIENT_PERMISSIONS`, `ACCESS_DENIED`

### 404 Not Found
- **Usage**: Requested resource doesn't exist
- **Common Codes**: `NOT_FOUND`, `ORDER_NOT_FOUND`, `USER_NOT_FOUND`

### 409 Conflict
- **Usage**: Resource conflicts, business rule violations
- **Common Codes**: `DUPLICATE_ORDER_NUMBER`, `DUPLICATE_CODE`, `HAS_ASSIGNED_JOBS`

### 429 Too Many Requests
- **Usage**: Rate limiting triggered
- **Common Codes**: `RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`

### 500 Internal Server Error
- **Usage**: Server errors, database failures, unexpected errors
- **Common Codes**: `INTERNAL_ERROR`, `DATABASE_ERROR`, `FETCH_FAILED`

## Controller Error Patterns

### Recommended Pattern

All controllers should use `next(err)` to propagate errors to the centralized handler:

```javascript
async function createOrder(req, res, next) {
  try {
    // Validation
    if (!req.body.order_number) {
      return next({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Order number is required'
      });
    }
    
    // Business logic
    const order = await ManufacturingOrder.create(req.body);
    res.status(201).json(order);
    
  } catch (error) {
    // Handle known errors
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return next({
        status: 409,
        code: 'DUPLICATE_ORDER_NUMBER',
        message: 'Order number already exists'
      });
    }
    
    // Handle unexpected errors
    next({
      status: 500,
      code: 'CREATION_FAILED',
      message: error.message
    });
  }
}
```

### Error Object Structure

When calling `next(err)`, use this structure:

```javascript
{
  status: number,     // HTTP status code
  code: string,       // Machine-readable error code
  message: string,    // Human-readable error message
  details?: object    // Optional additional context
}
```

## Common Error Scenarios

### 1. Validation Errors

Handled by validation middleware before reaching controllers:

```javascript
// In validation middleware
if (validationResult.error) {
  return next({
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: formatValidationErrors(validationResult.error)
  });
}
```

### 2. Database Constraint Violations

```javascript
catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return next({
      status: 409,
      code: 'DUPLICATE_ORDER_NUMBER',
      message: 'Order number already exists'
    });
  }
  
  if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return next({
      status: 400,
      code: 'INVALID_REFERENCE',
      message: 'Referenced resource does not exist'
    });
  }
}
```

### 3. Resource Not Found

```javascript
const order = await ManufacturingOrder.findById(id);
if (!order) {
  return next({
    status: 404,
    code: 'NOT_FOUND',
    message: 'Order not found'
  });
}
```

### 4. Business Rule Violations

```javascript
if (workCentre.current_jobs > 0) {
  return next({
    status: 409,
    code: 'HAS_ASSIGNED_JOBS',
    message: `Cannot delete work centre with ${workCentre.current_jobs} assigned job(s)`
  });
}
```

### 5. Authentication Errors

```javascript
// In auth middleware
if (!token) {
  return next({
    status: 401,
    code: 'UNAUTHORIZED',
    message: 'Authentication required'
  });
}

if (!jwt.verify(token, secret)) {
  return next({
    status: 401,
    code: 'INVALID_TOKEN',
    message: 'Invalid or expired token'
  });
}
```

### 6. Permission Errors

```javascript
// In permissions middleware
if (!hasPermission(user.role, requiredPermission)) {
  return next({
    status: 403,
    code: 'INSUFFICIENT_PERMISSIONS',
    message: 'Insufficient permissions'
  });
}
```

## Error Logging

### Server Errors (500+)

Server errors are automatically logged by the error handler:

```javascript
if (status >= 500) {
  console.error('Server Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id
  });
}
```

### Security Events

Security-related errors should be logged with additional context:

```javascript
// In auth middleware
if (authAttempts > 5) {
  logger.warn('Multiple failed login attempts', {
    ip: req.ip,
    username: req.body.username,
    attempts: authAttempts
  });
}
```

## Best Practices

### 1. Consistent Error Codes

Use consistent, descriptive error codes:

```javascript
// Good
'DUPLICATE_ORDER_NUMBER'
'INSUFFICIENT_PERMISSIONS'
'VALIDATION_ERROR'

// Avoid
'ERROR_001'
'FAILED'
'BAD_REQUEST'
```

### 2. Meaningful Error Messages

Provide clear, actionable error messages:

```javascript
// Good
'Order number is required'
'Work centre capacity must be a positive number'
'Cannot delete work centre with assigned jobs'

// Avoid
'Invalid input'
'Operation failed'
'Error occurred'
```

### 3. Don't Leak Sensitive Information

```javascript
// Good
'Login failed'
'Access denied'
'Invalid token'

// Avoid
'Password incorrect for user john@example.com'
'User does not exist'
'JWT signature invalid: <detailed error>'
```

### 4. Include Relevant Context

```javascript
// Good
next({
  status: 409,
  code: 'HAS_ASSIGNED_JOBS',
  message: `Cannot delete work centre with ${workCentre.current_jobs} assigned job(s)`,
  details: {
    work_centre_id: workCentre.id,
    assigned_jobs: workCentre.current_jobs
  }
});
```

### 5. Handle Async Errors

Always wrap async operations in try/catch:

```javascript
// Good
async function updateOrder(req, res, next) {
  try {
    const order = await ManufacturingOrder.findById(req.params.id);
    // ... rest of logic
  } catch (error) {
    next(error);
  }
}

// Avoid - unhandled promise rejection
async function updateOrder(req, res, next) {
  const order = await ManufacturingOrder.findById(req.params.id);
  // ... rest of logic
}
```

## Testing Error Handling

### Unit Tests

Test error scenarios in controllers:

```javascript
describe('OrdersController', () => {
  it('should return 404 when order not found', async () => {
    const response = await request(app)
      .get('/api/orders/999999')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});
```

### Integration Tests

Test error responses through the full middleware stack:

```javascript
it('should handle validation errors', async () => {
  const response = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  
  expect(response.status).toBe(400);
  expect(response.body.code).toBe('VALIDATION_ERROR');
  expect(response.body.details).toBeDefined();
});
```

## Monitoring and Alerting

### Error Rate Monitoring

Monitor error rates by status code:

```javascript
// Example metrics
errorRate_4xx: 2.5%  // Client errors
errorRate_5xx: 0.1%  // Server errors
```

### Alert Thresholds

Set up alerts for:
- 5xx error rate > 1%
- 4xx error rate > 10%
- Specific error codes (e.g., authentication failures)

### Log Aggregation

Structured logging for better analysis:

```javascript
logger.error('Order creation failed', {
  error_code: 'CREATION_FAILED',
  user_id: req.user.id,
  order_data: sanitizeOrderData(req.body),
  timestamp: new Date().toISOString()
});
```

## Conclusion

Consistent error handling improves:
- **Developer Experience**: Clear error messages aid debugging
- **User Experience**: Meaningful feedback helps users understand issues
- **Maintainability**: Centralized handling reduces code duplication
- **Monitoring**: Structured errors enable better observability

Follow these patterns to maintain consistency and reliability across the API.