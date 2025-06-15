const { getDatabase } = require('../../src/utils/database');
const ERPConnection = require('../../src/models/ERPConnection');

describe('ERPConnection Model', () => {
  let db;
  let testUserId;

  beforeAll(async () => {
    db = getDatabase();
    // Create a test user
    const userResult = db.prepare(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ('testuser', 'test@example.com', 'hash', 'admin')
    `).run();
    testUserId = userResult.lastInsertRowid;
  });

  afterAll(async () => {
    // Clean up test data - delete ERP connections first to avoid foreign key constraints
    db.prepare('DELETE FROM erp_connections WHERE created_by = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    db.close();
  });

  beforeEach(() => {
    // Clean up any ERP connections before each test
    db.prepare('DELETE FROM erp_connections').run();
  });

  describe('create()', () => {
    test('should create a valid ERP connection with all required fields', () => {
      const connectionData = {
        name: 'Test SAP Connection',
        erp_system_type: 'sap_rest',
        is_active: true,
        connection_config: {
          auth_type: 'basic',
          auth_config: {
            username: 'sapuser',
            password: 'sappass123'
          },
          base_url: 'https://sap.example.com',
          endpoints: {
            orders_list: '/api/production-orders'
          },
          rate_limit_per_minute: 60,
          retry_attempts: 3,
          timeout_seconds: 30
        },
        import_settings: {
          duplicate_handling: 'skip',
          update_existing_orders: false,
          required_fields: ['order_number', 'part_number', 'quantity_to_make'],
          auto_generate_characteristics: true,
          batch_size: 100,
          auto_import_enabled: false
        },
        created_by: testUserId
      };

      const connection = ERPConnection.create(connectionData);

      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.name).toBe('Test SAP Connection');
      expect(connection.erp_system_type).toBe('sap_rest');
      expect(connection.is_active).toBe(1);
      expect(connection.connection_config).toEqual(connectionData.connection_config);
      expect(connection.import_settings).toEqual(connectionData.import_settings);
      expect(connection.created_by).toBe(testUserId);
      expect(connection.created_at).toBeDefined();
      expect(connection.updated_at).toBeDefined();
    });

    test('should throw error for missing required fields', () => {
      expect(() => {
        ERPConnection.create({
          // Missing name
          erp_system_type: 'sap_rest',
          connection_config: {},
          import_settings: {},
          created_by: testUserId
        });
      }).toThrow('Connection name is required');

      expect(() => {
        ERPConnection.create({
          name: 'Test Connection',
          // Missing erp_system_type
          connection_config: {},
          import_settings: {},
          created_by: testUserId
        });
      }).toThrow('ERP system type is required');

      expect(() => {
        ERPConnection.create({
          name: 'Test Connection',
          erp_system_type: 'sap_rest',
          // Missing connection_config
          import_settings: {},
          created_by: testUserId
        });
      }).toThrow('Connection config is required');
    });

    test('should throw error for invalid ERP system type', () => {
      expect(() => {
        ERPConnection.create({
          name: 'Test Connection',
          erp_system_type: 'invalid_system',
          connection_config: {
            auth_type: 'api_key',
            auth_config: { api_key: 'test' }
          },
          import_settings: {
            duplicate_handling: 'skip'
          },
          created_by: testUserId
        });
      }).toThrow('Invalid ERP system type');
    });

    test('should throw error for invalid auth configuration', () => {
      expect(() => {
        ERPConnection.create({
          name: 'Test Connection',
          erp_system_type: 'sap_rest',
          connection_config: {
            auth_type: 'api_key',
            auth_config: {} // Missing api_key
          },
          import_settings: {
            duplicate_handling: 'skip'
          },
          created_by: testUserId
        });
      }).toThrow('api_key or api_key_header is required');

      expect(() => {
        ERPConnection.create({
          name: 'Test Connection',
          erp_system_type: 'sap_rest',
          connection_config: {
            auth_type: 'oauth2',
            auth_config: {
              client_id: 'test'
              // Missing client_secret
            }
          },
          import_settings: {
            duplicate_handling: 'skip'
          },
          created_by: testUserId
        });
      }).toThrow('client_id and client_secret are required');
    });

    test('should throw error for invalid import settings', () => {
      expect(() => {
        ERPConnection.create({
          name: 'Test Connection',
          erp_system_type: 'sap_rest',
          connection_config: {
            auth_type: 'api_key',
            auth_config: { api_key: 'test' }
          },
          import_settings: {
            duplicate_handling: 'invalid_handling'
          },
          created_by: testUserId
        });
      }).toThrow('duplicate_handling must be one of: skip, update, create_new');
    });

    test('should prevent duplicate connection names', () => {
      const connectionData = {
        name: 'Duplicate Name Test',
        erp_system_type: 'sap_rest',
        connection_config: {
          auth_type: 'api_key',
          auth_config: { api_key: 'test' }
        },
        import_settings: {
          duplicate_handling: 'skip'
        },
        created_by: testUserId
      };

      ERPConnection.create(connectionData);

      expect(() => {
        ERPConnection.create(connectionData);
      }).toThrow('Connection name must be unique');
    });
  });

  describe('findById()', () => {
    let connectionId;

    beforeEach(() => {
      const connection = ERPConnection.create({
        name: 'Find Test Connection',
        erp_system_type: 'generic_rest',
        connection_config: {
          auth_type: 'bearer',
          auth_config: { token: 'bearer_token' },
          base_url: 'https://api.example.com'
        },
        import_settings: {
          duplicate_handling: 'update',
          batch_size: 50
        },
        created_by: testUserId
      });
      connectionId = connection.id;
    });

    test('should find connection by ID with parsed JSON fields', () => {
      const connection = ERPConnection.findById(connectionId);

      expect(connection).toBeDefined();
      expect(connection.id).toBe(connectionId);
      expect(connection.name).toBe('Find Test Connection');
      expect(typeof connection.connection_config).toBe('object');
      expect(typeof connection.import_settings).toBe('object');
      expect(connection.connection_config.auth_type).toBe('bearer');
      expect(connection.import_settings.duplicate_handling).toBe('update');
      expect(connection.created_by_username).toBe('testuser');
    });

    test('should return null for non-existent connection', () => {
      const connection = ERPConnection.findById(99999);
      expect(connection).toBeNull();
    });
  });

  describe('findAll()', () => {
    beforeEach(() => {
      // Create multiple test connections
      ERPConnection.create({
        name: 'Active SAP Connection',
        erp_system_type: 'sap_rest',
        is_active: true,
        connection_config: {
          auth_type: 'basic',
          auth_config: { username: 'user', password: 'pass' }
        },
        import_settings: { duplicate_handling: 'skip' },
        created_by: testUserId
      });

      ERPConnection.create({
        name: 'Inactive Oracle Connection',
        erp_system_type: 'oracle_erp',
        is_active: false,
        connection_config: {
          auth_type: 'api_key',
          auth_config: { api_key: 'oracle_key' }
        },
        import_settings: { duplicate_handling: 'update' },
        created_by: testUserId
      });

      ERPConnection.create({
        name: 'Generic API Connection',
        erp_system_type: 'generic_rest',
        is_active: true,
        connection_config: {
          auth_type: 'bearer',
          auth_config: { token: 'api_token' }
        },
        import_settings: { duplicate_handling: 'create_new' },
        created_by: testUserId
      });
    });

    test('should return all connections', () => {
      const connections = ERPConnection.findAll();
      expect(connections).toHaveLength(3);
      expect(connections[0].name).toBe('Active SAP Connection'); // Sorted by name
    });

    test('should filter by active status', () => {
      const activeConnections = ERPConnection.findAll({ is_active: 1 });
      expect(activeConnections).toHaveLength(2);
      activeConnections.forEach(conn => {
        expect(conn.is_active).toBe(1);
      });

      const inactiveConnections = ERPConnection.findAll({ is_active: 0 });
      expect(inactiveConnections).toHaveLength(1);
      expect(inactiveConnections[0].name).toBe('Inactive Oracle Connection');
    });

    test('should filter by ERP system type', () => {
      const sapConnections = ERPConnection.findAll({ erp_system_type: 'sap_rest' });
      expect(sapConnections).toHaveLength(1);
      expect(sapConnections[0].name).toBe('Active SAP Connection');
    });

    test('should search by name', () => {
      const searchResults = ERPConnection.findAll({ search: 'SAP' });
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].name).toBe('Active SAP Connection');
    });
  });

  describe('update()', () => {
    let connectionId;

    beforeEach(() => {
      const connection = ERPConnection.create({
        name: 'Update Test Connection',
        erp_system_type: 'sap_rest',
        connection_config: {
          auth_type: 'basic',
          auth_config: { username: 'user', password: 'pass' }
        },
        import_settings: { duplicate_handling: 'skip' },
        created_by: testUserId
      });
      connectionId = connection.id;
    });

    test('should update connection fields', () => {
      const updatedConnection = ERPConnection.update(connectionId, {
        name: 'Updated Connection Name',
        is_active: false,
        connection_config: {
          auth_type: 'api_key',
          auth_config: { api_key: 'new_key' },
          base_url: 'https://updated.example.com'
        }
      });

      expect(updatedConnection.name).toBe('Updated Connection Name');
      expect(updatedConnection.is_active).toBe(0);
      expect(updatedConnection.connection_config.auth_type).toBe('api_key');
      expect(updatedConnection.connection_config.base_url).toBe('https://updated.example.com');
    });

    test('should throw error for non-existent connection', () => {
      expect(() => {
        ERPConnection.update(99999, { name: 'New Name' });
      }).toThrow('Connection not found');
    });

    test('should validate updated data', () => {
      expect(() => {
        ERPConnection.update(connectionId, {
          connection_config: 'invalid_config' // Should be object
        });
      }).toThrow('Connection config must be an object');
    });
  });

  describe('testConnection()', () => {
    let connectionId;

    beforeEach(() => {
      const connection = ERPConnection.create({
        name: 'Test Connection Validation',
        erp_system_type: 'sap_rest',
        connection_config: {
          auth_type: 'basic',
          auth_config: { username: 'user', password: 'pass' },
          base_url: 'https://sap.example.com',
          endpoints: { orders_list: '/api/orders' },
          rate_limit_per_minute: 60,
          retry_attempts: 3
        },
        import_settings: {
          duplicate_handling: 'skip',
          batch_size: 100,
          auto_import_enabled: false
        },
        created_by: testUserId
      });
      connectionId = connection.id;
    });

    test('should return successful test result for valid configuration', () => {
      const testResult = ERPConnection.testConnection(connectionId);

      expect(testResult.status).toBe('success');
      expect(testResult.connection_id).toBe(connectionId);
      expect(testResult.message).toBe('Connection configuration is valid and ready for use');
      expect(testResult.details.config_validation.valid).toBe(true);
      expect(testResult.details.auth_validation.valid).toBe(true);
      expect(testResult.details.import_settings_validation.valid).toBe(true);
      expect(testResult.details.response_time_ms).toBeDefined();
    });

    test('should detect insecure HTTP configuration', () => {
      ERPConnection.update(connectionId, {
        connection_config: {
          auth_type: 'basic',
          auth_config: { username: 'user', password: 'pass' },
          base_url: 'http://insecure.example.com' // HTTP instead of HTTPS
        }
      });

      const testResult = ERPConnection.testConnection(connectionId);
      expect(testResult.warnings).toContain('Using HTTP instead of HTTPS may be insecure');
    });

    test('should provide helpful suggestions', () => {
      ERPConnection.update(connectionId, {
        import_settings: {
          duplicate_handling: 'skip'
          // Missing batch_size and notification_email
        }
      });

      const testResult = ERPConnection.testConnection(connectionId);
      expect(testResult.suggestions.length).toBeGreaterThan(0);
      expect(testResult.suggestions).toContain('Set batch_size to optimize import performance (recommended: 100-500)');
      expect(testResult.suggestions).toContain('Set notification_email to receive alerts about import issues');
    });
  });

  describe('getConfigurationTemplate()', () => {
    test('should return SAP REST template', () => {
      const template = ERPConnection.getConfigurationTemplate('sap_rest');

      expect(template.connection_config.auth_type).toBe('basic');
      expect(template.connection_config.base_url).toBe('https://your-sap-server.com');
      expect(template.connection_config.endpoints.orders_list).toBe('/api/production-orders');
      expect(template.import_settings.duplicate_handling).toBe('skip');
      expect(template.import_settings.required_fields).toContain('order_number');
    });

    test('should return generic REST template', () => {
      const template = ERPConnection.getConfigurationTemplate('generic_rest');

      expect(template.connection_config.auth_type).toBe('api_key');
      expect(template.connection_config.auth_config.api_key_header).toBe('X-API-Key');
      expect(template.import_settings.batch_size).toBe(200);
    });

    test('should return default template for unknown system type', () => {
      const template = ERPConnection.getConfigurationTemplate('unknown_system');

      expect(template.connection_config.auth_type).toBe('api_key');
      expect(template.import_settings.duplicate_handling).toBe('skip');
      expect(template.import_settings.batch_size).toBe(100);
    });
  });

  describe('validateConnectionSecurity()', () => {
    test('should give high security score for secure configuration', () => {
      const secureConfig = {
        name: 'Secure Connection',
        erp_system_type: 'sap_rest',
        connection_config: {
          auth_type: 'oauth2',
          auth_config: {
            client_id: 'secure_client',
            client_secret: 'secure_secret_123456'
          },
          base_url: 'https://secure.example.com',
          rate_limit_per_minute: 100,
          retry_attempts: 3
        },
        import_settings: {
          duplicate_handling: 'skip'
        },
        created_by: testUserId
      };

      const validation = ERPConnection.validateConnectionSecurity(secureConfig);
      expect(validation.valid).toBe(true);
      expect(validation.security_score).toBeGreaterThan(80);
    });

    test('should detect security issues and lower score', () => {
      const insecureConfig = {
        name: 'Insecure Connection',
        erp_system_type: 'sap_rest',
        connection_config: {
          auth_type: 'basic',
          auth_config: {
            username: 'admin',
            password: 'password' // Weak password
          },
          base_url: 'http://insecure.example.com', // HTTP
          rate_limit_per_minute: 2000, // Very high
          retry_attempts: 20 // Too many retries
        },
        import_settings: {
          duplicate_handling: 'skip'
        },
        created_by: testUserId
      };

      const validation = ERPConnection.validateConnectionSecurity(insecureConfig);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.security_score).toBeLessThan(70);
      expect(validation.warnings).toContain('Using HTTP instead of HTTPS is not recommended for production');
      expect(validation.warnings).toContain('Basic authentication is less secure than API keys or OAuth2');
      expect(validation.warnings).toContain('Password appears to be a common/default value');
    });
  });

  describe('delete()', () => {
    let connectionId;

    beforeEach(() => {
      const connection = ERPConnection.create({
        name: 'Delete Test Connection',
        erp_system_type: 'sap_rest',
        connection_config: {
          auth_type: 'api_key',
          auth_config: { api_key: 'test_key' }
        },
        import_settings: { duplicate_handling: 'skip' },
        created_by: testUserId
      });
      connectionId = connection.id;
    });

    test('should delete connection successfully', () => {
      const result = ERPConnection.delete(connectionId);
      expect(result.changes).toBe(1);

      const connection = ERPConnection.findById(connectionId);
      expect(connection).toBeNull();
    });

    test('should throw error for non-existent connection', () => {
      expect(() => {
        ERPConnection.delete(99999);
      }).toThrow('Connection not found');
    });
  });

  describe('getUsageStats()', () => {
    let connectionId;

    beforeEach(() => {
      const connection = ERPConnection.create({
        name: 'Stats Test Connection',
        erp_system_type: 'sap_rest',
        connection_config: {
          auth_type: 'api_key',
          auth_config: { api_key: 'test_key' }
        },
        import_settings: { duplicate_handling: 'skip' },
        created_by: testUserId
      });
      connectionId = connection.id;
    });

    test('should return usage statistics', () => {
      const stats = ERPConnection.getUsageStats(connectionId);

      expect(stats.connection_id).toBe(connectionId);
      expect(stats.total_imports).toBe(0);
      expect(stats.successful_imports).toBe(0);
      expect(stats.failed_imports).toBe(0);
      expect(stats.linked_orders).toBe(0);
      expect(stats.active_conflicts).toBe(0);
    });

    test('should throw error for non-existent connection', () => {
      expect(() => {
        ERPConnection.getUsageStats(99999);
      }).toThrow('Connection not found');
    });
  });
});