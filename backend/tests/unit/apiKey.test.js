const ApiKey = require('../../src/models/apiKey');
const { getDatabase, closeDatabase } = require('../../src/utils/database');
const bcrypt = require('bcryptjs');

describe('ApiKey Model', () => {
  let db;

  beforeAll(() => {
    // Use test database
    process.env.NODE_ENV = 'test';
    db = getDatabase();
    
    // Create a test user for foreign key references
    db.exec(`
      INSERT OR IGNORE INTO users (id, username, email, password_hash, role)
      VALUES (1, 'testuser', 'test@example.com', 'hash', 'admin')
    `);
    
    // Create api_keys table for testing (without foreign key constraint for simplicity)
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
  });

  beforeEach(() => {
    // Clear api_keys table before each test
    db.exec('DELETE FROM api_keys');
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('create', () => {
    it('should create a new API key with required fields', () => {
      const apiKeyData = {
        name: 'Test API Key',
        key: 'hashed_test_key',
        system_id: 'test_system',
        created_by: 1
      };

      const result = ApiKey.create(apiKeyData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(apiKeyData.name);
      expect(result.system_id).toBe(apiKeyData.system_id);
      expect(result.is_active).toBe(1);
      expect(result.rate_limit).toBe(1000); // default value
    });

    it('should create API key with custom rate limit and IP whitelist', () => {
      const apiKeyData = {
        name: 'Test API Key',
        key: 'hashed_test_key',
        system_id: 'test_system',
        created_by: 1,
        rate_limit: 500,
        ip_whitelist: ['192.168.1.1', '10.0.0.0/8']
      };

      const result = ApiKey.create(apiKeyData);

      expect(result.rate_limit).toBe(500);
      expect(result.ip_whitelist).toEqual(['192.168.1.1', '10.0.0.0/8']);
    });

    it('should store IP whitelist and metadata as JSON strings', () => {
      const apiKeyData = {
        name: 'Test API Key',
        key: 'hashed_test_key',
        system_id: 'test_system',
        created_by: 1,
        ip_whitelist: ['192.168.1.1'],
        metadata: { source: 'test', version: '1.0' }
      };

      const result = ApiKey.create(apiKeyData);

      // Check that the data is properly parsed back
      expect(Array.isArray(result.ip_whitelist)).toBe(true);
      expect(typeof result.metadata).toBe('object');
      expect(result.metadata.source).toBe('test');
    });
  });

  describe('findById', () => {
    it('should find API key by ID', () => {
      const apiKeyData = {
        name: 'Test API Key',
        key: 'hashed_test_key',
        system_id: 'test_system',
        created_by: 1
      };

      const created = ApiKey.create(apiKeyData);
      const found = ApiKey.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.name).toBe(apiKeyData.name);
      expect(found.system_id).toBe(apiKeyData.system_id);
    });

    it('should return undefined for non-existent ID', () => {
      const result = ApiKey.findById(999);
      expect(result).toBeUndefined();
    });
  });

  describe('findBySystemId', () => {
    it('should find active API key by system ID', () => {
      const apiKeyData = {
        name: 'Test API Key',
        key: 'hashed_test_key',
        system_id: 'test_system',
        created_by: 1,
        is_active: 1
      };

      ApiKey.create(apiKeyData);
      const found = ApiKey.findBySystemId('test_system');

      expect(found).toBeDefined();
      expect(found.system_id).toBe('test_system');
      expect(found.is_active).toBe(1);
    });

    it('should not find inactive API key by system ID', () => {
      const apiKeyData = {
        name: 'Test API Key',
        key: 'hashed_test_key',
        system_id: 'test_system',
        created_by: 1,
        is_active: 0
      };

      ApiKey.create(apiKeyData);
      const found = ApiKey.findBySystemId('test_system');

      expect(found).toBeUndefined();
    });

    it('should return undefined for non-existent system ID', () => {
      const result = ApiKey.findBySystemId('non_existent');
      expect(result).toBeUndefined();
    });
  });

  describe('generateKey', () => {
    it('should generate new API key with hashed key', async () => {
      const result = await ApiKey.generateKey('Test API Key', 'test_system', 1);

      expect(result).toBeDefined();
      expect(result.plainKey).toBeDefined();
      expect(result.name).toBe('Test API Key');
      expect(result.system_id).toBe('test_system');
      expect(result.is_active).toBe(1);

      // Check that the key is properly hashed in database
      const dbRecord = db.prepare('SELECT key FROM api_keys WHERE id = ?').get(result.id);
      expect(dbRecord.key).not.toBe(result.plainKey);
      expect(dbRecord.key.length).toBeGreaterThan(50); // bcrypt hash length
    });

    it('should generate API key with custom options', async () => {
      const options = {
        rateLimit: 2000,
        ipWhitelist: ['192.168.1.1'],
        expiresAt: '2024-12-31 23:59:59',
        metadata: { source: 'test' }
      };

      const result = await ApiKey.generateKey('Test API Key', 'test_system', 1, options);

      expect(result.rate_limit).toBe(2000);
      expect(result.ip_whitelist).toEqual(['192.168.1.1']);
      expect(result.expires_at).toBe('2024-12-31 23:59:59');
      expect(result.metadata.source).toBe('test');
    });
  });

  describe('verifyKey', () => {
    it('should verify valid API key', async () => {
      const plainKey = 'test-api-key-12345';
      const hashedKey = await bcrypt.hash(plainKey, 10);

      ApiKey.create({
        name: 'Test API Key',
        key: hashedKey,
        system_id: 'test_system',
        created_by: 1,
        is_active: 1
      });

      const isValid = await ApiKey.verifyKey(plainKey, 'test_system');
      expect(isValid).toBe(true);
    });

    it('should reject invalid API key', async () => {
      const plainKey = 'test-api-key-12345';
      const hashedKey = await bcrypt.hash(plainKey, 10);

      ApiKey.create({
        name: 'Test API Key',
        key: hashedKey,
        system_id: 'test_system',
        created_by: 1,
        is_active: 1
      });

      const isValid = await ApiKey.verifyKey('wrong-key', 'test_system');
      expect(isValid).toBe(false);
    });

    it('should reject expired API key', async () => {
      const plainKey = 'test-api-key-12345';
      const hashedKey = await bcrypt.hash(plainKey, 10);
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago

      ApiKey.create({
        name: 'Test API Key',
        key: hashedKey,
        system_id: 'test_system',
        created_by: 1,
        is_active: 1,
        expires_at: pastDate
      });

      const isValid = await ApiKey.verifyKey(plainKey, 'test_system');
      expect(isValid).toBe(false);
    });

    it('should update last_used_at when key is valid', async () => {
      const plainKey = 'test-api-key-12345';
      const hashedKey = await bcrypt.hash(plainKey, 10);

      const created = ApiKey.create({
        name: 'Test API Key',
        key: hashedKey,
        system_id: 'test_system',
        created_by: 1,
        is_active: 1
      });

      expect(created.last_used_at).toBeNull();

      await ApiKey.verifyKey(plainKey, 'test_system');

      const updated = ApiKey.findById(created.id);
      expect(updated.last_used_at).not.toBeNull();
    });
  });

  describe('update', () => {
    it('should update API key fields', () => {
      const created = ApiKey.create({
        name: 'Test API Key',
        key: 'hashed_test_key',
        system_id: 'test_system',
        created_by: 1
      });

      const updateData = {
        name: 'Updated API Key',
        rate_limit: 2000,
        is_active: 0
      };

      const updated = ApiKey.update(created.id, updateData);

      expect(updated.name).toBe('Updated API Key');
      expect(updated.rate_limit).toBe(2000);
      expect(updated.is_active).toBe(0);
      expect(updated.system_id).toBe('test_system'); // unchanged
    });

    it('should handle IP whitelist and metadata updates', () => {
      const created = ApiKey.create({
        name: 'Test API Key',
        key: 'hashed_test_key',
        system_id: 'test_system',
        created_by: 1
      });

      const updateData = {
        ip_whitelist: ['192.168.1.1', '10.0.0.0/8'],
        metadata: { updated: true, version: '2.0' }
      };

      const updated = ApiKey.update(created.id, updateData);

      expect(updated.ip_whitelist).toEqual(['192.168.1.1', '10.0.0.0/8']);
      expect(updated.metadata.updated).toBe(true);
      expect(updated.metadata.version).toBe('2.0');
    });
  });

  describe('delete', () => {
    it('should soft delete API key', () => {
      const created = ApiKey.create({
        name: 'Test API Key',
        key: 'hashed_test_key',
        system_id: 'test_system',
        created_by: 1,
        is_active: 1
      });

      ApiKey.delete(created.id);

      const found = ApiKey.findById(created.id);
      expect(found.is_active).toBe(0);

      // Should not be found by findBySystemId (only returns active)
      const foundBySystemId = ApiKey.findBySystemId('test_system');
      expect(foundBySystemId).toBeUndefined();
    });
  });

  describe('systemIdExists', () => {
    it('should return true if system ID exists', () => {
      ApiKey.create({
        name: 'Test API Key',
        key: 'hashed_test_key',
        system_id: 'test_system',
        created_by: 1
      });

      const exists = ApiKey.systemIdExists('test_system');
      expect(exists).toBe(true);
    });

    it('should return false if system ID does not exist', () => {
      const exists = ApiKey.systemIdExists('non_existent');
      expect(exists).toBe(false);
    });

    it('should exclude specific ID when checking existence', () => {
      const created = ApiKey.create({
        name: 'Test API Key',
        key: 'hashed_test_key',
        system_id: 'test_system',
        created_by: 1
      });

      const exists = ApiKey.systemIdExists('test_system', created.id);
      expect(exists).toBe(false);
    });
  });

  describe('rotateKey', () => {
    it('should generate new key for existing API key', async () => {
      const originalHashedKey = await bcrypt.hash('original-key', 10);
      const created = ApiKey.create({
        name: 'Test API Key',
        key: originalHashedKey,
        system_id: 'test_system',
        created_by: 1
      });

      const newPlainKey = await ApiKey.rotateKey(created.id, 1);

      expect(newPlainKey).toBeDefined();
      expect(typeof newPlainKey).toBe('string');

      // Check that the key was updated in database by getting raw data
      const updatedRaw = db.prepare('SELECT key FROM api_keys WHERE id = ?').get(created.id);
      expect(updatedRaw.key).not.toBe(originalHashedKey);

      // Verify that the new key works
      const isValid = await ApiKey.verifyKey(newPlainKey, 'test_system');
      expect(isValid).toBe(true);

      // Verify old key no longer works
      const oldKeyValid = await ApiKey.verifyKey('original-key', 'test_system');
      expect(oldKeyValid).toBe(false);
    });
  });
});