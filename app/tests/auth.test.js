// tests/auth.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../js/app'); // Your main app file
const User = require('../js/src/models/User');

describe('Authentication System - Black Box Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/blog_test');
  });

  afterAll(async () => {
    // Clean up and close connection
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear users before each test
    await User.deleteMany({});
  });

  describe('POST /api/auth/register - Black Box Testing', () => {
    test('TC1.1.1: Valid registration should return success', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Registration initiated');
      expect(response.body.data.email).toBe(userData.email);
    });

    test('TC1.1.2: Invalid email format should return error', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('valid email');
    });

    test('TC1.1.2: Weak password should return error', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '123' // Too weak
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('password');
    });

    test('TC1.1.2: Duplicate email should return error', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/auth/verify-otp - Black Box Testing', () => {
    let userId;

    beforeEach(async () => {
      // Create unverified user
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);
      
      userId = response.body.data.userId;
    });

    test('TC1.1.3: Valid OTP should verify user', async () => {
      // Get the user to access the OTP (for testing)
      const user = await User.findById(userId);
      const validOTP = user.otp;

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ userId, otp: validOTP })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verified');
      expect(response.body.data.token).toBeDefined();
    });

    test('TC1.1.3: Invalid OTP should return error', async () => {
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ userId, otp: '000000' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid OTP');
    });

    test('TC1.1.3: Expired OTP should return error', async () => {
      // Manually expire the OTP
      await User.findByIdAndUpdate(userId, {
        otpExpiry: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
      });

      const user = await User.findById(userId);
      
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ userId, otp: user.otp })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('expired');
    });
  });

  describe('POST /api/auth/login - Black Box Testing', () => {
    let userData;

    beforeEach(async () => {
      userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!'
      };

      // Register and verify user
      const regResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      const user = await User.findById(regResponse.body.data.userId);
      
      await request(app)
        .post('/api/auth/verify-otp')
        .send({ userId: user._id, otp: user.otp });
    });

    test('TC1.1.4: Valid credentials should return token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(userData.email);
    });

    test('TC1.1.4: Invalid password should return error', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'WrongPassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    test('TC1.1.4: Non-existent user should return error', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: userData.password
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });
  });
});

describe('Authentication System - White Box Tests', () => {
  describe('User Model - Password Hashing', () => {
    test('TC2.1.1: Password should be hashed before save', async () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!'
      });

      await user.save();

      // White box: Check internal implementation
      expect(user.password).not.toBe('Password123!');
      expect(user.password.startsWith('$2b$')).toBe(true); // bcrypt hash format
    });

    test('TC2.1.1: comparePassword method should work correctly', async () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!'
      });

      await user.save();

      // White box: Test internal method
      const isValid = await user.comparePassword('Password123!');
      const isInvalid = await user.comparePassword('WrongPassword');

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });
  });

  describe('OTP Generation Logic', () => {
    test('TC2.1.1: OTP should be 6 digits', async () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!'
      });

      user.generateOTP();

      // White box: Check internal OTP format
      expect(user.otp).toMatch(/^\d{6}$/);
      expect(user.otpExpiry).toBeInstanceOf(Date);
      expect(user.otpExpiry.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
