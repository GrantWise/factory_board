const request = require('supertest');
const app = require('../src/app');
const { assertErrorResponse } = require('./helpers/testUtils');

describe('Error Handling', () => {
  describe('API Error Responses', () => {
    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({});
      
      assertErrorResponse(response, 400, 'VALIDATION_ERROR');
      expect(response.body.details).toBeDefined();
    });

    it('should handle not found errors', async () => {
      const response = await request(app)
        .get('/api/orders/999999');
      
      assertErrorResponse(response, 404, 'NOT_FOUND');
    });

    it('should handle authentication errors', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', 'Bearer invalid-token');
      
      assertErrorResponse(response, 401, 'INVALID_TOKEN');
    });

    it('should handle permission errors', async () => {
      // First login as a regular user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'regular_user',
          password: 'password123'
        });
      
      const token = loginResponse.body.access_token;

      // Try to access admin endpoint
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${token}`);
      
      assertErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
    });

    it('should handle conflict errors', async () => {
      // First create a work centre
      const workCentre = {
        name: 'Test Work Centre',
        code: 'TEST001'
      };

      await request(app)
        .post('/api/work-centres')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(workCentre);

      // Try to create another with the same code
      const response = await request(app)
        .post('/api/work-centres')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(workCentre);
      
      assertErrorResponse(response, 409, 'DUPLICATE_CODE');
    });

    it('should handle rate limiting', async () => {
      // Make multiple requests in quick succession
      const requests = Array(6).fill().map(() => 
        request(app)
          .get('/api/orders')
          .set('Authorization', `Bearer ${regularToken}`)
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(r => r.status === 429);
      
      assertErrorResponse(rateLimitedResponse, 429, 'RATE_LIMIT_EXCEEDED');
    });

    it('should handle server errors gracefully', async () => {
      // Simulate a server error by passing invalid data to a service
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          order_number: 'TEST001',
          stock_code: 'TEST',
          quantity_to_make: -1 // This should trigger a server error
        });
      
      assertErrorResponse(response, 500, 'INTERNAL_ERROR');
    });
  });

  describe('Error Handler Middleware', () => {
    it('should include request context in development', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .get('/api/non-existent-route');
      
      expect(response.body.context).toBeDefined();
      expect(response.body.context.user_agent).toBeDefined();
    });

    it('should not include request context in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .get('/api/non-existent-route');
      
      expect(response.body.context).toBeUndefined();
    });
  });
}); 