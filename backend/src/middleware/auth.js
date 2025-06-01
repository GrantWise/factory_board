const jwt = require('jsonwebtoken');
const config = require('../config/database');
const User = require('../models/User');

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'AUTH_REQUIRED' 
    });
  }
  
  jwt.verify(token, config.jwt.secret, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ 
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN' 
      });
    }
    
    try {
      // Get fresh user data from database
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(403).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND' 
        });
      }
      
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      };
      
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({ 
        error: 'Authentication error',
        code: 'AUTH_ERROR' 
      });
    }
  });
};

// Optional authentication (for endpoints that work with or without auth)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    req.user = null;
    return next();
  }
  
  jwt.verify(token, config.jwt.secret, async (err, decoded) => {
    if (err) {
      req.user = null;
      return next();
    }
    
    try {
      const user = await User.findById(decoded.userId);
      req.user = user ? {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      } : null;
    } catch (error) {
      req.user = null;
    }
    
    next();
  });
};

module.exports = {
  authenticateToken,
  optionalAuth
};