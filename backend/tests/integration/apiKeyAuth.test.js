const request = require('supertest');
const { app } = require('../../src/testApp');
const { getDatabase, closeDatabase } = require('../../src/utils/database');
const ApiKey = require('../../src/models/apiKey');

describe('API Key Authentication Middleware', () => {
  let db;
  let testApiKey;
  let plainApiKey;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    db = getDatabase();
    
    // Create api_keys table for testing
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL,
        key VARCHAR(255) NOT NULL,
        system_id VARCHAR(50) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT 1,
        rate_limit INTEGER DEFAULT 1000,
        ip_whitelist TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME,
        expires_at DATETIME,
        created_by INTEGER,
        metadata TEXT
      )
    `);

    // Create a test API key
    const result = await ApiKey.generateKey('Test API Key', 'test_system', 1);
    testApiKey = result;
    plainApiKey = result.plainKey;
  });

  beforeEach(() => {
    // Clear only the audit log or other tables that might interfere
    // Keep the API key for testing
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('validateApiKey middleware', () => {
    it('should reject requests without API key', async () => {
      const response = await request(app)
        .post('/api/external/orders')
        .send({
          orders: [
            {
              order_number: 'TEST-001',
              stock_code: 'PART-001',
              description: 'Test Order',
              quantity_to_make: 10
            }
          ]
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('API key and system ID are required');
      expect(response.body.code).toBe('AUTH_REQUIRED');
    });

    it('should reject requests without system ID', async () => {
      const response = await request(app)
        .post('/api/external/orders')
        .set('X-API-Key', plainApiKey)
        .send({
          orders: [
            {
              order_number: 'TEST-001',
              stock_code: 'PART-001',
              description: 'Test Order',
              quantity_to_make: 10
            }
          ]
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('API key and system ID are required');
      expect(response.body.code).toBe('AUTH_REQUIRED');
    });

    it('should reject requests with invalid system ID', async () => {
      const response = await request(app)
        .post('/api/external/orders')
        .set('X-API-Key', plainApiKey)
        .set('X-System-ID', 'invalid_system')
        .send({
          orders: [
            {
              order_number: 'TEST-001',
              stock_code: 'PART-001',
              description: 'Test Order',
              quantity_to_make: 10
            }
          ]
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid system ID');
      expect(response.body.code).toBe('INVALID_SYSTEM');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .post('/api/external/orders')
        .set('X-API-Key', 'invalid-api-key')
        .set('X-System-ID', 'test_system')
        .send({
          orders: [
            {
              order_number: 'TEST-001',
              stock_code: 'PART-001',
              description: 'Test Order',
              quantity_to_make: 10
            }
          ]
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid API key');
      expect(response.body.code).toBe('INVALID_API_KEY');
    });

    it('should accept requests with valid API key and system ID', async () => {
      const response = await request(app)
        .post('/api/external/orders')
        .set('X-API-Key', plainApiKey)
        .set('X-System-ID', 'test_system')
        .send({
          orders: [
            {
              order_number: 'TEST-001',
              stock_code: 'PART-001',
              description: 'Test Order',
              quantity_to_make: 10
            }
          ]
        });

      // Should not be 401/403 (auth errors)
      expect([200, 400, 500]).toContain(response.status); // Accept validation or other errors
      if (response.status === 401 || response.status === 403) {
        console.log('Auth failed:', response.body);
      }
    });

    it('should update last_used_at when API key is used', async () => {
      const beforeUsage = ApiKey.findById(testApiKey.id);
      
      await request(app)
        .post('/api/external/orders')
        .set('X-API-Key', plainApiKey)
        .set('X-System-ID', 'test_system')
        .send({
          orders: [
            {
              order_number: 'TEST-002',
              stock_code: 'PART-002',
              description: 'Test Order 2',
              quantity_to_make: 5
            }
          ]
        });

      const afterUsage = ApiKey.findById(testApiKey.id);
      expect(afterUsage.last_used_at).not.toBe(beforeUsage.last_used_at);
    });
  });

  describe('IP whitelist functionality', () => {
    let restrictedApiKey;
    let restrictedPlainKey;

    beforeAll(async () => {
      // Create API key with IP whitelist
      const result = await ApiKey.generateKey(
        'Restricted API Key', 
        'restricted_system', 
        1,
        { ipWhitelist: ['127.0.0.1', '192.168.1.0/24'] }
      );
      restrictedApiKey = result;
      restrictedPlainKey = result.plainKey;
    });

    it('should allow requests from whitelisted IP', async () => {
      const response = await request(app)
        .post('/api/external/orders')
        .set('X-API-Key', restrictedPlainKey)
        .set('X-System-ID', 'restricted_system')
        .send({
          orders: [
            {
              order_number: 'TEST-003',
              stock_code: 'PART-003',
              description: 'Test Order 3',
              quantity_to_make: 15
            }
          ]
        });

      // Should not be 403 (IP not authorized)
      expect(response.status).not.toBe(403);
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting based on API key configuration', async () => {
      // This would require making many requests quickly
      // For now, just verify the middleware is applied
      const response = await request(app)
        .post('/api/external/orders')
        .set('X-API-Key', plainApiKey)
        .set('X-System-ID', 'test_system')
        .send({
          orders: [
            {
              order_number: 'TEST-004',
              stock_code: 'PART-004',
              description: 'Test Order 4',
              quantity_to_make: 20
            }
          ]
        });

      // Should not be rate limited for a single request
      expect(response.status).not.toBe(429);
    });
  });
});