// Global test setup
require('dotenv').config({ path: '.env.test' });

const path = require('path');
const fs = require('fs');
const { getDatabase, closeDatabase } = require('../../src/utils/database');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = './tests/test.db';
process.env.JWT_SECRET = 'test-secret-key';

// Global test timeout
jest.setTimeout(10000);

// Clean up test database before each test suite
beforeAll(async () => {
  const testDbPath = path.resolve('./tests/test.db');
  
  // Remove existing test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  // Remove WAL files if they exist
  if (fs.existsSync(testDbPath + '-wal')) {
    fs.unlinkSync(testDbPath + '-wal');
  }
  if (fs.existsSync(testDbPath + '-shm')) {
    fs.unlinkSync(testDbPath + '-shm');
  }
});

// Close database connections after all tests
afterAll(async () => {
  closeDatabase();
  
  // Clean up test database
  const testDbPath = path.resolve('./tests/test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (fs.existsSync(testDbPath + '-wal')) {
    fs.unlinkSync(testDbPath + '-wal');
  }
  if (fs.existsSync(testDbPath + '-shm')) {
    fs.unlinkSync(testDbPath + '-shm');
  }
});