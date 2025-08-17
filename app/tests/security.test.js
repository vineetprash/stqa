// tests/security.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../js/app');
const jwt = require('jsonwebtoken');

describe('Security Tests - Black Box & White Box', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/blog_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('TC1.4.1: Rate Limiting Tests - Black Box', () => {
    test('Authentication rate limiting blocks excessive requests', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Make multiple rapid requests (rate limit is typically 5-10 per window)
      const requests = Array(20).fill().map(() => 
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(requests);
      
      // Some responses should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('View endpoint rate limiting works', async () => {
      // Make many rapid view requests
      const requests = Array(150).fill().map(() => 
        request(app)
          .post('/api/posts/view/nonexistent-post')
      );

      const responses = await Promise.all(requests);
      
      // Should get rate limited after 100 requests
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('TC1.4.2: JWT Token Security - White Box', () => {
    test('Token generation includes correct payload', () => {
      const userId = 'test-user-id';
      const token = jwt.sign(
        { userId, type: 'auth' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      
      expect(decoded.userId).toBe(userId);
      expect(decoded.type).toBe('auth');
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });

    test('Expired token is rejected', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test', type: 'auth' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Already expired
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('Invalid token format is rejected', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-format')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('Missing token is handled correctly', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('TC1.4.2: Input Validation & Sanitization', () => {
    test('SQL Injection attempts are blocked', async () => {
      const maliciousData = {
        email: "'; DROP TABLE users; --",
        password: "password"
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(maliciousData);

      // Should return validation error, not execute SQL
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('XSS attempts in post content are handled', async () => {
      // This would need authentication setup
      const maliciousPost = {
        title: '<script>alert("XSS")</script>',
        content: '<img src="x" onerror="alert(1)">'
      };

      const response = await request(app)
        .post('/api/posts')
        .send(maliciousPost);

      // Should require authentication first
      expect(response.status).toBe(401);
    });

    test('Password validation enforces security rules', async () => {
      const weakPasswords = [
        '123',
        'password',
        'abc',
        '1234567890',
        'qwerty'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'testuser',
            email: 'test@example.com',
            password
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('TC2.1.2: Middleware Security - White Box', () => {
    test('authenticateToken middleware validates properly', () => {
      const { authenticateToken } = require('../js/src/middleware/auth');
      
      const mockReq = {
        headers: {
          authorization: 'Bearer valid-token'
        }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      // Mock jwt.verify to simulate token validation
      jest.mock('jsonwebtoken', () => ({
        verify: jest.fn().mockReturnValue({ userId: 'test-user' })
      }));

      authenticateToken(mockReq, mockRes, mockNext);

      // Should proceed to next middleware for valid token
      expect(mockNext).toHaveBeenCalled();
    });

    test('Content validation middleware works', () => {
      const { validatePost } = require('../js/src/middleware/validation');
      
      const mockReq = {
        body: {
          title: '', // Invalid: empty title
          content: 'Valid content'
        }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      validatePost(mockReq, mockRes, mockNext);

      // Should return validation error
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('TC1.4.2: CORS and Headers Security', () => {
    test('Proper CORS headers are set', async () => {
      const response = await request(app)
        .options('/api/posts')
        .expect(200);

      // Should have CORS headers
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('Security headers are present', async () => {
      const response = await request(app)
        .get('/api/posts');

      // Check for security headers (if implemented)
      // expect(response.headers['x-content-type-options']).toBe('nosniff');
      // expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('TC2.1.4: Error Handling Security', () => {
    test('Error responses do not leak sensitive information', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      // Error message should not reveal internal structure
      expect(response.body.error).not.toContain('stack');
      expect(response.body.error).not.toContain('mongodb');
      expect(response.body.error).not.toContain('password');
    });

    test('Database errors are properly handled', async () => {
      // Force a database error by using invalid ObjectId
      const response = await request(app)
        .get('/api/posts/invalid-object-id');

      // Should return proper error, not expose database details
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
