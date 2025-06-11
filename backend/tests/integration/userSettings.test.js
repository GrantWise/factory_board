const request = require('supertest');
const { app } = require('../../src/testApp');
const { getDatabase } = require('../../src/utils/database');
const { runMigrations } = require('../../database/migrate');

describe('User Settings Integration Tests', () => {
  let db;
  let testUser;
  let userToken;
  let adminUser;
  let adminToken;

  beforeAll(async () => {
    // Get database connection
    db = getDatabase();
    
    // Ensure user_settings table exists (may already exist from other tests)
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          setting_key VARCHAR(100) NOT NULL,
          setting_value TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, setting_key)
        )
      `);
    } catch (error) {
      // Table may already exist, which is fine
      console.log('Tables already exist or creation failed:', error.message);
    }
    
    // Clean up and create test users
    db.exec('DELETE FROM users WHERE username IN ("test-user", "test-admin")');
    
    const hashedPassword = require('bcryptjs').hashSync('password123', 10);
    
    // Create regular user
    const userResult = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, first_name, last_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('test-user', 'user@test.com', hashedPassword, 'viewer', 'Test', 'User');
    
    testUser = { id: userResult.lastInsertRowid, username: 'test-user', role: 'viewer' };

    // Create admin user
    const adminResult = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, first_name, last_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('test-admin', 'admin@test.com', hashedPassword, 'admin', 'Test', 'Admin');
    
    adminUser = { id: adminResult.lastInsertRowid, username: 'test-admin', role: 'admin' };

    // Get tokens
    const userLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test-user', password: 'password123' })
      .expect(200);
    
    userToken = userLoginResponse.body.access_token;

    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test-admin', password: 'password123' })
      .expect(200);
    
    adminToken = adminLoginResponse.body.access_token;
  });

  beforeEach(async () => {
    // Clean up user settings
    db.exec('DELETE FROM user_settings');
  });

  afterAll(() => {
    // Clean up
    db.exec('DELETE FROM users WHERE username IN ("test-user", "test-admin")');
    db.exec('DELETE FROM user_settings');
    db.close();
  });

  describe('GET /api/settings/defaults', () => {
    test('should return default settings', async () => {
      const response = await request(app)
        .get('/api/settings/defaults')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('visual_characteristics');
      expect(response.body).toHaveProperty('planning_board');
      expect(response.body).toHaveProperty('notifications');
      
      expect(response.body.visual_characteristics).toEqual({
        enabled: false,
        primaryCharacteristic: null,
        secondaryCharacteristic: null
      });
    });
  });

  describe('GET /api/settings/users/:userId/settings', () => {
    test('should return default settings for user with no settings', async () => {
      const response = await request(app)
        .get(`/api/settings/users/${testUser.id}/settings`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('visual_characteristics');
      expect(response.body.visual_characteristics.enabled).toBe(false);
    });

    test('should return user-specific settings when they exist', async () => {
      // Create a setting
      db.prepare(`
        INSERT INTO user_settings (user_id, setting_key, setting_value)
        VALUES (?, ?, ?)
      `).run(testUser.id, 'visual_characteristics', JSON.stringify({
        enabled: true,
        primaryCharacteristic: 'material',
        secondaryCharacteristic: 'priority'
      }));

      const response = await request(app)
        .get(`/api/settings/users/${testUser.id}/settings`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.visual_characteristics).toEqual({
        enabled: true,
        primaryCharacteristic: 'material',
        secondaryCharacteristic: 'priority'
      });
    });

    test('should prevent access to other users settings', async () => {
      await request(app)
        .get(`/api/settings/users/${adminUser.id}/settings`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    test('should allow admin to access any user settings', async () => {
      await request(app)
        .get(`/api/settings/users/${testUser.id}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('PUT /api/settings/users/:userId/settings/:key', () => {
    test('should set a user setting', async () => {
      const settingValue = {
        enabled: true,
        primaryCharacteristic: 'material'
      };

      const response = await request(app)
        .put(`/api/settings/users/${testUser.id}/settings/visual_characteristics`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ value: settingValue })
        .expect(200);

      expect(response.body.setting_key).toBe('visual_characteristics');
      expect(response.body.setting_value).toEqual(settingValue);
      expect(response.body.user_id).toBe(testUser.id);
    });

    test('should update existing setting', async () => {
      // Create initial setting
      db.prepare(`
        INSERT INTO user_settings (user_id, setting_key, setting_value)
        VALUES (?, ?, ?)
      `).run(testUser.id, 'visual_characteristics', JSON.stringify({ enabled: false }));

      const newValue = { enabled: true, primaryCharacteristic: 'priority' };

      const response = await request(app)
        .put(`/api/settings/users/${testUser.id}/settings/visual_characteristics`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ value: newValue })
        .expect(200);

      expect(response.body.setting_value).toEqual(newValue);
    });

    test('should prevent access to other users settings', async () => {
      await request(app)
        .put(`/api/settings/users/${adminUser.id}/settings/visual_characteristics`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ value: { enabled: true } })
        .expect(403);
    });

    test('should require value in request body', async () => {
      await request(app)
        .put(`/api/settings/users/${testUser.id}/settings/visual_characteristics`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('PUT /api/settings/users/:userId/settings', () => {
    test('should set multiple settings at once', async () => {
      const settings = {
        visual_characteristics: {
          enabled: true,
          primaryCharacteristic: 'material'
        },
        planning_board: {
          autoRefresh: false,
          refreshInterval: 60000
        }
      };

      const response = await request(app)
        .put(`/api/settings/users/${testUser.id}/settings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(settings)
        .expect(200);

      expect(response.body).toHaveProperty('visual_characteristics');
      expect(response.body).toHaveProperty('planning_board');
      expect(response.body.visual_characteristics.setting_value).toEqual(settings.visual_characteristics);
      expect(response.body.planning_board.setting_value).toEqual(settings.planning_board);
    });

    test('should validate settings object', async () => {
      await request(app)
        .put(`/api/settings/users/${testUser.id}/settings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send('invalid')
        .expect(400);
    });
  });

  describe('GET /api/settings/users/:userId/settings/visual-characteristics', () => {
    test('should return visual characteristics settings', async () => {
      const response = await request(app)
        .get(`/api/settings/users/${testUser.id}/settings/visual-characteristics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toEqual({
        enabled: false,
        primaryCharacteristic: null,
        secondaryCharacteristic: null
      });
    });

    test('should return custom visual characteristics when set', async () => {
      const customSettings = {
        enabled: true,
        primaryCharacteristic: 'customer_order',
        secondaryCharacteristic: 'material'
      };

      db.prepare(`
        INSERT INTO user_settings (user_id, setting_key, setting_value)
        VALUES (?, ?, ?)
      `).run(testUser.id, 'visual_characteristics', JSON.stringify(customSettings));

      const response = await request(app)
        .get(`/api/settings/users/${testUser.id}/settings/visual-characteristics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toEqual(customSettings);
    });
  });

  describe('PUT /api/settings/users/:userId/settings/visual-characteristics', () => {
    test('should set visual characteristics settings', async () => {
      const settings = {
        enabled: true,
        primaryCharacteristic: 'part_family',
        secondaryCharacteristic: 'priority'
      };

      const response = await request(app)
        .put(`/api/settings/users/${testUser.id}/settings/visual-characteristics`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(settings)
        .expect(200);

      expect(response.body.setting_value).toEqual(settings);
    });

    test('should validate settings structure', async () => {
      await request(app)
        .put(`/api/settings/users/${testUser.id}/settings/visual-characteristics`)
        .set('Authorization', `Bearer ${userToken}`)
        .send('invalid')
        .expect(400);
    });
  });

  describe('DELETE /api/settings/users/:userId/settings/:key', () => {
    beforeEach(async () => {
      // Create a setting to delete
      db.prepare(`
        INSERT INTO user_settings (user_id, setting_key, setting_value)
        VALUES (?, ?, ?)
      `).run(testUser.id, 'test_setting', JSON.stringify({ test: 'value' }));
    });

    test('should delete a user setting', async () => {
      await request(app)
        .delete(`/api/settings/users/${testUser.id}/settings/test_setting`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(204);

      // Verify deletion
      const setting = db.prepare(`
        SELECT * FROM user_settings WHERE user_id = ? AND setting_key = ?
      `).get(testUser.id, 'test_setting');

      expect(setting).toBeUndefined();
    });

    test('should prevent access to other users settings', async () => {
      await request(app)
        .delete(`/api/settings/users/${adminUser.id}/settings/test_setting`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('Authentication and Authorization', () => {
    test('should require authentication for all endpoints', async () => {
      await request(app)
        .get(`/api/settings/users/${testUser.id}/settings`)
        .expect(401);

      await request(app)
        .put(`/api/settings/users/${testUser.id}/settings/test`)
        .send({ value: 'test' })
        .expect(401);

      await request(app)
        .delete(`/api/settings/users/${testUser.id}/settings/test`)
        .expect(401);
    });

    test('should enforce user ownership for settings access', async () => {
      // User trying to access admin settings
      await request(app)
        .get(`/api/settings/users/${adminUser.id}/settings`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // User trying to modify admin settings
      await request(app)
        .put(`/api/settings/users/${adminUser.id}/settings/test`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ value: 'test' })
        .expect(403);
    });

    test('should allow admin access to any user settings', async () => {
      await request(app)
        .get(`/api/settings/users/${testUser.id}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app)
        .put(`/api/settings/users/${testUser.id}/settings/admin_test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: { test: 'admin_value' } })
        .expect(200);
    });
  });
});