const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// Public routes
router.post('/login', 
  validate(schemas.user.login), 
  AuthController.login
);

router.post('/refresh', 
  AuthController.refreshToken
);

router.post('/register', 
  validate(schemas.user.create), 
  AuthController.register
);

// Protected routes (require authentication)
router.use(authenticateToken);

router.get('/me', 
  AuthController.getCurrentUser
);

router.put('/profile', 
  validate(schemas.user.update), 
  AuthController.updateProfile
);

router.post('/change-password', 
  AuthController.changePassword
);

router.post('/logout', 
  AuthController.logout
);

module.exports = router;