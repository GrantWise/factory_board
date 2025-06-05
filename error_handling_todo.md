# Error Handling Improvement Todo

## Overview
This document outlines specific tasks to improve error handling consistency and user experience across the manufacturing planning board application. The current implementation has a strong foundation but needs standardization and some missing components.

## Current State Assessment
- ✅ Strong centralized error utility (`frontend/src/lib/error-handling.ts`)
- ✅ Consistent backend error middleware (`backend/src/middleware/errorHandler.js`)
- ✅ Good API error structure (status, code, error, details)
- ✅ Comprehensive Joi validation with detailed responses
- ❌ Inconsistent usage of centralized error utility
- ❌ Mixed toast notification systems
- ❌ Missing global error boundaries
- ❌ No global API error interceptor

---

## Phase 1: Critical Consistency Fixes (High Impact, Low Effort)

### 1.1 Standardize Frontend Error Handling Usage
**Priority: CRITICAL**
**Estimated Effort: 2-3 hours**

**Problem**: Components manually parse errors instead of using the centralized `getErrorMessage()` utility.

**Files to Update**:
- `frontend/src/components/planning-board.tsx` (lines 563-608, 624-667)
- `frontend/src/components/orders-table.tsx`
- `frontend/src/contexts/auth-context.tsx`
- Any other components with manual error parsing

**Current Pattern (BAD)**:
```typescript
catch (error: unknown) {
  let errorMessage = 'Failed to save column order'
  if (error && typeof error === 'object') {
    const err = error as { status?: number; code?: string; error?: string; message?: string }
    if (err.status === 401 || err.code === 'INVALID_TOKEN') {
      errorMessage = 'Authentication required. Please log in again.'
    } else if (err.status === 403) {
      errorMessage = 'Permission denied...'
    }
    // ... more manual parsing
  }
  toast.error(errorMessage)
}
```

**Target Pattern (GOOD)**:
```typescript
import { getErrorMessage, type AppError, type ErrorContext } from '@/lib/error-handling'

catch (error: unknown) {
  const errorMessage = getErrorMessage(error as AppError, {
    operation: 'reorder_work_centres',  // Use specific operation
    entity: 'work centres'
  })
  toast.error(errorMessage)
}
```

**Steps**:
1. Search for manual error parsing patterns: `grep -r "err.status" frontend/src/components/`
2. Replace each instance with `getErrorMessage()` call
3. Import the error handling utility where needed
4. Use appropriate operation names from the existing error utility

### 1.2 Unify Toast Notification System
**Priority: CRITICAL**
**Estimated Effort: 1-2 hours**

**Problem**: Application uses both Sonner (`toast`) and custom hook (`useToast`).

**Decision**: Standardize on Sonner for consistency.

**Files to Update**:
- Search for `useToast` usage: `grep -r "useToast" frontend/src/`
- Replace with Sonner `toast` imports

**Steps**:
1. Create notification utility wrapper at `frontend/src/lib/notifications.ts`:
```typescript
import { toast } from 'sonner'
import { getErrorMessage, getSuccessMessage, type AppError, type ErrorContext } from './error-handling'

export const notify = {
  error: (error: AppError | string, context?: ErrorContext) => {
    const message = typeof error === 'string' 
      ? error 
      : getErrorMessage(error, context)
    toast.error(message)
  },
  
  success: (context: ErrorContext) => {
    const message = getSuccessMessage(context)
    toast.success(message)
  },
  
  info: (message: string) => toast.info(message),
  warning: (message: string) => toast(message, { style: { background: '#fbbf24' } })
}
```

2. Replace all `useToast` imports with the new notification utility
3. Update all error handling to use `notify.error(error, context)`
4. Update all success notifications to use `notify.success(context)`

### 1.3 Fix Backend Error Consistency
**Priority: HIGH**
**Estimated Effort: 1 hour**

**Problem**: Some controllers return errors directly instead of using centralized error handler.

**Files to Audit**:
- `backend/src/controllers/ordersController.js` (lines 51-54, 74-77, 131-134)
- `backend/src/controllers/authController.js`
- `backend/src/controllers/workCentresController.js`

**Search Pattern**: `return res.status(4` or `return res.status(5`

**Current Pattern (BAD)**:
```javascript
if (!order) {
  return res.status(404).json({
    error: 'Order not found',
    code: 'NOT_FOUND'
  });
}
```

**Target Pattern (GOOD)**:
```javascript
if (!order) {
  return next({ 
    status: 404, 
    code: 'NOT_FOUND', 
    message: 'Order not found' 
  });
}
```

**Steps**:
1. Search for direct error responses: `grep -r "res.status(4\|res.status(5" backend/src/controllers/`
2. Replace each with `next(err)` pattern
3. Ensure error objects have `status`, `code`, and `message` properties

---

## Phase 2: Major Infrastructure Improvements (High Impact, Medium Effort)

### 2.1 Add Global Error Boundary
**Priority: HIGH**
**Estimated Effort: 2-3 hours**

**Problem**: No React Error Boundary to catch JavaScript errors gracefully.

**Create**: `frontend/src/components/error-boundary.tsx`

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    
    // Log error to monitoring service
    console.error('React Error Boundary caught an error:', error, errorInfo)
    
    // TODO: Send to error monitoring service (Sentry, LogRocket, etc.)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. Please try refreshing the page.
              </p>
              
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
                variant="outline"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Page
              </Button>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Integration Steps**:
1. Wrap main application in `frontend/src/app/layout.tsx`:
```typescript
import { ErrorBoundary } from '@/components/error-boundary'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          {/* existing content */}
        </ErrorBoundary>
      </body>
    </html>
  )
}
```

2. Add error boundaries around critical components like PlanningBoard

### 2.2 Implement Global API Error Interceptor
**Priority: HIGH**
**Estimated Effort: 2-3 hours**

**Problem**: No centralized handling of common API errors (401, 500, etc.).

**Enhance**: `frontend/src/lib/api.ts`

**Add Global Error Handling**:
```typescript
import { notify } from './notifications'

class ApiClient {
  // ... existing code

  private async handleResponse<T>(response: Response, data: any): Promise<T> {
    if (!response.ok) {
      const error = {
        error: data.error || 'API request failed',
        code: data.code || 'API_ERROR',
        status: response.status,
        details: data.details,
      } as ApiError & { status: number }

      // Global error handling
      await this.handleGlobalErrors(error)
      
      throw error
    }

    return data
  }

  private async handleGlobalErrors(error: ApiError & { status: number }) {
    switch (error.status) {
      case 401:
        // Global logout for expired tokens
        if (error.code === 'INVALID_TOKEN') {
          console.warn('Token expired, logging out user')
          this.setToken(null)
          // Redirect to login if not already there
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login'
          }
        }
        break
        
      case 429:
        // Rate limiting - show global notification
        notify.warning('Too many requests. Please wait a moment.')
        break
        
      case 500:
      case 502:
      case 503:
        // Server errors - show global notification
        notify.error('Server error. Please try again later.')
        break
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // ... existing fetch logic
    
    try {
      const response = await fetch(url, config)
      const data = await response.json()
      
      return this.handleResponse<T>(response, data)
    } catch (error) {
      if (error instanceof TypeError) {
        // Network error
        const networkError = {
          error: 'Network error - please check your connection',
          code: 'NETWORK_ERROR',
          status: 0,
        } as ApiError & { status: number }
        
        // Global network error handling
        await this.handleGlobalErrors(networkError)
        throw networkError
      }
      throw error
    }
  }
}
```

### 2.3 Add Basic Error Monitoring
**Priority: MEDIUM**
**Estimated Effort: 1-2 hours**

**Create**: `frontend/src/lib/error-monitoring.ts`

```typescript
import { AppError, ErrorContext, shouldLogError } from './error-handling'

interface ErrorLogEntry {
  error: AppError
  context?: ErrorContext
  timestamp: string
  url: string
  userAgent: string
  userId?: string
}

export const logError = (error: AppError, context?: ErrorContext) => {
  if (!shouldLogError(error)) {
    return
  }

  const logEntry: ErrorLogEntry = {
    error,
    context,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
    // Add user ID if available from auth context
  }

  // Console logging for development
  if (process.env.NODE_ENV === 'development') {
    console.group(`🚨 Application Error - ${error.code || 'UNKNOWN'}`)
    console.error('Error:', error)
    console.log('Context:', context)
    console.log('Full Log Entry:', logEntry)
    console.groupEnd()
  }

  // TODO: Send to monitoring service in production
  // Examples: Sentry, LogRocket, DataDog, etc.
  // sentry.captureException(error, { extra: logEntry })
}

// Hook into the notification system
export const logAndNotifyError = (error: AppError, context?: ErrorContext) => {
  logError(error, context)
  // Continue with normal error notification
}
```

**Integration**: Update notification utility to include logging.

---

## Phase 3: Enhanced Features (Medium Impact, Higher Effort)

### 3.1 Add Retry Mechanisms
**Priority: MEDIUM**
**Estimated Effort: 3-4 hours**

**Create**: `frontend/src/lib/retry.ts`

```typescript
import { isNetworkError, type AppError } from './error-handling'

interface RetryOptions {
  maxRetries?: number
  backoffMultiplier?: number
  initialDelay?: number
  isRetryable?: (error: AppError) => boolean
}

export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxRetries = 3,
    backoffMultiplier = 2,
    initialDelay = 1000,
    isRetryable = isNetworkError
  } = options

  let lastError: AppError
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as AppError
      
      if (attempt === maxRetries || !isRetryable(lastError)) {
        throw lastError
      }
      
      const delay = initialDelay * Math.pow(backoffMultiplier, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}

// Specific retry wrapper for API calls
export const apiWithRetry = <T>(apiCall: () => Promise<T>) => 
  withRetry(apiCall, {
    isRetryable: (error) => 
      isNetworkError(error) || 
      error.status === 429 || 
      (error.status >= 500 && error.status < 600)
  })
```

**Usage Example**:
```typescript
// In components
const result = await apiWithRetry(() => ordersService.reorder(columnId, orderPositions))
```

### 3.2 Add Network Status Detection
**Priority: LOW**
**Estimated Effort: 2-3 hours**

**Create**: `frontend/src/hooks/use-network-status.ts`

```typescript
import { useState, useEffect } from 'react'

interface NetworkStatus {
  isOnline: boolean
  isSlowConnection: boolean
  connectionType?: string
}

export const useNetworkStatus = (): NetworkStatus => {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSlowConnection: false
  })

  useEffect(() => {
    const updateNetworkStatus = () => {
      setStatus(prev => ({
        ...prev,
        isOnline: navigator.onLine
      }))
    }

    // Check for slow connection
    const checkConnectionSpeed = () => {
      const connection = (navigator as any).connection
      if (connection) {
        setStatus(prev => ({
          ...prev,
          isSlowConnection: connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g',
          connectionType: connection.effectiveType
        }))
      }
    }

    window.addEventListener('online', updateNetworkStatus)
    window.addEventListener('offline', updateNetworkStatus)
    
    checkConnectionSpeed()

    return () => {
      window.removeEventListener('online', updateNetworkStatus)
      window.removeEventListener('offline', updateNetworkStatus)
    }
  }, [])

  return status
}
```

**UI Component**: Create offline indicator for when network is unavailable.

### 3.3 Enhanced Backend Error Context
**Priority: LOW**
**Estimated Effort: 1-2 hours**

**Enhance**: `backend/src/middleware/errorHandler.js`

```javascript
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  
  const errorResponse = {
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Add details for validation errors
  if (err.details) {
    errorResponse.details = err.details;
  }

  // Add request context for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    errorResponse.context = {
      user_id: req.user?.id,
      ip: req.ip,
      user_agent: req.get('User-Agent')
    };
  }

  // Enhanced logging with context
  if (status >= 500) {
    console.error('Server Error:', {
      error: err,
      context: errorResponse.context,
      stack: err.stack
    });
  }

  res.status(status).json(errorResponse);
}
```

---

## Testing Requirements

### Unit Tests to Add
- Test error boundary component
- Test retry mechanism with various error scenarios
- Test notification utility with different error types
- Test global API error interceptor

### Integration Tests to Add
- End-to-end error handling flow
- Network error simulation
- Authentication error handling
- Permission error handling

### Manual Testing Checklist
- [ ] Simulate network disconnection
- [ ] Test with invalid authentication tokens
- [ ] Test with insufficient permissions
- [ ] Test server errors (500, 502, 503)
- [ ] Test rate limiting (429)
- [ ] Test validation errors (422)
- [ ] Test JavaScript errors (throw in component)

---

## Completion Checklist

### Phase 1 (Critical)
- [ ] Update planning-board.tsx to use getErrorMessage()
- [ ] Update orders-table.tsx to use getErrorMessage()
- [ ] Update auth-context.tsx to use getErrorMessage()
- [ ] Create notifications.ts utility
- [ ] Replace all useToast with Sonner
- [ ] Fix backend controller error responses

### Phase 2 (Major)
- [ ] Implement ErrorBoundary component
- [ ] Add ErrorBoundary to layout
- [ ] Enhance API client with global error handling
- [ ] Create error monitoring utility
- [ ] Integrate error logging

### Phase 3 (Enhanced)
- [ ] Implement retry mechanism
- [ ] Add network status detection
- [ ] Enhance backend error context
- [ ] Add comprehensive testing

---

## Notes for Implementation
- Prioritize Phase 1 tasks for immediate impact
- Test each change thoroughly before moving to next phase
- Consider gradual rollout for Phase 2 changes
- Monitor error logs after implementing monitoring
- Update documentation as patterns are established