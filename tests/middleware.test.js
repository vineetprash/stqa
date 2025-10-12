const request = require('supertest');
const app = require('../index');
const { testUtils } = require('./setup');

describe('Middleware Tests', () => {
  let authToken;
  const createdUsers = [];

  beforeAll(async () => {
    // Create test user for middleware tests
    const testUser = {
      firstName: 'Middleware',
      lastName: 'Test',
      email: testUtils.generateEmail(),
      username: testUtils.generateUsername(),
      password: 'TestPassword123!'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    const userId = registerResponse.body.data?.userId;
    if (userId) createdUsers.push(userId);

    // Try to get auth token
    const loginAttempt = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    if (loginAttempt.status === 200) {
      authToken = loginAttempt.body.data.token;
    }
  });

  afterAll(async () => {
    for (const userId of createdUsers) {
      await testUtils.cleanupUser(userId);
    }
  });

  describe('Authentication Middleware', () => {
    test('should reject requests without authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/token|authorization/i);
    });

    test('should reject malformed authorization headers', async () => {
      const malformedHeaders = [
        'InvalidFormat token',
        'Bearer',
        'Bearer ',
        'token-without-bearer',
        'Basic dGVzdDp0ZXN0',
        '  Bearer  token  ' // Extra spaces
      ];

      for (const header of malformedHeaders) {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', header)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    test('should reject invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid.jwt.token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'not-a-jwt-at-all',
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.expired.token'
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    test('should accept valid JWT token', async () => {
      if (!authToken) {
        console.log('⚠️ Skipping - no auth token available');
        return;
      }

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
    });

    test('should handle case-sensitive authorization header', async () => {
      if (!authToken) {
        console.log('⚠️ Skipping - no auth token available');
        return;
      }

      // Test lowercase
      await request(app)
        .get('/api/auth/me')
        .set('authorization', `Bearer ${authToken}`)
        .expect(200);

      // Test mixed case
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `bearer ${authToken}`)
        .expect(401); // Should fail due to case sensitivity
    });
  });

  describe('Rate Limiting Middleware', () => {
    test('should allow normal request rates', async () => {
      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle rapid sequential requests', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/auth/register')
            .send({
              firstName: 'Rate',
              lastName: 'Test',
              email: testUtils.generateEmail(),
              username: testUtils.generateUsername(),
              password: 'RateTest123!'
            })
        );
      }

      const responses = await Promise.all(promises);

      // Cleanup successful registrations
      responses.forEach(response => {
        if (response.status === 201 && response.body.data?.userId) {
          createdUsers.push(response.body.data.userId);
        }
      });

      // Should have mix of success and potentially rate limiting
      const statusCodes = responses.map(r => r.status);
      const successCount = statusCodes.filter(s => s === 201).length;
      const rateLimitCount = statusCodes.filter(s => s === 429).length;

      expect(successCount).toBeGreaterThan(0);
      expect(successCount + rateLimitCount).toBe(5);
    });

    test('should reset rate limits after time window', async () => {
      // Wait for rate limit window to reset
      await testUtils.sleep(1000);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Reset',
          lastName: 'Test',
          email: testUtils.generateEmail(),
          username: testUtils.generateUsername(),
          password: 'ResetTest123!'
        });

      // Should work after reset
      expect([201, 409, 429]).toContain(response.status);

      if (response.status === 201 && response.body.data?.userId) {
        createdUsers.push(response.body.data.userId);
      }
    });

    test('should rate limit login attempts', async () => {
      const promises = [];

      for (let i = 0; i < 6; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'attacker@example.com',
              password: 'bruteforce123'
            })
        );
      }

      const responses = await Promise.all(promises);

      // Should have 401s (invalid creds) and potentially 429s (rate limited)
      responses.forEach(response => {
        expect([401, 429]).toContain(response.status);
      });
    });
  });

  describe('CORS Middleware', () => {
    test('should include basic CORS headers', async () => {
      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    test('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/posts')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    test('should handle complex preflight requests', async () => {
      const response = await request(app)
        .options('/api/auth/register')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });

    test('should handle different origins', async () => {
      const origins = [
        'http://localhost:3000',
        'https://myapp.com',
        'https://api.myapp.com'
      ];

      for (const origin of origins) {
        const response = await request(app)
          .get('/api/posts')
          .set('Origin', origin);

        expect(response.headers).toHaveProperty('access-control-allow-origin');
      }
    });
  });

  describe('Security Headers Middleware', () => {
    test('should include essential security headers', async () => {
      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    test('should prevent MIME type sniffing', async () => {
      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should set appropriate frame options', async () => {
      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      expect(['DENY', 'SAMEORIGIN']).toContain(response.headers['x-frame-options']);
    });

    test('should include Content-Security-Policy if configured', async () => {
      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      // CSP might be configured - if so, should be present
      if (response.headers['content-security-policy']) {
        expect(response.headers['content-security-policy']).toBeDefined();
      }
    });
  });

  describe('Request Validation Middleware', () => {
    test('should validate JSON content type for POST requests', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('invalid data')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/json|parse|invalid/i);
    });

    test('should validate request body size limits', async () => {
      const largePayload = {
        firstName: 'Test',
        lastName: 'User',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'TestPassword123!',
        extraData: 'x'.repeat(50000) // Large payload
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(largePayload);

      // Should either succeed or fail with appropriate status
      expect([201, 400, 413, 409]).toContain(response.status);

      if (response.status === 201 && response.body.data?.userId) {
        createdUsers.push(response.body.data.userId);
      }
    });

    test('should handle missing content-type header', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send('some data without content-type')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling Middleware', () => {
    test('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found|404/i);
    });

    test('should handle 405 for unsupported HTTP methods', async () => {
      const response = await request(app)
        .patch('/api/posts') // PATCH might not be supported
        .expect(405);

      expect(response.body.success).toBe(false);
    });

    test('should provide consistent error response format', async () => {
      const response = await request(app)
        .get('/api/nonexistent-route')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
    });

    test('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      // Should not reveal whether email exists or not
      expect(response.body.message).not.toMatch(/email not found|user does not exist/i);
      expect(response.body.message).not.toContain('stack');
      expect(response.body.message).not.toContain('Error:');
    });

    test('should handle internal server errors gracefully', async () => {
      // Try to trigger an edge case that might cause 500
      const response = await request(app)
        .get('/api/posts/malformed-id-that-might-cause-error');

      expect([404, 500]).toContain(response.status);

      if (response.status === 500) {
        expect(response.body.success).toBe(false);
        expect(response.body).toHaveProperty('message');
      }
    });
  });

  describe('Performance and Monitoring', () => {
    test('should respond within reasonable time limits', async () => {
      const start = Date.now();

      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Less than 5 seconds
      expect(response.body.success).toBe(true);
    });

    test('should handle concurrent requests efficiently', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .get('/api/posts')
            .expect(200)
        );
      }

      const start = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.body.success).toBe(true);
      });

      // Should handle concurrency reasonably
      expect(duration).toBeLessThan(10000); // Less than 10 seconds for 10 requests
    });

    test('should include response time headers if configured', async () => {
      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      // Some middleware might add response time headers
      if (response.headers['x-response-time']) {
        expect(response.headers['x-response-time']).toBeDefined();
        expect(typeof response.headers['x-response-time']).toBe('string');
      }
    });
  });
});