const request = require('supertest');
const { app } = require('../../src/testApp');
const { 
  setupTestDatabase,
  createTestUsers,
  createTestWorkCentres,
  createTestOrder,
  generateTestTokens,
  createAuthHeader,
  assertApiResponse,
  assertErrorResponse,
  cleanupTestData
} = require('../helpers/testUtils');

describe('Role-Based Access Control', () => {
  let db;
  let testUsers;
  let testWorkCentres;
  let testOrder;
  let adminToken;
  let schedulerToken;
  let viewerToken;

  beforeAll(async () => {
    db = await setupTestDatabase();
    testUsers = await createTestUsers(db);
    testWorkCentres = createTestWorkCentres(db);
    testOrder = createTestOrder(db, testWorkCentres[0].id, testUsers.admin.id);
    
    const adminTokens = generateTestTokens(testUsers.admin);
    const schedulerTokens = generateTestTokens(testUsers.scheduler);
    const viewerTokens = generateTestTokens(testUsers.viewer);
    
    adminToken = adminTokens.accessToken;
    schedulerToken = schedulerTokens.accessToken;
    viewerToken = viewerTokens.accessToken;
  });

  afterAll(async () => {
    cleanupTestData(db);
  });

  describe('Admin Role Permissions', () => {
    test('admin should have full access to users', async () => {
      // GET users
      const getResponse = await request(app)
        .get('/api/users')
        .set('Authorization', createAuthHeader(adminToken));
      assertApiResponse(getResponse, 200);

      // POST user
      const newUser = {
        username: 'perm_test_user',
        email: 'permtest@test.com',
        password: 'testpass123',
        role: 'viewer'
      };
      
      const postResponse = await request(app)
        .post('/api/users')
        .set('Authorization', createAuthHeader(adminToken))
        .send(newUser);
      assertApiResponse(postResponse, 201);

      const userId = postResponse.body.user.id;

      // PUT user
      const putResponse = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', createAuthHeader(adminToken))
        .send({ first_name: 'Updated' });
      assertApiResponse(putResponse, 200);

      // DELETE user
      const deleteResponse = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Authorization', createAuthHeader(adminToken));
      assertApiResponse(deleteResponse, 200);
    });

    test('admin should have full access to work centres', async () => {
      // GET work centres
      const getResponse = await request(app)
        .get('/api/work-centres')
        .set('Authorization', createAuthHeader(adminToken));
      assertApiResponse(getResponse, 200);

      // POST work centre
      const newWorkCentre = {
        name: 'Admin Test Centre',
        code: 'ADMIN-TEST',
        capacity: 5
      };
      
      const postResponse = await request(app)
        .post('/api/work-centres')
        .set('Authorization', createAuthHeader(adminToken))
        .send(newWorkCentre);
      assertApiResponse(postResponse, 201);

      const workCentreId = postResponse.body.workCentre.id;

      // PUT work centre
      const putResponse = await request(app)
        .put(`/api/work-centres/${workCentreId}`)
        .set('Authorization', createAuthHeader(adminToken))
        .send({ name: 'Updated Admin Centre' });
      assertApiResponse(putResponse, 200);

      // DELETE work centre
      const deleteResponse = await request(app)
        .delete(`/api/work-centres/${workCentreId}`)
        .set('Authorization', createAuthHeader(adminToken));
      assertApiResponse(deleteResponse, 200);
    });

    test('admin should have full access to orders', async () => {
      // GET orders
      const getResponse = await request(app)
        .get('/api/orders')
        .set('Authorization', createAuthHeader(adminToken));
      assertApiResponse(getResponse, 200);

      // POST order
      const newOrder = {
        order_number: `ADMIN-TEST-${Date.now()}`,
        stock_code: 'ADMIN-WIDGET',
        description: 'Admin Test Widget',
        quantity_to_make: 10
      };
      
      const postResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', createAuthHeader(adminToken))
        .send(newOrder);
      assertApiResponse(postResponse, 201);

      const orderId = postResponse.body.order.id;

      // PUT order
      const putResponse = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', createAuthHeader(adminToken))
        .send({ description: 'Updated Admin Widget' });
      assertApiResponse(putResponse, 200);

      // DELETE order
      const deleteResponse = await request(app)
        .delete(`/api/orders/${orderId}`)
        .set('Authorization', createAuthHeader(adminToken));
      assertApiResponse(deleteResponse, 200);
    });

    test('admin should have access to analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', createAuthHeader(adminToken));
      assertApiResponse(response, 200);
    });
  });

  describe('Scheduler Role Permissions', () => {
    test('scheduler should NOT have access to users', async () => {
      // GET users - should be forbidden
      const getResponse = await request(app)
        .get('/api/users')
        .set('Authorization', createAuthHeader(schedulerToken));
      assertErrorResponse(getResponse, 403, 'INSUFFICIENT_PERMISSIONS');

      // POST user - should be forbidden
      const postResponse = await request(app)
        .post('/api/users')
        .set('Authorization', createAuthHeader(schedulerToken))
        .send({
          username: 'sched_test_user',
          email: 'schedtest@test.com',
          password: 'testpass123',
          role: 'viewer'
        });
      assertErrorResponse(postResponse, 403, 'INSUFFICIENT_PERMISSIONS');
    });

    test('scheduler should have read access to work centres but no write access', async () => {
      // GET work centres - should work
      const getResponse = await request(app)
        .get('/api/work-centres')
        .set('Authorization', createAuthHeader(schedulerToken));
      assertApiResponse(getResponse, 200);

      // POST work centre - should be forbidden
      const postResponse = await request(app)
        .post('/api/work-centres')
        .set('Authorization', createAuthHeader(schedulerToken))
        .send({
          name: 'Scheduler Test Centre',
          code: 'SCHED-TEST',
          capacity: 3
        });
      assertErrorResponse(postResponse, 403, 'INSUFFICIENT_PERMISSIONS');

      // PUT work centre - should be forbidden
      const putResponse = await request(app)
        .put(`/api/work-centres/${testWorkCentres[0].id}`)
        .set('Authorization', createAuthHeader(schedulerToken))
        .send({ name: 'Unauthorized Update' });
      assertErrorResponse(putResponse, 403, 'INSUFFICIENT_PERMISSIONS');

      // DELETE work centre - should be forbidden
      const deleteResponse = await request(app)
        .delete(`/api/work-centres/${testWorkCentres[0].id}`)
        .set('Authorization', createAuthHeader(schedulerToken));
      assertErrorResponse(deleteResponse, 403, 'INSUFFICIENT_PERMISSIONS');
    });

    test('scheduler should have read/write access to orders but no delete', async () => {
      // GET orders - should work
      const getResponse = await request(app)
        .get('/api/orders')
        .set('Authorization', createAuthHeader(schedulerToken));
      assertApiResponse(getResponse, 200);

      // POST order - should work
      const newOrder = {
        order_number: `SCHED-TEST-${Date.now()}`,
        stock_code: 'SCHED-WIDGET',
        description: 'Scheduler Test Widget',
        quantity_to_make: 5
      };
      
      const postResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', createAuthHeader(schedulerToken))
        .send(newOrder);
      assertApiResponse(postResponse, 201);

      const orderId = postResponse.body.order.id;

      // PUT order - should work
      const putResponse = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', createAuthHeader(schedulerToken))
        .send({ description: 'Updated Scheduler Widget' });
      assertApiResponse(putResponse, 200);

      // DELETE order - should be forbidden
      const deleteResponse = await request(app)
        .delete(`/api/orders/${orderId}`)
        .set('Authorization', createAuthHeader(schedulerToken));
      assertErrorResponse(deleteResponse, 403, 'INSUFFICIENT_PERMISSIONS');
    });

    test('scheduler should have move permissions for orders', async () => {
      // Move order - should work
      const moveResponse = await request(app)
        .put(`/api/orders/${testOrder.id}/move`)
        .set('Authorization', createAuthHeader(schedulerToken))
        .send({
          to_work_centre_id: testWorkCentres[1].id,
          reason: 'scheduler_test'
        });
      assertApiResponse(moveResponse, 200);

      // Start drag - should work
      const startDragResponse = await request(app)
        .post(`/api/orders/${testOrder.id}/start-move`)
        .set('Authorization', createAuthHeader(schedulerToken))
        .send({ orderNumber: testOrder.order_number });
      assertApiResponse(startDragResponse, 200);

      // End drag - should work
      const endDragResponse = await request(app)
        .post(`/api/orders/${testOrder.id}/end-move`)
        .set('Authorization', createAuthHeader(schedulerToken))
        .send({ completed: true });
      assertApiResponse(endDragResponse, 200);
    });

    test('scheduler should have access to analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', createAuthHeader(schedulerToken));
      assertApiResponse(response, 200);
    });
  });

  describe('Viewer Role Permissions', () => {
    test('viewer should NOT have access to users', async () => {
      const getResponse = await request(app)
        .get('/api/users')
        .set('Authorization', createAuthHeader(viewerToken));
      assertErrorResponse(getResponse, 403, 'INSUFFICIENT_PERMISSIONS');

      const postResponse = await request(app)
        .post('/api/users')
        .set('Authorization', createAuthHeader(viewerToken))
        .send({
          username: 'viewer_test_user',
          email: 'viewertest@test.com',
          password: 'testpass123',
          role: 'viewer'
        });
      assertErrorResponse(postResponse, 403, 'INSUFFICIENT_PERMISSIONS');
    });

    test('viewer should have read-only access to work centres', async () => {
      // GET work centres - should work
      const getResponse = await request(app)
        .get('/api/work-centres')
        .set('Authorization', createAuthHeader(viewerToken));
      assertApiResponse(getResponse, 200);

      // POST work centre - should be forbidden
      const postResponse = await request(app)
        .post('/api/work-centres')
        .set('Authorization', createAuthHeader(viewerToken))
        .send({
          name: 'Viewer Test Centre',
          code: 'VIEWER-TEST',
          capacity: 2
        });
      assertErrorResponse(postResponse, 403, 'INSUFFICIENT_PERMISSIONS');

      // PUT work centre - should be forbidden
      const putResponse = await request(app)
        .put(`/api/work-centres/${testWorkCentres[0].id}`)
        .set('Authorization', createAuthHeader(viewerToken))
        .send({ name: 'Unauthorized Update' });
      assertErrorResponse(putResponse, 403, 'INSUFFICIENT_PERMISSIONS');

      // DELETE work centre - should be forbidden
      const deleteResponse = await request(app)
        .delete(`/api/work-centres/${testWorkCentres[0].id}`)
        .set('Authorization', createAuthHeader(viewerToken));
      assertErrorResponse(deleteResponse, 403, 'INSUFFICIENT_PERMISSIONS');
    });

    test('viewer should have read-only access to orders', async () => {
      // GET orders - should work
      const getResponse = await request(app)
        .get('/api/orders')
        .set('Authorization', createAuthHeader(viewerToken));
      assertApiResponse(getResponse, 200);

      // GET specific order - should work
      const getOrderResponse = await request(app)
        .get(`/api/orders/${testOrder.id}`)
        .set('Authorization', createAuthHeader(viewerToken));
      assertApiResponse(getOrderResponse, 200);

      // POST order - should be forbidden
      const postResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', createAuthHeader(viewerToken))
        .send({
          order_number: `VIEWER-TEST-${Date.now()}`,
          stock_code: 'VIEWER-WIDGET',
          description: 'Viewer Test Widget',
          quantity_to_make: 1
        });
      assertErrorResponse(postResponse, 403, 'INSUFFICIENT_PERMISSIONS');

      // PUT order - should be forbidden
      const putResponse = await request(app)
        .put(`/api/orders/${testOrder.id}`)
        .set('Authorization', createAuthHeader(viewerToken))
        .send({ description: 'Unauthorized Update' });
      assertErrorResponse(putResponse, 403, 'INSUFFICIENT_PERMISSIONS');

      // DELETE order - should be forbidden
      const deleteResponse = await request(app)
        .delete(`/api/orders/${testOrder.id}`)
        .set('Authorization', createAuthHeader(viewerToken));
      assertErrorResponse(deleteResponse, 403, 'INSUFFICIENT_PERMISSIONS');
    });

    test('viewer should NOT have move permissions for orders', async () => {
      // Move order - should be forbidden
      const moveResponse = await request(app)
        .put(`/api/orders/${testOrder.id}/move`)
        .set('Authorization', createAuthHeader(viewerToken))
        .send({
          to_work_centre_id: testWorkCentres[1].id,
          reason: 'viewer_test'
        });
      assertErrorResponse(moveResponse, 403, 'INSUFFICIENT_PERMISSIONS');

      // Start drag - should be forbidden
      const startDragResponse = await request(app)
        .post(`/api/orders/${testOrder.id}/start-move`)
        .set('Authorization', createAuthHeader(viewerToken))
        .send({ orderNumber: testOrder.order_number });
      assertErrorResponse(startDragResponse, 403, 'INSUFFICIENT_PERMISSIONS');

      // End drag - should be forbidden
      const endDragResponse = await request(app)
        .post(`/api/orders/${testOrder.id}/end-move`)
        .set('Authorization', createAuthHeader(viewerToken))
        .send({ completed: false });
      assertErrorResponse(endDragResponse, 403, 'INSUFFICIENT_PERMISSIONS');
    });

    test('viewer should have access to analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', createAuthHeader(viewerToken));
      assertApiResponse(response, 200);
    });

    test('viewer should have read access to planning board', async () => {
      const response = await request(app)
        .get('/api/planning-board')
        .set('Authorization', createAuthHeader(viewerToken));
      assertApiResponse(response, 200);
    });
  });

  describe('Cross-Role Permission Validation', () => {
    test('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', 'Bearer invalid-token');
      assertErrorResponse(response, 403, 'INVALID_TOKEN');
    });

    test('should reject missing authorization', async () => {
      const response = await request(app)
        .get('/api/orders');
      assertErrorResponse(response, 401, 'AUTH_REQUIRED');
    });

    test('should reject malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', 'InvalidFormat token123');
      assertErrorResponse(response, 401, 'AUTH_REQUIRED');
    });

    test('admin should not be able to delete themselves', async () => {
      const response = await request(app)
        .delete(`/api/users/${testUsers.admin.id}`)
        .set('Authorization', createAuthHeader(adminToken));
      assertErrorResponse(response, 400, 'SELF_DELETE_FORBIDDEN');
    });

    test('should validate role hierarchies in user management', async () => {
      // Scheduler shouldn't be able to create admins even if they had access
      const newUser = {
        username: 'fake_admin',
        email: 'fakeadmin@test.com',
        password: 'testpass123',
        role: 'admin' // Trying to create admin
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', createAuthHeader(schedulerToken))
        .send(newUser);
      
      // Should fail due to insufficient permissions, not role validation
      assertErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Permission Edge Cases', () => {
    test('should handle concurrent permission checks', async () => {
      // Simulate multiple requests from different roles simultaneously
      const promises = [
        request(app)
          .get('/api/orders')
          .set('Authorization', createAuthHeader(adminToken)),
        request(app)
          .get('/api/orders')
          .set('Authorization', createAuthHeader(schedulerToken)),
        request(app)
          .get('/api/orders')
          .set('Authorization', createAuthHeader(viewerToken)),
        request(app)
          .post('/api/work-centres')
          .set('Authorization', createAuthHeader(adminToken))
          .send({
            name: 'Concurrent Test',
            code: 'CONC-TEST',
            capacity: 1
          }),
        request(app)
          .post('/api/work-centres')
          .set('Authorization', createAuthHeader(schedulerToken))
          .send({
            name: 'Should Fail',
            code: 'FAIL-TEST',
            capacity: 1
          })
      ];

      const results = await Promise.all(promises);

      // First three should succeed (read access)
      assertApiResponse(results[0], 200);
      assertApiResponse(results[1], 200);
      assertApiResponse(results[2], 200);

      // Admin create should succeed
      assertApiResponse(results[3], 201);

      // Scheduler create should fail
      assertErrorResponse(results[4], 403, 'INSUFFICIENT_PERMISSIONS');
    });

    test('should maintain permissions across token refresh', async () => {
      // Get refresh token for scheduler
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsers.scheduler.username,
          password: 'testpass123'
        });
      
      const { refreshToken } = loginResponse.body;

      // Refresh the token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      const newAccessToken = refreshResponse.body.accessToken;

      // Test that permissions are maintained with new token
      const orderResponse = await request(app)
        .get('/api/orders')
        .set('Authorization', createAuthHeader(newAccessToken));
      assertApiResponse(orderResponse, 200);

      // Test that restrictions are maintained
      const userResponse = await request(app)
        .get('/api/users')
        .set('Authorization', createAuthHeader(newAccessToken));
      assertErrorResponse(userResponse, 403, 'INSUFFICIENT_PERMISSIONS');
    });
  });
});