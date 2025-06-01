const request = require('supertest');
const { app } = require('../../src/testApp');
const { 
  setupTestDatabase,
  createTestUsers,
  generateTestTokens,
  createAuthHeader,
  assertApiResponse,
  assertErrorResponse,
  cleanupTestData
} = require('../helpers/testUtils');

describe('Authentication Endpoints', () => {
  let db;
  let testUsers;

  beforeAll(async () => {
    db = await setupTestDatabase();
    testUsers = await createTestUsers(db);
  });

  afterAll(async () => {
    cleanupTestData(db);
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsers.admin.username,
          password: 'testpass123'
        });

      const body = assertApiResponse(response, 200);
      
      expect(body).toHaveProperty('message', 'Login successful');
      expect(body).toHaveProperty('user');
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      
      expect(body.user).toHaveProperty('username', testUsers.admin.username);
      expect(body.user).toHaveProperty('role', 'admin');
      expect(body.user).not.toHaveProperty('password_hash');
      
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    test('should reject invalid username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'testpass123'
        });

      assertErrorResponse(response, 401, 'LOGIN_FAILED');
    });

    test('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsers.admin.username,
          password: 'wrongpassword'
        });

      assertErrorResponse(response, 401, 'LOGIN_FAILED');
    });

    test('should reject missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      assertErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    test('should validate request body', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: '', // Empty username
          password: 'testpass123'
        });

      assertErrorResponse(response, 400);
    });
  });

  describe('POST /api/auth/register', () => {
    test('should register new user with valid data', async () => {
      const newUser = {
        username: 'newuser',
        email: 'newuser@test.com',
        password: 'newpass123',
        role: 'viewer',
        first_name: 'New',
        last_name: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser);

      const body = assertApiResponse(response, 201);
      
      expect(body).toHaveProperty('message', 'User registered successfully');
      expect(body).toHaveProperty('user');
      expect(body.user).toHaveProperty('username', 'newuser');
      expect(body.user).toHaveProperty('role', 'viewer');
      expect(body.user).not.toHaveProperty('password_hash');
    });

    test('should reject duplicate username', async () => {
      const duplicateUser = {
        username: testUsers.admin.username, // Already exists
        email: 'different@test.com',
        password: 'testpass123',
        role: 'viewer'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser);

      assertErrorResponse(response, 409, 'CONFLICT');
    });

    test('should reject duplicate email', async () => {
      const duplicateUser = {
        username: 'differentuser',
        email: testUsers.admin.email, // Already exists
        password: 'testpass123',
        role: 'viewer'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser);

      assertErrorResponse(response, 409, 'CONFLICT');
    });

    test('should validate required fields', async () => {
      const invalidUser = {
        username: 'testuser',
        // Missing email, password, role
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser);

      assertErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    test('should validate password length', async () => {
      const invalidUser = {
        username: 'testuser2',
        email: 'test2@test.com',
        password: '123', // Too short
        role: 'viewer'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser);

      assertErrorResponse(response, 400, 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return current user with valid token', async () => {
      const tokens = generateTestTokens(testUsers.admin);
      
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', createAuthHeader(tokens.accessToken));

      const body = assertApiResponse(response, 200);
      
      expect(body).toHaveProperty('user');
      expect(body.user).toHaveProperty('username', testUsers.admin.username);
      expect(body.user).toHaveProperty('role', 'admin');
      expect(body.user).not.toHaveProperty('password_hash');
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      assertErrorResponse(response, 401, 'AUTH_REQUIRED');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      assertErrorResponse(response, 403, 'INVALID_TOKEN');
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('should refresh token with valid refresh token', async () => {
      const tokens = generateTestTokens(testUsers.admin);
      
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: tokens.refreshToken
        });

      const body = assertApiResponse(response, 200);
      
      expect(body).toHaveProperty('message', 'Token refreshed successfully');
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    test('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-refresh-token'
        });

      assertErrorResponse(response, 401, 'REFRESH_FAILED');
    });

    test('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      assertErrorResponse(response, 400, 'MISSING_REFRESH_TOKEN');
    });
  });

  describe('PUT /api/auth/profile', () => {
    test('should update profile with valid data', async () => {
      const tokens = generateTestTokens(testUsers.scheduler);
      
      const updates = {
        first_name: 'Updated',
        last_name: 'Name',
        email: 'updated@test.com'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', createAuthHeader(tokens.accessToken))
        .send(updates);

      const body = assertApiResponse(response, 200);
      
      expect(body).toHaveProperty('message', 'Profile updated successfully');
      expect(body.user.first_name).toBe('Updated');
      expect(body.user.last_name).toBe('Name');
      expect(body.user.email).toBe('updated@test.com');
    });

    test('should reject unauthorized update', async () => {
      const updates = {
        first_name: 'Hacker',
        last_name: 'Name'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .send(updates);

      assertErrorResponse(response, 401, 'AUTH_REQUIRED');
    });

    test('should prevent role updates through profile endpoint', async () => {
      const tokens = generateTestTokens(testUsers.viewer);
      
      const updates = {
        role: 'admin', // Should be ignored
        first_name: 'Attempted'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', createAuthHeader(tokens.accessToken))
        .send(updates);

      const body = assertApiResponse(response, 200);
      
      expect(body.user.role).toBe('viewer'); // Should remain unchanged
      expect(body.user.first_name).toBe('Attempted'); // This should update
    });
  });

  describe('POST /api/auth/change-password', () => {
    test('should change password with valid current password', async () => {
      const tokens = generateTestTokens(testUsers.viewer);
      
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', createAuthHeader(tokens.accessToken))
        .send({
          currentPassword: 'testpass123',
          newPassword: 'newpass456'
        });

      const body = assertApiResponse(response, 200);
      expect(body).toHaveProperty('message', 'Password changed successfully');

      // Verify new password works by logging in
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsers.viewer.username,
          password: 'newpass456'
        });

      assertApiResponse(loginResponse, 200);
    });

    test('should reject incorrect current password', async () => {
      const tokens = generateTestTokens(testUsers.admin);
      
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', createAuthHeader(tokens.accessToken))
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpass456'
        });

      assertErrorResponse(response, 400, 'INVALID_CURRENT_PASSWORD');
    });

    test('should validate new password length', async () => {
      const tokens = generateTestTokens(testUsers.admin);
      
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', createAuthHeader(tokens.accessToken))
        .send({
          currentPassword: 'testpass123',
          newPassword: '123' // Too short
        });

      assertErrorResponse(response, 400, 'PASSWORD_TOO_SHORT');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'testpass123',
          newPassword: 'newpass456'
        });

      assertErrorResponse(response, 401, 'AUTH_REQUIRED');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout successfully with valid token', async () => {
      const tokens = generateTestTokens(testUsers.admin);
      
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', createAuthHeader(tokens.accessToken));

      const body = assertApiResponse(response, 200);
      expect(body).toHaveProperty('message', 'Logout successful');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      assertErrorResponse(response, 401, 'AUTH_REQUIRED');
    });
  });
});