const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/database');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

class AuthService {
  // Hash password
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Generate JWT tokens
  generateTokens(user) {
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    });

    const refreshToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiresIn
    });

    return { accessToken, refreshToken };
  }

  // Verify and decode token
  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Register new user
  async register(userData) {
    // Check if username already exists
    if (User.usernameExists(userData.username)) {
      throw new Error('Username already exists');
    }

    // Check if email already exists
    if (User.emailExists(userData.email)) {
      throw new Error('Email already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(userData.password);

    // Create user
    const user = User.create({
      ...userData,
      password_hash: hashedPassword
    });

    // Log user creation
    AuditLog.create({
      event_type: 'user_created',
      user_id: user.id,
      event_data: {
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

    // Remove password hash from response
    delete user.password_hash;

    return user;
  }

  // Authenticate user
  async login(username, password, ipAddress = null) {
    // Find user by username
    const user = User.findByUsername(username);

    if (!user) {
      // Log failed login attempt
      AuditLog.create({
        event_type: 'login_failed',
        event_data: {
          username,
          reason: 'user_not_found',
          ip_address: ipAddress
        }
      });
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      // Log failed login attempt
      AuditLog.create({
        event_type: 'login_failed',
        user_id: user.id,
        event_data: {
          username,
          reason: 'invalid_password',
          ip_address: ipAddress
        }
      });
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.is_active) {
      AuditLog.create({
        event_type: 'login_failed',
        user_id: user.id,
        event_data: {
          username,
          reason: 'account_inactive',
          ip_address: ipAddress
        }
      });
      throw new Error('Account is inactive');
    }

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Log successful login
    AuditLog.create({
      event_type: 'login_success',
      user_id: user.id,
      event_data: {
        username,
        ip_address: ipAddress
      }
    });

    // Remove sensitive data
    delete user.password_hash;

    return {
      user,
      tokens
    };
  }

  // Refresh access token
  async refreshToken(refreshToken) {
    try {
      const decoded = this.verifyToken(refreshToken);

      // Get fresh user data
      const user = User.findById(decoded.userId);

      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);

      // Log token refresh
      AuditLog.create({
        event_type: 'token_refreshed',
        user_id: user.id,
        event_data: {
          username: user.username
        }
      });

      return tokens;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Logout (mainly for logging purposes)
  async logout(userId, ipAddress = null) {
    const user = User.findById(userId);

    if (user) {
      AuditLog.create({
        event_type: 'logout',
        user_id: userId,
        event_data: {
          username: user.username,
          ip_address: ipAddress
        }
      });
    }

    return true;
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    const user = User.findByUsername(User.findById(userId).username);

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await this.verifyPassword(currentPassword, user.password_hash);

    if (!isValidPassword) {
      // Log failed password change
      AuditLog.create({
        event_type: 'password_change_failed',
        user_id: userId,
        event_data: {
          reason: 'invalid_current_password'
        }
      });
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await this.hashPassword(newPassword);

    // Update password
    User.update(userId, {
      password_hash: hashedNewPassword
    });

    // Log successful password change
    AuditLog.create({
      event_type: 'password_changed',
      user_id: userId,
      event_data: {
        username: user.username
      }
    });

    return true;
  }

  // Reset password (admin only)
  async resetPassword(userId, newPassword, adminUserId) {
    const user = User.findById(userId);
    const admin = User.findById(adminUserId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    // Hash new password
    const hashedNewPassword = await this.hashPassword(newPassword);

    // Update password
    User.update(userId, {
      password_hash: hashedNewPassword
    });

    // Log password reset
    AuditLog.create({
      event_type: 'password_reset',
      user_id: userId,
      event_data: {
        username: user.username,
        reset_by: admin.username,
        reset_by_id: adminUserId
      }
    });

    return true;
  }

  // Get user profile
  getUserProfile(userId) {
    const user = User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Remove sensitive data
    delete user.password_hash;

    return user;
  }

  // Update user profile
  async updateProfile(userId, updates) {
    const user = User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Check for username/email conflicts if updating those fields
    if (updates.username && User.usernameExists(updates.username, userId)) {
      throw new Error('Username already exists');
    }

    if (updates.email && User.emailExists(updates.email, userId)) {
      throw new Error('Email already exists');
    }

    // Update user
    const updatedUser = User.update(userId, updates);

    // Log profile update
    AuditLog.create({
      event_type: 'profile_updated',
      user_id: userId,
      event_data: {
        username: user.username,
        updated_fields: Object.keys(updates)
      }
    });

    // Remove sensitive data
    delete updatedUser.password_hash;

    return updatedUser;
  }
}

module.exports = new AuthService();