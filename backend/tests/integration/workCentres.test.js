const request = require('supertest');
const { app } = require('../../src/testApp');
const { 
  setupTestDatabase,
  createTestUsers,
  createTestWorkCentres,
  generateTestTokens,
  createAuthHeader,
  assertApiResponse,
  assertErrorResponse,
  cleanupTestData
} = require('../helpers/testUtils');

describe('Work Centres Endpoints', () => {
  let db;
  let testUsers;
  let testWorkCentres;
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
  });

  afterAll(async () => {
    cleanupTestData(db);
  });

  describe('GET /api/work-centres', () => {
    test('should return all work centres for admin', async () => {
      const response = await request(app)
        .get('/api/work-centres')
        .set('Authorization', createAuthHeader(adminToken));

      const body = assertApiResponse(response, 200);
      
      expect(body).toHaveProperty('work_centres');
      expect(Array.isArray(body.work_centres)).toBe(true);
      expect(body.work_centres.length).toBe(3);
      
      const workCentre = body.work_centres[0];
      expect(workCentre).toHaveProperty('id');
      expect(workCentre).toHaveProperty('name');
      expect(workCentre).toHaveProperty('code');
      expect(workCentre).toHaveProperty('capacity');
      expect(workCentre).toHaveProperty('current_jobs');
      expect(workCentre).toHaveProperty('machines');
      expect(Array.isArray(workCentre.machines)).toBe(true);
    });

    test('should return work centres for scheduler', async () => {
      const response = await request(app)
        .get('/api/work-centres')
        .set('Authorization', createAuthHeader(schedulerToken));

      assertApiResponse(response, 200);
    });

    test('should return work centres for viewer', async () => {
      const response = await request(app)
        .get('/api/work-centres')
        .set('Authorization', createAuthHeader(viewerToken));

      assertApiResponse(response, 200);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/work-centres');

      assertErrorResponse(response, 401, 'AUTH_REQUIRED');
    });

    test('should filter inactive work centres by default', async () => {
      // Create an inactive work centre
      db.prepare(`
        INSERT INTO work_centres (name, code, capacity, display_order, is_active)
        VALUES (?, ?, ?, ?, ?)
      `).run('Inactive Centre', 'INACTIVE-01', 1, 99, 0);

      const response = await request(app)
        .get('/api/work-centres')
        .set('Authorization', createAuthHeader(adminToken));

      const body = assertApiResponse(response, 200);
      
      // Should not include inactive work centre
      expect(body.work_centres.length).toBe(3);
      expect(body.work_centres.every(wc => wc.is_active === 1)).toBe(true);
    });

    test('should include inactive work centres when requested', async () => {
      const response = await request(app)
        .get('/api/work-centres?include_inactive=true')
        .set('Authorization', createAuthHeader(adminToken));

      const body = assertApiResponse(response, 200);
      
      // Should include inactive work centre
      expect(body.work_centres.length).toBeGreaterThan(3);
    });
  });

  describe('GET /api/work-centres/:id', () => {
    test('should return specific work centre', async () => {
      const workCentreId = testWorkCentres[0].id;
      
      const response = await request(app)
        .get(`/api/work-centres/${workCentreId}`)
        .set('Authorization', createAuthHeader(adminToken));

      const body = assertApiResponse(response, 200);
      
      expect(body).toHaveProperty('work_centre');
      expect(body.work_centre.id).toBe(workCentreId);
      expect(body.work_centre.name).toBe(testWorkCentres[0].name);
      expect(body.work_centre).toHaveProperty('machines');
    });

    test('should return 404 for non-existent work centre', async () => {
      const response = await request(app)
        .get('/api/work-centres/99999')
        .set('Authorization', createAuthHeader(adminToken));

      assertErrorResponse(response, 404, 'NOT_FOUND');
    });

    test('should validate ID parameter', async () => {
      const response = await request(app)
        .get('/api/work-centres/invalid-id')
        .set('Authorization', createAuthHeader(adminToken));

      assertErrorResponse(response, 400, 'INVALID_ID');
    });
  });

  describe('POST /api/work-centres', () => {
    test('should create work centre as admin', async () => {
      const timestamp = Date.now().toString().slice(-6);
      const newWorkCentre = {
        name: 'New Test Centre',
        code: `NEW${timestamp}`,
        description: 'A test work centre',
        capacity: 5,
        display_order: 10
      };

      const response = await request(app)
        .post('/api/work-centres')
        .set('Authorization', createAuthHeader(adminToken))
        .send(newWorkCentre);

      const body = assertApiResponse(response, 201);
      
      expect(body).toHaveProperty('message', 'Work centre created successfully');
      expect(body).toHaveProperty('workCentre');
      expect(body.workCentre.name).toBe(newWorkCentre.name);
      expect(body.workCentre.code).toBe(newWorkCentre.code);
      expect(body.workCentre.capacity).toBe(newWorkCentre.capacity);
    });

    test('should reject duplicate code', async () => {
      const duplicateWorkCentre = {
        name: 'Another Centre',
        code: 'TEST-CUT', // Already exists
        capacity: 3
      };

      const response = await request(app)
        .post('/api/work-centres')
        .set('Authorization', createAuthHeader(adminToken))
        .send(duplicateWorkCentre);

      assertErrorResponse(response, 409, 'DUPLICATE_CODE');
    });

    test('should reject scheduler access', async () => {
      const newWorkCentre = {
        name: 'Unauthorized Centre',
        code: 'UNAUTH',
        capacity: 1
      };

      const response = await request(app)
        .post('/api/work-centres')
        .set('Authorization', createAuthHeader(schedulerToken))
        .send(newWorkCentre);

      assertErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
    });

    test('should reject viewer access', async () => {
      const newWorkCentre = {
        name: 'Unauthorized Centre',
        code: 'UNAUTH',
        capacity: 1
      };

      const response = await request(app)
        .post('/api/work-centres')
        .set('Authorization', createAuthHeader(viewerToken))
        .send(newWorkCentre);

      assertErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
    });

    test('should validate required fields', async () => {
      const invalidWorkCentre = {
        name: 'Missing Code Centre'
        // Missing required 'code' field
      };

      const response = await request(app)
        .post('/api/work-centres')
        .set('Authorization', createAuthHeader(adminToken))
        .send(invalidWorkCentre);

      assertErrorResponse(response, 400, 'VALIDATION_ERROR');
    });
  });

  describe('PUT /api/work-centres/:id', () => {
    test('should update work centre as admin', async () => {
      const workCentreId = testWorkCentres[0].id;
      const updates = {
        name: 'Updated Test Centre',
        capacity: 10,
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/work-centres/${workCentreId}`)
        .set('Authorization', createAuthHeader(adminToken))
        .send(updates);

      const body = assertApiResponse(response, 200);
      
      expect(body).toHaveProperty('message', 'Work centre updated successfully');
      expect(body.workCentre.name).toBe(updates.name);
      expect(body.workCentre.capacity).toBe(updates.capacity);
      expect(body.workCentre.description).toBe(updates.description);
    });

    test('should reject non-existent work centre', async () => {
      const updates = { name: 'Updated Name' };

      const response = await request(app)
        .put('/api/work-centres/99999')
        .set('Authorization', createAuthHeader(adminToken))
        .send(updates);

      assertErrorResponse(response, 404, 'NOT_FOUND');
    });

    test('should reject code conflicts', async () => {
      const workCentreId = testWorkCentres[1].id;
      const updates = {
        code: testWorkCentres[0].code // Duplicate code
      };

      const response = await request(app)
        .put(`/api/work-centres/${workCentreId}`)
        .set('Authorization', createAuthHeader(adminToken))
        .send(updates);

      assertErrorResponse(response, 409, 'DUPLICATE_CODE');
    });

    test('should reject scheduler access', async () => {
      const workCentreId = testWorkCentres[0].id;
      const updates = { name: 'Unauthorized Update' };

      const response = await request(app)
        .put(`/api/work-centres/${workCentreId}`)
        .set('Authorization', createAuthHeader(schedulerToken))
        .send(updates);

      assertErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('DELETE /api/work-centres/:id', () => {
    test('should delete work centre as admin', async () => {
      // Create a work centre to delete
      const result = db.prepare(`
        INSERT INTO work_centres (name, code, capacity, display_order, is_active)
        VALUES (?, ?, ?, ?, ?)
      `).run('To Delete', 'DELETE-ME', 1, 99, 1);

      const workCentreId = result.lastInsertRowid;

      const response = await request(app)
        .delete(`/api/work-centres/${workCentreId}`)
        .set('Authorization', createAuthHeader(adminToken));

      const body = assertApiResponse(response, 200);
      expect(body).toHaveProperty('message', 'Work centre deleted successfully');

      // Verify it's marked as inactive
      const deletedWorkCentre = db.prepare('SELECT is_active FROM work_centres WHERE id = ?').get(workCentreId);
      expect(deletedWorkCentre.is_active).toBe(0);
    });

    test('should reject non-existent work centre', async () => {
      const response = await request(app)
        .delete('/api/work-centres/99999')
        .set('Authorization', createAuthHeader(adminToken));

      assertErrorResponse(response, 404, 'NOT_FOUND');
    });

    test('should reject scheduler access', async () => {
      const workCentreId = testWorkCentres[0].id;

      const response = await request(app)
        .delete(`/api/work-centres/${workCentreId}`)
        .set('Authorization', createAuthHeader(schedulerToken));

      assertErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('PUT /api/work-centres/reorder', () => {
    test('should reorder work centres as admin', async () => {
      const reorderData = [
        { id: testWorkCentres[0].id, display_order: 3 },
        { id: testWorkCentres[1].id, display_order: 1 },
        { id: testWorkCentres[2].id, display_order: 2 }
      ];

      const response = await request(app)
        .put('/api/work-centres/reorder')
        .set('Authorization', createAuthHeader(adminToken))
        .send(reorderData);

      const body = assertApiResponse(response, 200);
      expect(body).toHaveProperty('message', 'Work centres reordered successfully');

      // Verify the new order
      const reorderedWorkCentres = db.prepare(`
        SELECT id, display_order FROM work_centres 
        WHERE id IN (?, ?, ?) 
        ORDER BY display_order
      `).all(testWorkCentres[0].id, testWorkCentres[1].id, testWorkCentres[2].id);

      expect(reorderedWorkCentres[0].id).toBe(testWorkCentres[1].id); // Should be first
      expect(reorderedWorkCentres[1].id).toBe(testWorkCentres[2].id); // Should be second
      expect(reorderedWorkCentres[2].id).toBe(testWorkCentres[0].id); // Should be third
    });

    test('should validate reorder data', async () => {
      const invalidData = [
        { id: testWorkCentres[0].id } // Missing display_order
      ];

      const response = await request(app)
        .put('/api/work-centres/reorder')
        .set('Authorization', createAuthHeader(adminToken))
        .send(invalidData);

      assertErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    test('should reject empty array', async () => {
      const response = await request(app)
        .put('/api/work-centres/reorder')
        .set('Authorization', createAuthHeader(adminToken))
        .send([]);

      assertErrorResponse(response, 400, 'VALIDATION_ERROR');
    });
  });

  describe('Machine Management', () => {
    describe('POST /api/work-centres/:id/machines', () => {
      test('should add machine to work centre as admin', async () => {
        const workCentreId = testWorkCentres[0].id;
        const newMachine = {
          name: 'Test Machine',
          code: 'TEST-MACH-01',
          description: 'A test machine'
        };

        const response = await request(app)
          .post(`/api/work-centres/${workCentreId}/machines`)
          .set('Authorization', createAuthHeader(adminToken))
          .send(newMachine);

        const body = assertApiResponse(response, 201);
        
        expect(body).toHaveProperty('message', 'Machine added successfully');
        expect(body).toHaveProperty('machine');
        expect(body.machine.name).toBe(newMachine.name);
        expect(body.machine.code).toBe(newMachine.code);
        expect(body.machine.work_centre_id).toBe(workCentreId);
      });

      test('should reject non-existent work centre', async () => {
        const newMachine = {
          name: 'Test Machine',
          code: 'TEST-MACH-02'
        };

        const response = await request(app)
          .post('/api/work-centres/99999/machines')
          .set('Authorization', createAuthHeader(adminToken))
          .send(newMachine);

        assertErrorResponse(response, 404, 'NOT_FOUND');
      });
    });

    describe('PUT /api/work-centres/:id/machines/:machineId', () => {
      test('should update machine as admin', async () => {
        const workCentreId = testWorkCentres[0].id;
        
        // First create a machine
        const machineResult = db.prepare(`
          INSERT INTO machines (name, code, work_centre_id, is_active)
          VALUES (?, ?, ?, ?)
        `).run('Original Machine', 'ORIG-MACH', workCentreId, 1);
        
        const machineId = machineResult.lastInsertRowid;
        
        const updates = {
          name: 'Updated Machine',
          description: 'Updated description'
        };

        const response = await request(app)
          .put(`/api/work-centres/${workCentreId}/machines/${machineId}`)
          .set('Authorization', createAuthHeader(adminToken))
          .send(updates);

        const body = assertApiResponse(response, 200);
        
        expect(body).toHaveProperty('message', 'Machine updated successfully');
        expect(body.machine.name).toBe(updates.name);
        expect(body.machine.description).toBe(updates.description);
      });
    });

    describe('DELETE /api/work-centres/:id/machines/:machineId', () => {
      test('should delete machine as admin', async () => {
        const workCentreId = testWorkCentres[0].id;
        
        // First create a machine
        const machineResult = db.prepare(`
          INSERT INTO machines (name, code, work_centre_id, is_active)
          VALUES (?, ?, ?, ?)
        `).run('To Delete Machine', 'DELETE-MACH', workCentreId, 1);
        
        const machineId = machineResult.lastInsertRowid;

        const response = await request(app)
          .delete(`/api/work-centres/${workCentreId}/machines/${machineId}`)
          .set('Authorization', createAuthHeader(adminToken));

        const body = assertApiResponse(response, 200);
        expect(body).toHaveProperty('message', 'Machine deleted successfully');

        // Verify it's marked as inactive
        const deletedMachine = db.prepare('SELECT is_active FROM machines WHERE id = ?').get(machineId);
        expect(deletedMachine.is_active).toBe(0);
      });
    });
  });
});