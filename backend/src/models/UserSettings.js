const { getDatabase } = require('../utils/database');

class UserSettings {
  constructor() {
    this.db = getDatabase();
    this.table = 'user_settings';
  }

  // Create or update a user setting
  set(userId, settingKey, settingValue) {
    const valueStr = typeof settingValue === 'string' ? settingValue : JSON.stringify(settingValue);
    
    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (user_id, setting_key, setting_value, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, setting_key) 
      DO UPDATE SET 
        setting_value = excluded.setting_value,
        updated_at = CURRENT_TIMESTAMP
    `);
    
    const result = stmt.run(userId, settingKey, valueStr);
    return this.get(userId, settingKey);
  }

  // Get a user setting
  get(userId, settingKey) {
    const setting = this.db.prepare(`
      SELECT * FROM ${this.table} 
      WHERE user_id = ? AND setting_key = ?
    `).get(userId, settingKey);

    if (!setting) return null;

    // Try to parse JSON, fallback to string value
    try {
      setting.setting_value = JSON.parse(setting.setting_value);
    } catch (e) {
      // Keep as string if not valid JSON
    }

    return setting;
  }

  // Get all settings for a user
  getAllForUser(userId) {
    const settings = this.db.prepare(`
      SELECT * FROM ${this.table} 
      WHERE user_id = ?
      ORDER BY setting_key
    `).all(userId);

    // Parse JSON values
    return settings.map(setting => {
      try {
        setting.setting_value = JSON.parse(setting.setting_value);
      } catch (e) {
        // Keep as string if not valid JSON
      }
      return setting;
    });
  }

  // Get visual characteristics settings for a user
  getVisualCharacteristicsSettings(userId) {
    const setting = this.get(userId, 'visual_characteristics');
    if (!setting) {
      // Return default settings
      return {
        enabled: false,
        enabledTypes: [],
        primaryCharacteristic: null,
        secondaryCharacteristic: null,
        colorAssignment: 'automatic'
      };
    }
    return setting.setting_value;
  }

  // Set visual characteristics settings for a user
  setVisualCharacteristicsSettings(userId, settings) {
    return this.set(userId, 'visual_characteristics', settings);
  }

  // Delete a user setting
  delete(userId, settingKey) {
    const stmt = this.db.prepare(`
      DELETE FROM ${this.table} 
      WHERE user_id = ? AND setting_key = ?
    `);
    return stmt.run(userId, settingKey);
  }

  // Delete all settings for a user
  deleteAllForUser(userId) {
    const stmt = this.db.prepare(`
      DELETE FROM ${this.table} 
      WHERE user_id = ?
    `);
    return stmt.run(userId);
  }

  // Get default settings for various features
  getDefaultSettings() {
    return {
      visual_characteristics: {
        enabled: false,
        enabledTypes: [],
        primaryCharacteristic: null,
        secondaryCharacteristic: null,
        colorAssignment: 'automatic'
      },
      planning_board: {
        autoRefresh: true,
        refreshInterval: 30000,
        showCompleted: false
      },
      notifications: {
        enabled: true,
        orderUpdates: true,
        systemAlerts: true
      }
    };
  }

  // Bulk set multiple settings for a user
  setMultiple(userId, settings) {
    const transaction = this.db.transaction(() => {
      const results = {};
      for (const [key, value] of Object.entries(settings)) {
        results[key] = this.set(userId, key, value);
      }
      return results;
    });

    return transaction();
  }

  // Get settings for multiple users (useful for admin)
  getForMultipleUsers(userIds, settingKey = null) {
    const placeholders = userIds.map(() => '?').join(',');
    let query = `
      SELECT user_id, setting_key, setting_value, updated_at
      FROM ${this.table} 
      WHERE user_id IN (${placeholders})
    `;
    
    const params = [...userIds];
    
    if (settingKey) {
      query += ' AND setting_key = ?';
      params.push(settingKey);
    }
    
    query += ' ORDER BY user_id, setting_key';

    const settings = this.db.prepare(query).all(...params);

    // Parse JSON values and group by user
    const grouped = {};
    for (const setting of settings) {
      if (!grouped[setting.user_id]) {
        grouped[setting.user_id] = {};
      }
      
      try {
        setting.setting_value = JSON.parse(setting.setting_value);
      } catch (e) {
        // Keep as string if not valid JSON
      }
      
      grouped[setting.user_id][setting.setting_key] = setting.setting_value;
    }

    return grouped;
  }
}

module.exports = new UserSettings();