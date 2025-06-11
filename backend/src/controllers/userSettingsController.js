const UserSettings = require('../models/UserSettings');

/**
 * UserSettingsController
 * ======================
 *
 * Handles all endpoints related to user settings and preferences.
 */
class UserSettingsController {
  // GET /api/users/:userId/settings
  async getUserSettings(req, res, next) {
    try {
      const { userId } = req.params;

      // Ensure user can only access their own settings (unless admin)
      if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        return next({
          status: 403,
          code: 'ACCESS_DENIED',
          message: 'Access denied'
        });
      }

      const settings = UserSettings.getAllForUser(parseInt(userId));

      // If no settings exist, return defaults
      if (settings.length === 0) {
        const defaults = UserSettings.getDefaultSettings();
        return res.json(defaults);
      }

      // Convert array to object format
      const settingsObj = {};
      settings.forEach(setting => {
        settingsObj[setting.setting_key] = setting.setting_value;
      });

      res.json(settingsObj);
    } catch (error) {
      next({ status: 500, code: 'FETCH_FAILED', message: error.message });
    }
  }

  // GET /api/users/:userId/settings/:key
  async getUserSetting(req, res, next) {
    try {
      const { userId, key } = req.params;

      // Ensure user can only access their own settings (unless admin)
      if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        return next({
          status: 403,
          code: 'ACCESS_DENIED',
          message: 'Access denied'
        });
      }

      const setting = UserSettings.get(parseInt(userId), key);

      if (!setting) {
        // Return default value if available
        const defaults = UserSettings.getDefaultSettings();
        if (defaults[key]) {
          return res.json({
            setting_key: key,
            setting_value: defaults[key],
            is_default: true
          });
        }

        return next({
          status: 404,
          code: 'SETTING_NOT_FOUND',
          message: 'Setting not found'
        });
      }

      res.json(setting);
    } catch (error) {
      next({ status: 500, code: 'FETCH_FAILED', message: error.message });
    }
  }

  // PUT /api/users/:userId/settings/:key
  async setUserSetting(req, res, next) {
    try {
      const { userId, key } = req.params;
      const { value } = req.body;

      // Ensure user can only modify their own settings (unless admin)
      if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        return next({
          status: 403,
          code: 'ACCESS_DENIED',
          message: 'Access denied'
        });
      }

      if (value === undefined) {
        return next({
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Value is required'
        });
      }

      const setting = UserSettings.set(parseInt(userId), key, value);
      res.json(setting);
    } catch (error) {
      next({ status: 500, code: 'UPDATE_FAILED', message: error.message });
    }
  }

  // PUT /api/users/:userId/settings
  async setMultipleUserSettings(req, res, next) {
    try {
      const { userId } = req.params;
      const settings = req.body;

      // Ensure user can only modify their own settings (unless admin)
      if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        return next({
          status: 403,
          code: 'ACCESS_DENIED',
          message: 'Access denied'
        });
      }

      if (!settings || typeof settings !== 'object') {
        return next({
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Settings object is required'
        });
      }

      const results = UserSettings.setMultiple(parseInt(userId), settings);
      res.json(results);
    } catch (error) {
      next({ status: 500, code: 'UPDATE_FAILED', message: error.message });
    }
  }

  // DELETE /api/users/:userId/settings/:key
  async deleteUserSetting(req, res, next) {
    try {
      const { userId, key } = req.params;

      // Ensure user can only modify their own settings (unless admin)
      if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        return next({
          status: 403,
          code: 'ACCESS_DENIED',
          message: 'Access denied'
        });
      }

      UserSettings.delete(parseInt(userId), key);
      res.status(204).send();
    } catch (error) {
      next({ status: 500, code: 'DELETE_FAILED', message: error.message });
    }
  }

  // GET /api/users/:userId/settings/visual-characteristics
  async getVisualCharacteristicsSettings(req, res, next) {
    try {
      const { userId } = req.params;

      // Ensure user can only access their own settings (unless admin)
      if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        return next({
          status: 403,
          code: 'ACCESS_DENIED',
          message: 'Access denied'
        });
      }

      const settings = UserSettings.getVisualCharacteristicsSettings(parseInt(userId));
      res.json(settings);
    } catch (error) {
      next({ status: 500, code: 'FETCH_FAILED', message: error.message });
    }
  }

  // PUT /api/users/:userId/settings/visual-characteristics
  async setVisualCharacteristicsSettings(req, res, next) {
    try {
      const { userId } = req.params;
      const settings = req.body;

      // Ensure user can only modify their own settings (unless admin)
      if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        return next({
          status: 403,
          code: 'ACCESS_DENIED',
          message: 'Access denied'
        });
      }

      // Validate settings structure
      if (typeof settings !== 'object') {
        return next({
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Settings must be an object'
        });
      }

      const result = UserSettings.setVisualCharacteristicsSettings(parseInt(userId), settings);
      res.json(result);
    } catch (error) {
      next({ status: 500, code: 'UPDATE_FAILED', message: error.message });
    }
  }

  // GET /api/settings/defaults
  async getDefaultSettings(req, res, next) {
    try {
      const defaults = UserSettings.getDefaultSettings();
      res.json(defaults);
    } catch (error) {
      next({ status: 500, code: 'FETCH_FAILED', message: error.message });
    }
  }
}

module.exports = new UserSettingsController();