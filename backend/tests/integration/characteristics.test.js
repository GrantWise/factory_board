const request = require('supertest');
const { app } = require('../../src/testApp');
const { getDatabase } = require('../../src/utils/database');
const { runMigrations } = require('../../database/migrate');

describe('Job Characteristics Integration Tests', () => {
  let db;
  let adminUser;
  let adminToken;
  let testOrder;

  beforeAll(async () => {
    // Get database connection
    db = getDatabase();
    
    // Ensure job_characteristics table exists (may already exist from other tests)
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS job_characteristics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          type TEXT CHECK(type IN ('customer_order', 'customer', 'material', 'priority', 'part_family', 'custom')) NOT NULL,
          value VARCHAR(255) NOT NULL,
          color VARCHAR(7) NOT NULL,
          display_name VARCHAR(100),
          is_system_generated BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES manufacturing_orders(id) ON DELETE CASCADE
        )
      `);
      
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
      // Tables may already exist, which is fine
      console.log('Tables already exist or creation failed:', error.message);
    }
    
    // Clean up and create test user
    db.exec('DELETE FROM users WHERE username = "test-admin"');
    
    const hashedPassword = require('bcryptjs').hashSync('password123', 10);
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, first_name, last_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('test-admin', 'admin@test.com', hashedPassword, 'admin', 'Test', 'Admin');
    
    adminUser = { id: result.lastInsertRowid, username: 'test-admin', role: 'admin' };

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test-admin', password: 'password123' })
      .expect(200);
    
    adminToken = loginResponse.body.access_token;
  });

  beforeEach(async () => {
    // Clean up characteristics and orders
    db.exec('DELETE FROM job_characteristics');
    db.exec('DELETE FROM manufacturing_orders');
    
    // Create a test order
    const orderResult = db.prepare(`
      INSERT INTO manufacturing_orders (
        order_number, stock_code, description, quantity_to_make, 
        current_operation, status, priority, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'TEST001',
      'ABC123',
      'Steel widget for PO12345',
      100,
      'Drilling',
      'not_started',
      'high',
      adminUser.id
    );
    
    testOrder = { id: orderResult.lastInsertRowid };
  });

  afterAll(() => {
    // Clean up
    db.exec('DELETE FROM users WHERE username = "test-admin"');
    db.exec('DELETE FROM job_characteristics');
    db.exec('DELETE FROM manufacturing_orders');
    db.close();
  });

  describe('GET /api/characteristics', () => {
    test('should return available characteristics stats', async () => {
      const response = await request(app)
        .get('/api/characteristics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('available');
      expect(Array.isArray(response.body.stats)).toBe(true);
      expect(Array.isArray(response.body.available)).toBe(true);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/characteristics')
        .expect(401);
    });
  });

  describe('POST /api/characteristics/orders/:orderId/characteristics', () => {
    test('should create a characteristic for an order', async () => {
      const characteristicData = {
        type: 'material',
        value: 'steel',
        color: '#3B82F6',
        display_name: 'Steel Material'
      };

      const response = await request(app)
        .post(`/api/characteristics/orders/${testOrder.id}/characteristics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(characteristicData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.order_id).toBe(testOrder.id);
      expect(response.body.type).toBe('material');
      expect(response.body.value).toBe('steel');
      expect(response.body.color).toBe('#3B82F6');
      expect(response.body.display_name).toBe('Steel Material');
      expect(response.body.is_system_generated).toBe(false);
    });

    test('should validate required fields', async () => {
      await request(app)
        .post(`/api/characteristics/orders/${testOrder.id}/characteristics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'material' }) // missing value
        .expect(400);
    });

    test('should return 404 for non-existent order', async () => {
      const characteristicData = {
        type: 'material',
        value: 'steel'
      };

      await request(app)
        .post('/api/characteristics/orders/99999/characteristics')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(characteristicData)
        .expect(404);
    });
  });

  describe('GET /api/characteristics/orders/:orderId/characteristics', () => {
    beforeEach(async () => {
      // Create test characteristics
      db.prepare(`
        INSERT INTO job_characteristics (order_id, type, value, color, display_name, is_system_generated)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(testOrder.id, 'material', 'steel', '#3B82F6', 'Steel Material', false);
      
      db.prepare(`
        INSERT INTO job_characteristics (order_id, type, value, color, display_name, is_system_generated)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(testOrder.id, 'priority', 'high', '#EF4444', 'High Priority', true);
    });

    test('should return characteristics for an order', async () => {
      const response = await request(app)
        .get(`/api/characteristics/orders/${testOrder.id}/characteristics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      
      const materialChar = response.body.find(c => c.type === 'material');
      const priorityChar = response.body.find(c => c.type === 'priority');
      
      expect(materialChar).toBeDefined();
      expect(materialChar.value).toBe('steel');
      expect(materialChar.is_system_generated).toBe(false);
      
      expect(priorityChar).toBeDefined();
      expect(priorityChar.value).toBe('high');
      expect(priorityChar.is_system_generated).toBe(true);
    });
  });

  describe('POST /api/characteristics/orders/:orderId/characteristics/refresh', () => {
    test('should refresh system-generated characteristics', async () => {
      // Create a manual characteristic that should remain
      db.prepare(`
        INSERT INTO job_characteristics (order_id, type, value, color, display_name, is_system_generated)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(testOrder.id, 'custom', 'manual', '#8B5CF6', 'Manual Characteristic', false);

      const response = await request(app)
        .post(`/api/characteristics/orders/${testOrder.id}/characteristics/refresh`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Should have detected characteristics based on order data
      const hasPartFamily = response.body.some(c => c.type === 'part_family' && c.value === 'ABC');
      const hasPriority = response.body.some(c => c.type === 'priority' && c.value === 'high');
      
      expect(hasPartFamily).toBe(true);
      expect(hasPriority).toBe(true);

      // Manual characteristic should still exist (check database directly)
      const manualChar = db.prepare(`
        SELECT * FROM job_characteristics 
        WHERE order_id = ? AND type = 'custom' AND is_system_generated = 0
      `).get(testOrder.id);
      
      expect(manualChar).toBeDefined();
    });
  });

  describe('POST /api/characteristics/orders/:orderId/characteristics/detect', () => {
    test('should detect potential characteristics without creating them', async () => {
      const response = await request(app)
        .post(`/api/characteristics/orders/${testOrder.id}/characteristics/detect`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Should detect part family from stock code 'ABC123'
      const partFamilyChar = response.body.find(c => c.type === 'part_family');
      expect(partFamilyChar).toBeDefined();
      expect(partFamilyChar.value).toBe('ABC');
      
      // Should detect priority from order
      const priorityChar = response.body.find(c => c.type === 'priority');
      expect(priorityChar).toBeDefined();
      expect(priorityChar.value).toBe('high');
      
      // Should detect customer order from description
      const customerOrderChar = response.body.find(c => c.type === 'customer_order');
      expect(customerOrderChar).toBeDefined();
      expect(customerOrderChar.value).toBe('PO12345');
      
      // Verify characteristics were not actually created in database
      const dbCharacteristics = db.prepare(`
        SELECT COUNT(*) as count FROM job_characteristics WHERE order_id = ?
      `).get(testOrder.id);
      
      expect(dbCharacteristics.count).toBe(0);
    });
  });

  describe('PUT /api/characteristics/:id', () => {
    let characteristicId;

    beforeEach(async () => {
      const result = db.prepare(`
        INSERT INTO job_characteristics (order_id, type, value, color, display_name, is_system_generated)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(testOrder.id, 'custom', 'test', '#8B5CF6', 'Test Characteristic', false);
      
      characteristicId = result.lastInsertRowid;
    });

    test('should update a characteristic', async () => {
      const updates = {
        value: 'updated_test',
        display_name: 'Updated Test Characteristic',
        color: '#10B981'
      };

      const response = await request(app)
        .put(`/api/characteristics/${characteristicId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.value).toBe('updated_test');
      expect(response.body.display_name).toBe('Updated Test Characteristic');
      expect(response.body.color).toBe('#10B981');
    });

    test('should return 404 for non-existent characteristic', async () => {
      await request(app)
        .put('/api/characteristics/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'test' })
        .expect(404);
    });
  });

  describe('DELETE /api/characteristics/:id', () => {
    let characteristicId;

    beforeEach(async () => {
      const result = db.prepare(`
        INSERT INTO job_characteristics (order_id, type, value, color, display_name, is_system_generated)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(testOrder.id, 'custom', 'test', '#8B5CF6', 'Test Characteristic', false);
      
      characteristicId = result.lastInsertRowid;
    });

    test('should delete a characteristic', async () => {
      await request(app)
        .delete(`/api/characteristics/${characteristicId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verify deletion
      const characteristic = db.prepare(`
        SELECT * FROM job_characteristics WHERE id = ?
      `).get(characteristicId);
      
      expect(characteristic).toBeUndefined();
    });

    test('should return 404 for non-existent characteristic', async () => {
      await request(app)
        .delete('/api/characteristics/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Color Assignment Logic', () => {
    test('should assign consistent colors for same characteristic types and values', async () => {
      // Create first characteristic
      const char1Response = await request(app)
        .post(`/api/characteristics/orders/${testOrder.id}/characteristics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'material',
          value: 'steel'
        })
        .expect(201);

      // Create second order with same characteristic
      const order2Result = db.prepare(`
        INSERT INTO manufacturing_orders (
          order_number, stock_code, description, quantity_to_make, 
          current_operation, status, priority, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'TEST002',
        'DEF456',
        'Steel component',
        50,
        'Milling',
        'not_started',
        'medium',
        adminUser.id
      );

      const char2Response = await request(app)
        .post(`/api/characteristics/orders/${order2Result.lastInsertRowid}/characteristics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'material',
          value: 'steel'
        })
        .expect(201);

      // Both characteristics should have the same color
      expect(char1Response.body.color).toBe(char2Response.body.color);
    });
  });
});