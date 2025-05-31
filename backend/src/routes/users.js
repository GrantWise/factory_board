const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AuthService = require('../services/authService');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/permissions');
const { validate, schemas, validateId } = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// GET /api/users - Get all users (admin only)
router.get('/', 
  requirePermission('users:read'),
  async (req, res) => {
    try {
      const users = User.findAll();
      res.json({
        users
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        code: 'FETCH_FAILED'
      });
    }
  }
);

// GET /api/users/:id - Get user by ID (admin only)
router.get('/:id', 
  validateId(),
  requirePermission('users:read'),
  async (req, res) => {
    try {
      const user = User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'NOT_FOUND'
        });
      }
      res.json({
        user
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        code: 'FETCH_FAILED'
      });
    }
  }
);

// POST /api/users - Create new user (admin only)
router.post('/', 
  requirePermission('users:write'),
  validate(schemas.user.create),
  async (req, res) => {
    try {
      const user = await AuthService.register(req.body);
      res.status(201).json({
        message: 'User created successfully',
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
        code: 'CREATION_FAILED'
      });
    }
  }
);

// PUT /api/users/:id - Update user (admin only)
router.put('/:id', 
  validateId(),
  requirePermission('users:write'),
  validate(schemas.user.update),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const updates = req.body;

      const existingUser = User.findById(userId);
      if (!existingUser) {
        return res.status(404).json({
          error: 'User not found',
          code: 'NOT_FOUND'
        });
      }

      // Check for conflicts
      if (updates.username && User.usernameExists(updates.username, userId)) {
        return res.status(409).json({
          error: 'Username already exists',
          code: 'DUPLICATE_USERNAME'
        });
      }

      if (updates.email && User.emailExists(updates.email, userId)) {
        return res.status(409).json({
          error: 'Email already exists',
          code: 'DUPLICATE_EMAIL'
        });
      }

      // Hash password if being updated
      if (updates.password) {
        updates.password_hash = await AuthService.hashPassword(updates.password);
        delete updates.password;
      }

      const user = User.update(userId, updates);

      res.json({
        message: 'User updated successfully',
        user
      });
    } catch (error) {
      res.status(400).json({
        error: error.message,
        code: 'UPDATE_FAILED'
      });
    }
  }
);

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', 
  validateId(),
  requirePermission('users:delete'),
  async (req, res) => {
    try {
      const userId = req.params.id;

      // Prevent admin from deleting themselves
      if (userId == req.user.id) {
        return res.status(400).json({
          error: 'Cannot delete your own account',
          code: 'SELF_DELETE_FORBIDDEN'
        });
      }

      const user = User.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'NOT_FOUND'
        });
      }

      User.delete(userId);

      res.json({
        message: 'User deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        code: 'DELETE_FAILED'
      });
    }
  }
);

// POST /api/users/:id/reset-password - Reset user password (admin only)
router.post('/:id/reset-password', 
  validateId(),
  requireRole('admin'),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          error: 'New password must be at least 6 characters long',
          code: 'INVALID_PASSWORD'
        });
      }

      await AuthService.resetPassword(userId, newPassword, req.user.id);

      res.json({
        message: 'Password reset successfully'
      });
    } catch (error) {
      if (error.message === 'User not found') {
        return res.status(404).json({
          error: error.message,
          code: 'NOT_FOUND'
        });
      }
      res.status(400).json({
        error: error.message,
        code: 'PASSWORD_RESET_FAILED'
      });
    }
  }
);

module.exports = router;