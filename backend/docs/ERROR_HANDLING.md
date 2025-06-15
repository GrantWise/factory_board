# Error Handling Documentation

## Overview

This document outlines the error handling strategy and patterns used throughout the Manufacturing Planning Board backend API.

## Error Handling Strategy

The application uses a **centralized error handling approach** with consistent error response formats and proper error propagation.

### Key Principles

1. **Centralized Error Handler**: All errors are processed by a single middleware (`src/middleware/errorHandler.js`)
2. **Consistent Error Format**: All error responses follow the same JSON structure
3. **Error Propagation**: Controllers use `next(err)` to pass errors to the centralized handler
4. **Structured Error Objects**: Errors include status codes, error codes, and descriptive messages
5. **Security**: Sensitive information is never exposed in error responses

## Error Response Format

All errors return a consistent JSON structure:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "details": {
    // Optional additional error details
  }
}
```

### Standard HTTP Status Codes

- **400 Bad Request**: Client error, invalid input, validation failures
- **401 Unauthorized**: Authentication required or failed
- **403 Forbidden**: Authentication succeeded but access denied
- **404 Not Found**: Resource does not exist
- **409 Conflict**: Resource conflict (e.g., duplicate data)
- **423 Locked**: Resource is locked (e.g., order being moved)
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error, database issues, unexpected errors

### Common Error Codes

#### Authentication & Authorization
- `AUTH_REQUIRED` - Access token required
- `INVALID_TOKEN` - Token is invalid or expired
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `API_KEY_REQUIRED` - API key authentication required
- `INVALID_API_KEY` - API key is invalid or expired

#### Validation
- `VALIDATION_ERROR` - Request data validation failed
- `INVALID_ID` - Invalid ID parameter
- `MISSING_REQUIRED_FIELD` - Required field is missing

#### Resource Management
- `NOT_FOUND` - Resource not found
- `DUPLICATE_ORDER_NUMBER` - Order number already exists
- `DUPLICATE_CODE` - Work centre code already exists
- `CONFLICT` - Resource conflict

#### Business Logic
- `INVALID_WORK_CENTRE` - Work centre ID is invalid
- `HAS_ASSIGNED_JOBS` - Cannot delete work centre with assigned jobs
- `ORDER_LOCKED` - Order is locked for editing
- `INVALID_STATUS_TRANSITION` - Status change is not allowed

#### System Errors
- `INTERNAL_ERROR` - Unexpected server error
- `DATABASE_ERROR` - Database operation failed
- `FETCH_FAILED` - Data retrieval failed
- `UPDATE_FAILED` - Data update failed
- `DELETE_FAILED` - Data deletion failed

## Error Handling Patterns

### 1. Controller Pattern

Controllers catch errors and pass them to the centralized error handler:

```javascript
async createOrder(req, res, next) {
  try {
    const orderData = req.body;
    const order = await OrderService.createOrder(orderData, req.user.id);
    
    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    // Pass error to centralized handler
    next({ 
      status: 400, 
      code: 'CREATION_FAILED', 
      message: error.message 
    });
  }
}
```

### 2. Service Layer Pattern

Services throw descriptive errors that controllers can catch and format:

```javascript
async createOrder(orderData, userId) {
  // Validate order data
  const validation = this.validateOrderData(orderData);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  // Check for duplicates
  if (this.hasOrderNumberConflict(orderData.order_number)) {
    throw new Error('Order number already exists');
  }

  // ... rest of creation logic
}
```

### 3. Model Layer Pattern

Models handle database errors and provide meaningful error messages:

```javascript
create(orderData) {
  try {
    const stmt = this.db.prepare(`INSERT INTO orders (...) VALUES (...)`);
    const result = stmt.run(...params);
    return this.findById(result.lastInsertRowid);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error('Order number already exists');
    }
    throw new Error(`Database error: ${error.message}`);
  }
}
```

### 4. Validation Middleware Pattern

Validation errors are handled immediately and don't reach controllers:

```javascript
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: formatValidationErrors(error)
    });
  }
  
  req.body = value;
  next();
};
```

## Best Practices

### 1. Always Use Structured Error Objects

```javascript
// Good
next({
  status: 404,
  code: 'ORDER_NOT_FOUND',
  message: 'Order not found'
});

// Bad
next(new Error('Order not found'));
```

### 2. Provide Meaningful Error Messages

```javascript
// Good
throw new Error('Cannot delete work centre with 5 assigned jobs. Please move or complete these jobs first.');

// Bad
throw new Error('Delete failed');
```

### 3. Use Appropriate Status Codes

```javascript
// Resource not found
next({ status: 404, code: 'NOT_FOUND', message: 'Order not found' });

// Validation error
next({ status: 400, code: 'VALIDATION_ERROR', message: 'Invalid data' });

// Authorization error
next({ status: 403, code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' });
```

### 4. Log Errors Appropriately

```javascript
// Log server errors (500+) for debugging
if (status >= 500) {
  logger.error('Server error occurred', { 
    error: err.message, 
    stack: err.stack,
    requestId: req.id 
  });
}

// Don't log client errors (400-499) as they're user mistakes
```

### 5. Handle Async Errors

```javascript
// Always use try-catch with async operations
async function processOrder(orderId) {
  try {
    const order = await ManufacturingOrder.findById(orderId);
    // ... processing logic
  } catch (error) {
    logger.error('Order processing failed', { order_id: orderId, error: error.message });
    throw error; // Re-throw to be handled by controller
  }
}
```

## Security Considerations

### 1. Never Expose Sensitive Information

```javascript
// Good - Generic error message
res.status(401).json({
  error: 'Invalid credentials',
  code: 'LOGIN_FAILED'
});

// Bad - Reveals whether user exists
res.status(401).json({
  error: 'Password incorrect for user john@example.com',
  code: 'INVALID_PASSWORD'
});
```

### 2. Sanitize Error Messages

```javascript
// Remove potentially sensitive data from error messages
function sanitizeError(error) {
  // Remove SQL query details, file paths, etc.
  return error.message.replace(/SQLITE_\w+:/g, 'Database error:');
}
```

### 3. Rate Limit Error Responses

The application includes rate limiting to prevent abuse through error-inducing requests.

## Testing Error Handling

### 1. Test Expected Errors

```javascript
describe('Order Creation', () => {
  it('should return 409 for duplicate order number', async () => {
    // Create first order
    await request(app)
      .post('/api/orders')
      .send(orderData)
      .expect(201);

    // Try to create duplicate
    const response = await request(app)
      .post('/api/orders')
      .send(orderData)
      .expect(409);

    expect(response.body.code).toBe('DUPLICATE_ORDER_NUMBER');
  });
});
```

### 2. Test Error Response Format

```javascript
it('should return properly formatted error response', async () => {
  const response = await request(app)
    .get('/api/orders/invalid-id')
    .expect(400);

  expect(response.body).toHaveProperty('error');
  expect(response.body).toHaveProperty('code');
  expect(typeof response.body.error).toBe('string');
  expect(typeof response.body.code).toBe('string');
});
```

## Monitoring and Debugging

### 1. Error Logging

All server errors (500+) are automatically logged with:
- Timestamp
- Error message and stack trace
- Request context (URL, method, user ID)
- Correlation ID for tracing

### 2. Error Metrics

Consider implementing metrics for:
- Error rates by endpoint
- Most common error types
- Error response times
- Failed authentication attempts

### 3. Alerting

Set up alerts for:
- High error rates (>5% of requests)
- Database connection failures
- Authentication system failures
- Critical business logic errors

## Conclusion

Consistent error handling improves:
- **User Experience**: Clear, actionable error messages
- **Developer Experience**: Predictable error formats for frontend integration
- **Maintainability**: Centralized error logic reduces code duplication
- **Security**: Controlled error disclosure prevents information leakage
- **Debugging**: Structured logging aids in problem resolution

Follow these patterns when adding new endpoints or modifying existing error handling logic.