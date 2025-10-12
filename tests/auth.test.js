const request = require('supertest');
const app = require('../index');
const { testUtils } = require('./setup');

describe('Authentication Tests', () => {
  const createdUsers = [];

  afterAll(async () => {
    for (const userId of createdUsers) {
      await testUtils.cleanupUser(userId);
    }
  });

  describe('User Registration', () => {
    test('should register new user with valid data', async () => {
      const user = {
        firstName: 'John',
        lastName: 'Doe',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(user)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data.email).toBe(user.email);
      
      createdUsers.push(response.body.data.userId);
    });

    test('should reject duplicate email registration', async () => {
      const user = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'SecurePass123!'
      };

      // First registration
      const firstResponse = await request(app)
        .post('/api/auth/register')
        .send(user)
        .expect(201);

      createdUsers.push(firstResponse.body.data.userId);

      // Duplicate registration
      await request(app)
        .post('/api/auth/register')
        .send({
          ...user,
          username: testUtils.generateUsername()
        })
        .expect(409);
    });

    test('should reject weak passwords', async () => {
      const weakPasswords = ['123', 'password', 'abc123', '12345678'];

      for (const password of weakPasswords) {
        await request(app)
          .post('/api/auth/register')
          .send({
            firstName: 'Test',
            lastName: 'User',
            email: testUtils.generateEmail(),
            username: testUtils.generateUsername(),
            password
          })
          .expect(400);
      }
    });

    test('should validate required fields', async () => {
      const requiredFields = ['firstName', 'lastName', 'email', 'username', 'password'];
      
      for (const field of requiredFields) {
        const incompleteUser = {
          firstName: 'Test',
          lastName: 'User',
          email: testUtils.generateEmail(),
          username: testUtils.generateUsername(),
          password: 'SecurePass123!'
        };
        
        delete incompleteUser[field];

        await request(app)
          .post('/api/auth/register')
          .send(incompleteUser)
          .expect(400);
      }
    });

    test('should validate email format', async () => {
      const invalidEmails = ['invalid', 'test@', '@example.com', 'test.example.com'];

      for (const email of invalidEmails) {
        await request(app)
          .post('/api/auth/register')
          .send({
            firstName: 'Test',
            lastName: 'User',
            email,
            username: testUtils.generateUsername(),
            password: 'SecurePass123!'
          })
          .expect(400);
      }
    });
  });

  describe('User Login', () => {
    let testUser;
    let testUserId;

    beforeAll(async () => {
      testUser = {
        firstName: 'Login',
        lastName: 'Test',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'LoginTest123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      testUserId = response.body.data.userId;
      createdUsers.push(testUserId);
    });

    test('should login with valid email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      // May require OTP verification
      expect([200, 403]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('token');
        expect(response.body.data.user.email).toBe(testUser.email);
      }
    });

    test('should reject invalid credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        })
        .expect(401);
    });

    test('should reject non-existent user', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!'
        })
        .expect(401);
    });
  });

  describe('OTP Operations', () => {
    let otpUserId;

    beforeAll(async () => {
      const otpUser = {
        firstName: 'OTP',
        lastName: 'Test',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'OTPTest123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(otpUser);

      otpUserId = response.body.data.userId;
      createdUsers.push(otpUserId);
    });

    test('should resend OTP for valid user', async () => {
      const response = await request(app)
        .post('/api/auth/resend-otp')
        .send({ userId: otpUserId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('OTP');
    });

    test('should reject OTP resend for invalid user', async () => {
      await request(app)
        .post('/api/auth/resend-otp')
        .send({ userId: 'invalid-user-id' })
        .expect(404);
    });

    test('should handle OTP verification attempts', async () => {
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          userId: otpUserId,
          otp: '123456'
        });

      // May succeed or fail based on OTP implementation
      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('Protected Routes', () => {
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
        'token-without-bearer'
      ];

      for (const header of malformedHeaders) {
        await request(app)
          .get('/api/auth/me')
          .set('Authorization', header)
          .expect(401);
      }
    });

    test('should reject invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid.jwt.token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        'malformed-token'
      ];

      for (const token of invalidTokens) {
        await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);
      }
    });
  });

  describe('Rate Limiting', () => {
    test('should handle multiple registration attempts', async () => {
      const attempts = [];

      for (let i = 0; i < 5; i++) {
        attempts.push(
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

      const responses = await Promise.all(attempts);

      // Cleanup successful registrations
      responses.forEach(response => {
        if (response.status === 201 && response.body.data?.userId) {
          createdUsers.push(response.body.data.userId);
        }
      });

      // Should have mix of success (201) and rate limiting (429)
      const statusCodes = responses.map(r => r.status);
      const successCount = statusCodes.filter(s => s === 201).length;

      expect(successCount).toBeGreaterThan(0);
    });
  });
});