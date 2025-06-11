const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/database');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { AUTH } = require('../config/constants');

/**
 * Authentication Service
 * ======================
 *
 * Handles user authentication, password management, and JWT token operations.
 * Provides comprehensive audit logging for security events.
 *
 * Key Features:
 * - Secure password hashing with bcrypt (12 rounds)
 * - JWT token generation and validation
 * - User registration and login with audit trails
 * - Password change functionality with security validation
 */
class AuthService {
  /**
   * Hash a password using bcrypt with salt rounds
   * @param {string} password - Plain text password to hash
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    return await bcrypt.hash(password, AUTH.BCRYPT_SALT_ROUNDS);
  }

  /**
   * Verify a password against its hash
   * @param {string} password - Plain text password to verify
   * @param {string} hashedPassword - Hashed password to compare against
   * @returns {Promise<boolean>} True if password matches, false otherwise
   */
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * Generate JWT access and refresh tokens for a user
   * @param {Object} user - User object
   * @param {number} user.id - User ID
   * @param {string} user.username - Username
   * @param {string} user.role - User role (admin, scheduler, viewer)
   * @returns {Object} Object containing accessToken and refreshToken
   */
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

  /**
   * Register a new user with validation and audit logging
   * @param {Object} userData - User registration data
   * @param {string} userData.username - Unique username
   * @param {string} userData.email - User email address
   * @param {string} userData.password - Plain text password (will be hashed)
   * @param {string} userData.role - User role (admin, scheduler, viewer)
   * @param {string} [userData.first_name] - User's first name
   * @param {string} [userData.last_name] - User's last name
   * @returns {Promise<Object>} Created user object (without password)
   * @throws {Error} If username or email already exists
   */
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

  /**
   * Authenticate a user with username and password
   * @param {string} username - Username to authenticate
   * @param {string} password - Plain text password
   * @param {string|null} [ipAddress=null] - Client IP address for audit logging
   * @returns {Promise<Object>} Object containing user data and JWT tokens
   * @returns {Object} returns.user - User object (without password)
   * @returns {string} returns.accessToken - JWT access token
   * @returns {string} returns.refreshToken - JWT refresh token
   * @throws {Error} If credentials are invalid or user is inactive
   */
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