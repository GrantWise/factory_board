const express = require('express');
const router = express.Router();
const UserSettingsController = require('../controllers/userSettingsController');
const { authenticateToken } = require('../middleware/auth');
const { validateId } = require('../middleware/validation');

// GET /api/settings/defaults - Get default settings (no auth required for defaults)
router.get('/defaults', 
  UserSettingsController.getDefaultSettings
);

// All other routes require authentication
router.use(authenticateToken);

// GET /api/users/:userId/settings/visual-characteristics - Get visual characteristics settings (must be before general :key route)
router.get('/users/:userId/settings/visual-characteristics', 
  validateId('userId'),
  UserSettingsController.getVisualCharacteristicsSettings
);

// PUT /api/users/:userId/settings/visual-characteristics - Set visual characteristics settings (must be before general :key route)
router.put('/users/:userId/settings/visual-characteristics', 
  validateId('userId'),
  UserSettingsController.setVisualCharacteristicsSettings
);

// GET /api/users/:userId/settings - Get all settings for a user
router.get('/users/:userId/settings', 
  validateId('userId'),
  UserSettingsController.getUserSettings
);

// GET /api/users/:userId/settings/:key - Get specific setting for a user
router.get('/users/:userId/settings/:key', 
  validateId('userId'),
  UserSettingsController.getUserSetting
);

// PUT /api/users/:userId/settings/:key - Set specific setting for a user
router.put('/users/:userId/settings/:key', 
  validateId('userId'),
  UserSettingsController.setUserSetting
);

// PUT /api/users/:userId/settings - Set multiple settings for a user
router.put('/users/:userId/settings', 
  validateId('userId'),
  UserSettingsController.setMultipleUserSettings
);

// DELETE /api/users/:userId/settings/:key - Delete specific setting for a user
router.delete('/users/:userId/settings/:key', 
  validateId('userId'),
  UserSettingsController.deleteUserSetting
);

module.exports = router;