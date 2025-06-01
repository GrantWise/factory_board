/**
 * Basic Unit Tests
 * ================
 *
 * These tests verify the core backend test utilities and setup functions.
 * They ensure the test database, user creation, and token generation work as expected.
 *
 * This file serves as an example of how to write simple unit tests for backend logic.
 *
 * Each test includes comments to explain what is being tested and why.
 */
const { 
  setupTestDatabase,
  createTestUsers,
  generateTestTokens,
  cleanupTestData
} = require('../helpers/testUtils');

describe('Basic Test Setup', () => {
  let db;

  beforeAll(async () => {
    db = await setupTestDatabase();
  });

  afterAll(async () => {
    cleanupTestData(db);
  });

  test('should set up test database', () => {
    expect(db).toBeDefined();
    
    // Test basic database operation
    const result = db.prepare('SELECT 1 as test').get();
    expect(result.test).toBe(1);
  });

  test('should create test users', async () => {
    const users = await createTestUsers(db);
    
    expect(users).toHaveProperty('admin');
    expect(users).toHaveProperty('scheduler');
    expect(users).toHaveProperty('viewer');
    
    expect(users.admin.role).toBe('admin');
    expect(users.scheduler.role).toBe('scheduler');
    expect(users.viewer.role).toBe('viewer');
  });

  test('should generate JWT tokens', async () => {
    const users = await createTestUsers(db);
    const tokens = generateTestTokens(users.admin);
    
    expect(tokens).toHaveProperty('accessToken');
    expect(tokens).toHaveProperty('refreshToken');
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');
  });
});