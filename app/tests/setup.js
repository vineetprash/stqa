// tests/setup.js
const mongoose = require('mongoose');

// Setup for Jest testing environment
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/blog_test';
});

afterAll(async () => {
  // Clean up after all tests
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
});

// Global test helpers
global.createMockUser = () => ({
  _id: 'mock-user-id',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  verified: true
});

global.createMockPost = (authorId = 'mock-user-id') => ({
  _id: 'mock-post-id',
  title: 'Test Post',
  content: 'Test content',
  author: authorId,
  status: 'published',
  views: 0,
  tags: ['test'],
  createdAt: new Date(),
  publishedAt: new Date()
});
