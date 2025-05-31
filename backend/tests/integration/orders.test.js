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
  cleanupTestData,
  delay
} = require('../helpers/testUtils');

describe('Manufacturing Orders Endpoints', () => {
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
    
    const adminTokens = generateTestTokens(testUsers.admin);
    const schedulerTokens = generateTestTokens(testUsers.scheduler);
    const viewerTokens = generateTestTokens(testUsers.viewer);
    
    adminToken = adminTokens.accessToken;
    schedulerToken = schedulerTokens.accessToken;
    viewerToken = viewerTokens.accessToken;

    // Create a test order
    testOrder = createTestOrder(db, testWorkCentres[0].id, testUsers.admin.id);
  });

  afterAll(async () => {
    cleanupTestData(db);
  });

  describe('GET /api/orders', () => {
    test('should return all orders for admin', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', createAuthHeader(adminToken));

      const body = assertApiResponse(response, 200);
      
      expect(body).toHaveProperty('orders');
      expect(body).toHaveProperty('count');
      expect(Array.isArray(body.orders)).toBe(true);
      expect(body.orders.length).toBeGreaterThan(0);
      
      const order = body.orders[0];
      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('orderNumber');
      expect(order).toHaveProperty('stockCode');
      expect(order).toHaveProperty('description');
      expect(order).toHaveProperty('quantityToMake');
      expect(order).toHaveProperty('quantityCompleted');
      expect(order).toHaveProperty('status');
      expect(order).toHaveProperty('priority');
      expect(order).toHaveProperty('manufacturingSteps');
      expect(Array.isArray(order.manufacturingSteps)).toBe(true);
    });

    test('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/orders?status=not_started')
        .set('Authorization', createAuthHeader(adminToken));

      const body = assertApiResponse(response, 200);
      
      expect(body.orders.every(order => order.status === 'not_started')).toBe(true);
    });

    test('should filter orders by priority', async () => {
      const response = await request(app)
        .get('/api/orders?priority=medium')
        .set('Authorization', createAuthHeader(adminToken));

      const body = assertApiResponse(response, 200);
      
      expect(body.orders.every(order => order.priority === 'medium')).toBe(true);
    });

    test('should search orders', async () => {
      const response = await request(app)
        .get('/api/orders?search=TEST')
        .set('Authorization', createAuthHeader(adminToken));

      const body = assertApiResponse(response, 200);
      
      // Should find orders matching search term
      expect(body.orders.length).toBeGreaterThan(0);
    });

    test('should allow scheduler access', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', createAuthHeader(schedulerToken));

      assertApiResponse(response, 200);
    });

    test('should allow viewer access', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', createAuthHeader(viewerToken));

      assertApiResponse(response, 200);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/orders');

      assertErrorResponse(response, 401, 'AUTH_REQUIRED');
    });
  });

  describe('GET /api/orders/:id', () => {
    test('should return specific order', async () => {
      const response = await request(app)
        .get(`/api/orders/${testOrder.id}`)
        .set('Authorization', createAuthHeader(adminToken));

      const body = assertApiResponse(response, 200);
      
      expect(body).toHaveProperty('order');
      expect(body.order.id).toBe(testOrder.id);
      expect(body.order.orderNumber).toBe(testOrder.order_number);
      expect(body.order.stockCode).toBe(testOrder.stock_code);
    });

    test('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .get('/api/orders/99999')
        .set('Authorization', createAuthHeader(adminToken));

      assertErrorResponse(response, 404, 'NOT_FOUND');
    });

    test('should validate ID parameter', async () => {
      const response = await request(app)
        .get('/api/orders/invalid-id')
        .set('Authorization', createAuthHeader(adminToken));

      assertErrorResponse(response, 400, 'INVALID_ID');
    });
  });

  describe('POST /api/orders', () => {
    test('should create order as admin', async () => {
      const newOrder = {
        order_number: `TEST-NEW-${Date.now()}`,
        stock_code: 'NEW-WIDGET',
        description: 'New Test Widget',
        quantity_to_make: 50,
        current_work_centre_id: testWorkCentres[0].id,
        status: 'not_started',
        priority: 'high',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        manufacturing_steps: [
          {
            step_number: 1,
            operation_name: 'Cut Parts',
            work_centre_id: testWorkCentres[0].id,
            planned_duration_minutes: 60
          },
          {
            step_number: 2,
            operation_name: 'Assemble',
            work_centre_id: testWorkCentres[1].id,
            planned_duration_minutes: 120
          }
        ]
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', createAuthHeader(adminToken))
        .send(newOrder);

      const body = assertApiResponse(response, 201);
      
      expect(body).toHaveProperty('message', 'Order created successfully');
      expect(body).toHaveProperty('order');
      expect(body.order.orderNumber).toBe(newOrder.order_number);
      expect(body.order.stockCode).toBe(newOrder.stock_code);
      expect(body.order.manufacturingSteps).toHaveLength(2);
    });

    test('should create order as scheduler', async () => {
      const newOrder = {
        order_number: `TEST-SCHED-${Date.now()}`,
        stock_code: 'SCHED-WIDGET',
        description: 'Scheduler Test Widget',
        quantity_to_make: 25
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', createAuthHeader(schedulerToken))
        .send(newOrder);

      assertApiResponse(response, 201);
    });

    test('should reject duplicate order number', async () => {
      const duplicateOrder = {
        order_number: testOrder.order_number, // Already exists
        stock_code: 'DUP-WIDGET',
        description: 'Duplicate Test',
        quantity_to_make: 10
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', createAuthHeader(adminToken))
        .send(duplicateOrder);

      assertErrorResponse(response, 409, 'DUPLICATE_ORDER_NUMBER');
    });

    test('should reject invalid work centre', async () => {
      const invalidOrder = {
        order_number: `TEST-INVALID-${Date.now()}`,
        stock_code: 'INVALID-WIDGET',
        description: 'Invalid Test',
        quantity_to_make: 10,
        current_work_centre_id: 99999 // Non-existent
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', createAuthHeader(adminToken))
        .send(invalidOrder);

      assertErrorResponse(response, 400, 'INVALID_WORK_CENTRE');
    });

    test('should reject viewer access', async () => {
      const newOrder = {
        order_number: `TEST-VIEWER-${Date.now()}`,
        stock_code: 'VIEWER-WIDGET',
        description: 'Viewer Test',
        quantity_to_make: 5
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', createAuthHeader(viewerToken))
        .send(newOrder);

      assertErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
    });

    test('should validate required fields', async () => {
      const invalidOrder = {
        // Missing required fields
        description: 'Missing Fields Test'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', createAuthHeader(adminToken))
        .send(invalidOrder);

      assertErrorResponse(response, 400, 'VALIDATION_ERROR');
    });
  });

  describe('PUT /api/orders/:id', () => {
    test('should update order as admin', async () => {
      const updates = {
        description: 'Updated Test Widget',
        quantity_to_make: 150,
        priority: 'high'
      };

      const response = await request(app)
        .put(`/api/orders/${testOrder.id}`)
        .set('Authorization', createAuthHeader(adminToken))
        .send(updates);

      const body = assertApiResponse(response, 200);
      
      expect(body).toHaveProperty('message', 'Order updated successfully');
      expect(body.order.description).toBe(updates.description);
      expect(body.order.quantityToMake).toBe(updates.quantity_to_make);
      expect(body.order.priority).toBe(updates.priority);
    });

    test('should update order as scheduler', async () => {
      const updates = {
        priority: 'low'
      };

      const response = await request(app)
        .put(`/api/orders/${testOrder.id}`)
        .set('Authorization', createAuthHeader(schedulerToken))
        .send(updates);

      assertApiResponse(response, 200);
    });

    test('should reject non-existent order', async () => {
      const updates = { description: 'Updated' };

      const response = await request(app)
        .put('/api/orders/99999')
        .set('Authorization', createAuthHeader(adminToken))
        .send(updates);

      assertErrorResponse(response, 404, 'NOT_FOUND');
    });

    test('should reject viewer access', async () => {
      const updates = { description: 'Unauthorized Update' };

      const response = await request(app)
        .put(`/api/orders/${testOrder.id}`)
        .set('Authorization', createAuthHeader(viewerToken))
        .send(updates);

      assertErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('DELETE /api/orders/:id', () => {
    test('should delete order as admin', async () => {
      // Create an order to delete
      const orderToDelete = createTestOrder(db, testWorkCentres[0].id, testUsers.admin.id, {
        order_number: `DELETE-ME-${Date.now()}`
      });

      const response = await request(app)
        .delete(`/api/orders/${orderToDelete.id}`)
        .set('Authorization', createAuthHeader(adminToken));

      const body = assertApiResponse(response, 200);
      expect(body).toHaveProperty('message', 'Order deleted successfully');

      // Verify it's actually deleted
      const deletedOrder = db.prepare('SELECT * FROM manufacturing_orders WHERE id = ?').get(orderToDelete.id);
      expect(deletedOrder).toBeUndefined();
    });

    test('should reject scheduler access', async () => {
      const response = await request(app)
        .delete(`/api/orders/${testOrder.id}`)
        .set('Authorization', createAuthHeader(schedulerToken));

      assertErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
    });

    test('should reject non-existent order', async () => {
      const response = await request(app)
        .delete('/api/orders/99999')
        .set('Authorization', createAuthHeader(adminToken));

      assertErrorResponse(response, 404, 'NOT_FOUND');
    });
  });

  describe('Order Movement and Drag Operations', () => {
    describe('PUT /api/orders/:id/move', () => {
      test('should move order between work centres', async () => {
        const moveData = {
          to_work_centre_id: testWorkCentres[1].id,
          reason: 'test_move'
        };

        const response = await request(app)
          .put(`/api/orders/${testOrder.id}/move`)
          .set('Authorization', createAuthHeader(schedulerToken))
          .send(moveData);

        const body = assertApiResponse(response, 200);
        
        expect(body).toHaveProperty('message', 'Order moved successfully');
        expect(body.order.workCentreId).toBe(testWorkCentres[1].id);

        // Verify audit log entry
        const auditEntry = db.prepare(`
          SELECT * FROM audit_log 
          WHERE event_type = 'order_moved' AND order_id = ?
          ORDER BY timestamp DESC LIMIT 1
        `).get(testOrder.id);
        
        expect(auditEntry).toBeDefined();
        expect(auditEntry.to_work_centre_id).toBe(testWorkCentres[1].id);
      });

      test('should reject invalid destination work centre', async () => {
        const moveData = {
          to_work_centre_id: 99999 // Non-existent
        };

        const response = await request(app)
          .put(`/api/orders/${testOrder.id}/move`)
          .set('Authorization', createAuthHeader(schedulerToken))
          .send(moveData);

        assertErrorResponse(response, 400, 'INVALID_WORK_CENTRE');
      });

      test('should require move permission', async () => {
        const moveData = {
          to_work_centre_id: testWorkCentres[0].id
        };

        const response = await request(app)
          .put(`/api/orders/${testOrder.id}/move`)
          .set('Authorization', createAuthHeader(viewerToken))
          .send(moveData);

        assertErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
      });
    });

    describe('Drag Lock Operations', () => {
      describe('POST /api/orders/:id/start-move', () => {
        test('should create drag lock', async () => {
          const response = await request(app)
            .post(`/api/orders/${testOrder.id}/start-move`)
            .set('Authorization', createAuthHeader(schedulerToken))
            .send({
              orderNumber: testOrder.order_number
            });

          const body = assertApiResponse(response, 200);
          
          expect(body).toHaveProperty('message', 'Order locked for moving');
          expect(body.orderId).toBe(testOrder.id.toString());
          expect(body.lockedBy).toBe(testUsers.scheduler.username);
        });

        test('should reject if order already locked by another user', async () => {
          // First lock by scheduler
          await request(app)
            .post(`/api/orders/${testOrder.id}/start-move`)
            .set('Authorization', createAuthHeader(schedulerToken))
            .send({ orderNumber: testOrder.order_number });

          // Try to lock by admin (should fail)
          const response = await request(app)
            .post(`/api/orders/${testOrder.id}/start-move`)
            .set('Authorization', createAuthHeader(adminToken))
            .send({ orderNumber: testOrder.order_number });

          assertErrorResponse(response, 423, 'ORDER_LOCKED');
        });

        test('should require move permission', async () => {
          const response = await request(app)
            .post(`/api/orders/${testOrder.id}/start-move`)
            .set('Authorization', createAuthHeader(viewerToken))
            .send({ orderNumber: testOrder.order_number });

          assertErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
        });
      });

      describe('POST /api/orders/:id/end-move', () => {
        test('should release drag lock', async () => {
          // First create a lock
          await request(app)
            .post(`/api/orders/${testOrder.id}/start-move`)
            .set('Authorization', createAuthHeader(schedulerToken))
            .send({ orderNumber: testOrder.order_number });

          // Then release it
          const response = await request(app)
            .post(`/api/orders/${testOrder.id}/end-move`)
            .set('Authorization', createAuthHeader(schedulerToken))
            .send({ completed: true });

          const body = assertApiResponse(response, 200);
          expect(body).toHaveProperty('message', 'Order move completed');
        });

        test('should reject if no active lock', async () => {
          const response = await request(app)
            .post(`/api/orders/${testOrder.id}/end-move`)
            .set('Authorization', createAuthHeader(adminToken))
            .send({ completed: false });

          assertErrorResponse(response, 400, 'NO_ACTIVE_LOCK');
        });
      });
    });
  });

  describe('Manufacturing Steps', () => {
    describe('GET /api/orders/:id/steps', () => {
      test('should return order steps', async () => {
        // First create some steps
        db.prepare(`
          INSERT INTO manufacturing_steps (order_id, step_number, operation_name, work_centre_id)
          VALUES (?, ?, ?, ?)
        `).run(testOrder.id, 1, 'Test Cut', testWorkCentres[0].id);

        const response = await request(app)
          .get(`/api/orders/${testOrder.id}/steps`)
          .set('Authorization', createAuthHeader(adminToken));

        const body = assertApiResponse(response, 200);
        
        expect(body).toHaveProperty('steps');
        expect(Array.isArray(body.steps)).toBe(true);
        expect(body.steps.length).toBeGreaterThan(0);
      });
    });

    describe('POST /api/orders/:id/steps/:stepId/start', () => {
      test('should start manufacturing step', async () => {
        // Create a step
        const stepResult = db.prepare(`
          INSERT INTO manufacturing_steps (order_id, step_number, operation_name, work_centre_id, status)
          VALUES (?, ?, ?, ?, ?)
        `).run(testOrder.id, 1, 'Test Operation', testWorkCentres[0].id, 'pending');

        const stepId = stepResult.lastInsertRowid;

        const response = await request(app)
          .post(`/api/orders/${testOrder.id}/steps/${stepId}/start`)
          .set('Authorization', createAuthHeader(schedulerToken));

        const body = assertApiResponse(response, 200);
        expect(body).toHaveProperty('message', 'Step started successfully');
        expect(body.step.status).toBe('in_progress');
        expect(body.step.started_at).toBeDefined();
      });
    });

    describe('POST /api/orders/:id/steps/:stepId/complete', () => {
      test('should complete manufacturing step', async () => {
        // Create a step and start it
        const stepResult = db.prepare(`
          INSERT INTO manufacturing_steps (order_id, step_number, operation_name, work_centre_id, status, started_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(testOrder.id, 1, 'Test Complete', testWorkCentres[0].id, 'in_progress', new Date().toISOString());

        const stepId = stepResult.lastInsertRowid;

        const response = await request(app)
          .post(`/api/orders/${testOrder.id}/steps/${stepId}/complete`)
          .set('Authorization', createAuthHeader(schedulerToken))
          .send({
            quantity_completed: 50
          });

        const body = assertApiResponse(response, 200);
        expect(body).toHaveProperty('message', 'Step completed successfully');
        expect(body.step.status).toBe('complete');
        expect(body.step.quantity_completed).toBe(50);
        expect(body.step.completed_at).toBeDefined();
      });
    });
  });
});