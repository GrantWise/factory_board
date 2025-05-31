const jwt = require('jsonwebtoken');
const config = require('../../src/config/database');
const { runMigrations } = require('../../database/migrate');
const { getDatabase } = require('../../src/utils/database');
const AuthService = require('../../src/services/authService');

// Test database setup
async function setupTestDatabase() {
  const { getDatabase } = require('../../src/utils/database');
  
  // Get the shared test database
  const db = getDatabase();
  
  // Clear all data for clean test state
  const tables = ['audit_log', 'manufacturing_steps', 'manufacturing_orders', 'machines', 'work_centres', 'users'];
  for (const table of tables) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch (err) {
      // Table might not exist, ignore
    }
  }
  
  return db;
}

// Create test users
async function createTestUsers(db) {
  const timestamp = Date.now();
  const shortTimestamp = timestamp.toString().slice(-6); // Last 6 digits
  const users = {
    admin: {
      username: `testadmin${shortTimestamp}`,
      email: `adm${shortTimestamp}@test.com`,
      password: 'testpass123',
      role: 'admin',
      first_name: 'Test',
      last_name: 'Admin'
    },
    scheduler: {
      username: `testsched${shortTimestamp}`,
      email: `sch${shortTimestamp}@test.com`,
      password: 'testpass123',
      role: 'scheduler',
      first_name: 'Test',
      last_name: 'Scheduler'
    },
    viewer: {
      username: `testview${shortTimestamp}`,
      email: `view${shortTimestamp}@test.com`,
      password: 'testpass123',
      role: 'viewer',
      first_name: 'Test',
      last_name: 'Viewer'
    }
  };

  const createdUsers = {};
  
  for (const [key, userData] of Object.entries(users)) {
    const hashedPassword = await AuthService.hashPassword(userData.password);
    
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, first_name, last_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userData.username,
      userData.email,
      hashedPassword,
      userData.role,
      userData.first_name,
      userData.last_name
    );
    
    createdUsers[key] = {
      id: result.lastInsertRowid,
      ...userData,
      password_hash: hashedPassword
    };
    delete createdUsers[key].password; // Remove plain password
  }
  
  return createdUsers;
}

// Create test work centres
function createTestWorkCentres(db) {
  const workCentres = [
    { name: 'Test Cutting', code: 'TEST-CUT', capacity: 3, display_order: 1 },
    { name: 'Test Assembly', code: 'TEST-ASM', capacity: 5, display_order: 2 },
    { name: 'Test QC', code: 'TEST-QC', capacity: 2, display_order: 3 }
  ];

  const createdWorkCentres = [];
  
  for (const wc of workCentres) {
    const result = db.prepare(`
      INSERT INTO work_centres (name, code, capacity, display_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(wc.name, wc.code, wc.capacity, wc.display_order);
    
    createdWorkCentres.push({
      id: result.lastInsertRowid,
      ...wc
    });
  }
  
  return createdWorkCentres;
}

// Generate JWT tokens for testing
function generateTestTokens(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: '1h'
  });

  const refreshToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: '7d'
  });

  return { accessToken, refreshToken };
}

// Create authorization header
function createAuthHeader(token) {
  return `Bearer ${token}`;
}

// Create test manufacturing order
function createTestOrder(db, workCentreId, createdBy, overrides = {}) {
  const orderData = {
    order_number: `TEST-${Date.now()}`,
    stock_code: 'TEST-WIDGET',
    description: 'Test Widget Assembly',
    quantity_to_make: 100,
    quantity_completed: 0,
    current_operation: 'Test Operation',
    current_work_centre_id: workCentreId,
    status: 'not_started',
    priority: 'medium',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    start_date: new Date().toISOString().split('T')[0],
    created_by: createdBy,
    ...overrides
  };

  const result = db.prepare(`
    INSERT INTO manufacturing_orders (
      order_number, stock_code, description, quantity_to_make, quantity_completed,
      current_operation, current_work_centre_id, status, priority, due_date, start_date, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderData.order_number,
    orderData.stock_code,
    orderData.description,
    orderData.quantity_to_make,
    orderData.quantity_completed,
    orderData.current_operation,
    orderData.current_work_centre_id,
    orderData.status,
    orderData.priority,
    orderData.due_date,
    orderData.start_date,
    orderData.created_by
  );

  return {
    id: result.lastInsertRowid,
    ...orderData
  };
}

// Wait for async operations
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Assert response structure
function assertApiResponse(response, expectedStatus = 200) {
  expect(response.status).toBe(expectedStatus);
  expect(response.headers['content-type']).toMatch(/json/);
  return response.body;
}

// Assert error response
function assertErrorResponse(response, expectedStatus, expectedCode) {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('error');
  if (expectedCode) {
    expect(response.body).toHaveProperty('code', expectedCode);
  }
  return response.body;
}

// Clean up test data
function cleanupTestData(db) {
  if (db && typeof db.close === 'function') {
    try {
      db.close();
    } catch (error) {
      // Ignore close errors
    }
  }
}

module.exports = {
  setupTestDatabase,
  createTestUsers,
  createTestWorkCentres,
  generateTestTokens,
  createAuthHeader,
  createTestOrder,
  delay,
  assertApiResponse,
  assertErrorResponse,
  cleanupTestData
};