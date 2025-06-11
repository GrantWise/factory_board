const AuthService = require('../services/authService');

/**
 * AuthController
 * ==============
 *
 * Handles authentication, login, logout, token refresh, and profile endpoints.
 * Now uses next(err) for error propagation to the centralized error handler.
 */
class AuthController {
  // POST /api/auth/login
  async login(req, res, next) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return next({
          status: 400,
          code: 'MISSING_CREDENTIALS',
          message: 'Username and password are required'
        });
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const result = await AuthService.login(username, password, ipAddress);

      res.json({
        message: 'Login successful',
        user: result.user,
        access_token: result.tokens.accessToken,
        refresh_token: result.tokens.refreshToken
      });
    } catch (error) {
      next({ status: 401, code: 'LOGIN_FAILED', message: error.message });
    }
  }

  // POST /api/auth/logout
  async logout(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      await AuthService.logout(req.user.id, ipAddress);

      res.json({
        message: 'Logout successful'
      });
    } catch (error) {
      next({ status: 500, code: 'LOGOUT_ERROR', message: error.message });
    }
  }

  // POST /api/auth/refresh
  async refreshToken(req, res, next) {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return next({
          status: 400,
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required'
        });
      }

      const tokens = await AuthService.refreshToken(refresh_token);

      res.json({
        message: 'Token refreshed successfully',
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken
      });
    } catch (error) {
      next({ status: 401, code: 'REFRESH_FAILED', message: error.message });
    }
  }

  // GET /api/auth/me
  async getCurrentUser(req, res, next) {
    try {
      const user = AuthService.getUserProfile(req.user.id);

      res.json({
        user
      });
    } catch (error) {
      next({ status: 404, code: 'USER_NOT_FOUND', message: error.message });
    }
  }

  // PUT /api/auth/profile
  async updateProfile(req, res, next) {
    try {
      const updates = req.body;

      // Remove sensitive fields that shouldn't be updated through this endpoint
      delete updates.password;
      delete updates.password_hash;
      delete updates.role; // Role changes should go through admin endpoints
      delete updates.is_active; // Account status changes should go through admin endpoints

      const user = await AuthService.updateProfile(req.user.id, updates);

      res.json({
        message: 'Profile updated successfully',
        user
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        return next({
          status: 409,
          code: 'CONFLICT',
          message: error.message
        });
      }

      next({ status: 400, code: 'UPDATE_FAILED', message: error.message });
    }
  }

  // POST /api/auth/change-password
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return next({
          status: 400,
          code: 'MISSING_PASSWORDS',
          message: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return next({
          status: 400,
          code: 'PASSWORD_TOO_SHORT',
          message: 'New password must be at least 6 characters long'
        });
      }

      await AuthService.changePassword(req.user.id, currentPassword, newPassword);

      res.json({
        message: 'Password changed successfully'
      });
    } catch (error) {
      if (error.message === 'Current password is incorrect') {
        return next({
          status: 400,
          code: 'INVALID_CURRENT_PASSWORD',
          message: error.message
        });
      }

      next({ status: 500, code: 'PASSWORD_CHANGE_FAILED', message: error.message });
    }
  }

  // POST /api/auth/register (admin only - handled in userController)
  async register(req, res, next) {
    try {
      // This endpoint is typically admin-only in enterprise systems
      // For now, we'll make it available but could be restricted later
      const userData = req.body;

      if (!userData.username || !userData.email || !userData.password || !userData.role) {
        return next({
          status: 400,
          code: 'MISSING_FIELDS',
          message: 'Username, email, password, and role are required'
        });
      }

      if (userData.password.length < 6) {
        return next({
          status: 400,
          code: 'PASSWORD_TOO_SHORT',
          message: 'Password must be at least 6 characters long'
        });
      }

      const user = await AuthService.register(userData);

      res.status(201).json({
        message: 'User registered successfully',
        user
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        return next({
          status: 409,
          code: 'CONFLICT',
          message: error.message
        });
      }

      next({ status: 400, code: 'REGISTRATION_FAILED', message: error.message });
    }
  }
}

module.exports = new AuthController();