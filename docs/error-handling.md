# Error Handling Guide

This document outlines the standardized error handling patterns used throughout the Manufacturing Planning Board application.

## Backend Error Handling

### Error Response Format

All API errors follow this standard format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {} // Optional additional error details
}
```

### Error Propagation

1. **Controllers**: Use `next(err)` to propagate errors to the centralized error handler:
   ```javascript
   try {
     // ... controller logic ...
   } catch (error) {
     next({
       status: 400,
       code: 'OPERATION_FAILED',
       message: error.message
     });
   }
   ```

2. **Validation Errors**: Use the validation middleware for input validation:
   ```javascript
   const validate = (schema, source = 'body') => {
     return (req, res, next) => {
       const { error, value } = schema.validate(req[source]);
       if (error) {
         return res.status(400).json({
           error: 'Validation failed',
           code: 'VALIDATION_ERROR',
           details: error.details
         });
       }
       next();
     };
   };
   ```

### Common Error Codes

- `VALIDATION_ERROR`: Input validation failed
- `NOT_FOUND`: Resource not found
- `AUTH_REQUIRED`: Authentication required
- `INVALID_TOKEN`: Invalid or expired token
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `CONFLICT`: Resource conflict (e.g., duplicate entry)
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Unexpected server error

## Frontend Error Handling

### Using the Notification System

1. **Error Notifications**:
   ```typescript
   notify.error(error, {
     operation: 'create_order',
     entity: 'order'
   });
   ```

2. **Success Notifications**:
   ```typescript
   notify.success({
     operation: 'create_order',
     entity: 'order',
     id: orderId
   });
   ```

### Error Context

Provide context for better error messages:

```typescript
interface ErrorContext {
  operation: string;    // e.g., 'create_order', 'update_user'
  entity?: string;      // e.g., 'order', 'user'
  id?: string | number; // Optional resource identifier
  additionalInfo?: Record<string, any>; // Additional context
}
```

### Common Operations

- `create_order`
- `update_order`
- `delete_order`
- `move_order`
- `create_user`
- `update_user`
- `delete_user`
- `import_orders`

## Testing Error Handling

### Unit Tests

1. **Controller Error Tests**:
   ```javascript
   it('should handle validation errors', async () => {
     const response = await request(app)
       .post('/api/orders')
       .send({});
     expect(response.status).toBe(400);
     expect(response.body.code).toBe('VALIDATION_ERROR');
   });
   ```

2. **Frontend Error Tests**:
   ```typescript
   it('should display error notification', () => {
     const error = {
       status: 400,
       code: 'VALIDATION_ERROR',
       message: 'Invalid input'
     };
     notify.error(error, { operation: 'create_order' });
     // Assert toast notification
   });
   ```

### Integration Tests

1. **API Error Flow**:
   - Test authentication errors
   - Test validation errors
   - Test permission errors
   - Test conflict errors
   - Test server errors

2. **Frontend Error Flow**:
   - Test error notifications
   - Test error boundaries
   - Test retry mechanisms
   - Test offline handling

## Best Practices

1. **Backend**:
   - Always use `next(err)` in controllers
   - Include meaningful error codes
   - Add context to error messages
   - Log server errors appropriately

2. **Frontend**:
   - Use the `notify` utility for all errors
   - Provide operation and entity context
   - Handle network errors gracefully
   - Show user-friendly messages

3. **Testing**:
   - Test all error scenarios
   - Verify error messages
   - Check error logging
   - Test error recovery

## Error Monitoring

1. **Backend Logging**:
   - Log all 500-level errors
   - Include request context
   - Track error frequency
   - Monitor error patterns

2. **Frontend Monitoring**:
   - Track error frequency
   - Monitor user impact
   - Identify common errors
   - Measure error recovery 