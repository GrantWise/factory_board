import { getErrorMessage, getSuccessMessage, isAuthError, isPermissionError, isNetworkError, shouldLogError, getValidationErrors } from '../error-handling';
import { notify } from '../notifications';
import { toast } from 'sonner';

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Error Handling Utilities', () => {
  describe('getErrorMessage', () => {
    it('should return operation-specific error message', () => {
      const error = { status: 401, code: 'INVALID_CREDENTIALS' };
      const message = getErrorMessage(error, { operation: 'login' });
      expect(message).toBe('Invalid username or password. Please try again.');
    });

    it('should return HTTP error message for unknown operations', () => {
      const error = { status: 404 };
      const message = getErrorMessage(error);
      expect(message).toBe('The requested resource was not found.');
    });

    it('should use custom error message if provided', () => {
      const error = { 
        status: 400, 
        error: 'Custom error message' 
      };
      const message = getErrorMessage(error);
      expect(message).toBe('Custom error message');
    });

    it('should handle network errors', () => {
      const error = { status: 0 };
      const message = getErrorMessage(error);
      expect(message).toBe('Network error. Please check your connection and try again.');
    });
  });

  describe('getSuccessMessage', () => {
    it('should return operation-specific success message', () => {
      const message = getSuccessMessage({ 
        operation: 'create_order',
        entity: 'order',
        id: '123'
      });
      expect(message).toBe('Order created successfully (123)');
    });

    it('should handle operations without entity', () => {
      const message = getSuccessMessage({ operation: 'login' });
      expect(message).toBe('Logged in successfully');
    });
  });

  describe('Error Type Checks', () => {
    it('should identify auth errors', () => {
      expect(isAuthError({ status: 401 })).toBe(true);
      expect(isAuthError({ code: 'INVALID_TOKEN' })).toBe(true);
      expect(isAuthError({ status: 403 })).toBe(false);
    });

    it('should identify permission errors', () => {
      expect(isPermissionError({ status: 403 })).toBe(true);
      expect(isPermissionError({ status: 401 })).toBe(false);
    });

    it('should identify network errors', () => {
      expect(isNetworkError({ status: 0 })).toBe(true);
      expect(isNetworkError({ status: 502 })).toBe(true);
      expect(isNetworkError({ status: 503 })).toBe(true);
      expect(isNetworkError({ status: 404 })).toBe(false);
    });

    it('should determine if error should be logged', () => {
      expect(shouldLogError({ status: 500 })).toBe(true);
      expect(shouldLogError({ status: 401 })).toBe(false);
      expect(shouldLogError({ status: 429 })).toBe(false);
    });
  });

  describe('Validation Error Handling', () => {
    it('should extract validation errors from array', () => {
      const error = {
        status: 422,
        details: [
          { message: 'Invalid field' },
          { error: 'Another error' }
        ]
      };
      const errors = getValidationErrors(error);
      expect(errors).toHaveLength(2);
      expect(errors[0]).toBe('Invalid field');
      expect(errors[1]).toBe('Another error');
    });

    it('should extract validation errors from object', () => {
      const error = {
        status: 422,
        details: {
          field1: 'Error 1',
          field2: ['Error 2', 'Error 3']
        }
      };
      const errors = getValidationErrors(error);
      expect(errors).toHaveLength(3);
      expect(errors).toContain('field1: Error 1');
      expect(errors).toContain('field2: Error 2');
      expect(errors).toContain('field2: Error 3');
    });
  });

  describe('Notification System', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should show error notification with context', () => {
      const error = { 
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid input'
      };
      notify.error(error, { 
        operation: 'create_order',
        entity: 'order'
      });
      expect(toast.error).toHaveBeenCalled();
    });

    it('should show success notification', () => {
      notify.success({
        operation: 'create_order',
        entity: 'order',
        id: '123'
      });
      expect(toast.success).toHaveBeenCalled();
    });

    it('should show info notification', () => {
      notify.info('Information message');
      expect(toast.info).toHaveBeenCalledWith('Information message');
    });

    it('should show warning notification', () => {
      notify.warning('Warning message');
      expect(toast).toHaveBeenCalledWith('Warning message', {
        style: { backgroundColor: '#fbbf24', color: '#000' }
      });
    });
  });
}); 