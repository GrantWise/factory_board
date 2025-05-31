const AuthService = require('../services/authService');

class AuthController {
  // POST /api/auth/login
  async login(req, res) {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({
          error: 'Username and password are required',
          code: 'MISSING_CREDENTIALS'
        });
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const result = await AuthService.login(username, password, ipAddress);

      res.json({
        message: 'Login successful',
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      });
    } catch (error) {
      res.status(401).json({
        error: error.message,
        code: 'LOGIN_FAILED'
      });
    }
  }

  // POST /api/auth/logout
  async logout(req, res) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      await AuthService.logout(req.user.id, ipAddress);

      res.json({
        message: 'Logout successful'
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        code: 'LOGOUT_ERROR'
      });
    }
  }

  // POST /api/auth/refresh
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          error: 'Refresh token is required',
          code: 'MISSING_REFRESH_TOKEN'
        });
      }

      const tokens = await AuthService.refreshToken(refreshToken);

      res.json({
        message: 'Token refreshed successfully',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });
    } catch (error) {
      res.status(401).json({
        error: error.message,
        code: 'REFRESH_FAILED'
      });
    }
  }

  // GET /api/auth/me
  async getCurrentUser(req, res) {
    try {
      const user = AuthService.getUserProfile(req.user.id);

      res.json({
        user
      });
    } catch (error) {
      res.status(404).json({
        error: error.message,
        code: 'USER_NOT_FOUND'
      });
    }
  }

  // PUT /api/auth/profile
  async updateProfile(req, res) {
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
        return res.status(409).json({
          error: error.message,
          code: 'CONFLICT'
        });
      }

      res.status(400).json({
        error: error.message,
        code: 'UPDATE_FAILED'
      });
    }
  }

  // POST /api/auth/change-password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: 'Current password and new password are required',
          code: 'MISSING_PASSWORDS'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          error: 'New password must be at least 6 characters long',
          code: 'PASSWORD_TOO_SHORT'
        });
      }

      await AuthService.changePassword(req.user.id, currentPassword, newPassword);

      res.json({
        message: 'Password changed successfully'
      });
    } catch (error) {
      if (error.message === 'Current password is incorrect') {
        return res.status(400).json({
          error: error.message,
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      res.status(500).json({
        error: error.message,
        code: 'PASSWORD_CHANGE_FAILED'
      });
    }
  }

  // POST /api/auth/register (admin only - handled in userController)
  async register(req, res) {
    try {
      // This endpoint is typically admin-only in enterprise systems
      // For now, we'll make it available but could be restricted later
      const userData = req.body;
      
      if (!userData.username || !userData.email || !userData.password || !userData.role) {
        return res.status(400).json({
          error: 'Username, email, password, and role are required',
          code: 'MISSING_FIELDS'
        });
      }

      if (userData.password.length < 6) {
        return res.status(400).json({
          error: 'Password must be at least 6 characters long',
          code: 'PASSWORD_TOO_SHORT'
        });
      }

      const user = await AuthService.register(userData);

      res.status(201).json({
        message: 'User registered successfully',
        user
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: error.message,
          code: 'CONFLICT'
        });
      }

      res.status(400).json({
        error: error.message,
        code: 'REGISTRATION_FAILED'
      });
    }
  }
}

module.exports = new AuthController();