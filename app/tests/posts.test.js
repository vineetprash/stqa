// tests/posts.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../js/app');
const User = require('../js/src/models/User');
const Post = require('../js/src/models/Post');

describe('Posts System - Black Box Tests', () => {
  let authToken;
  let userId;
  let otherUserToken;
  let otherUserId;

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/blog_test');
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Post.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear data
    await User.deleteMany({});
    await Post.deleteMany({});

    // Create and verify first user
    const userData1 = {
      username: 'testuser1',
      email: 'test1@example.com',
      password: 'Password123!'
    };

    const regResponse1 = await request(app)
      .post('/api/auth/register')
      .send(userData1);

    const user1 = await User.findById(regResponse1.body.data.userId);
    
    const verifyResponse1 = await request(app)
      .post('/api/auth/verify-otp')
      .send({ userId: user1._id, otp: user1.otp });

    authToken = verifyResponse1.body.data.token;
    userId = user1._id;

    // Create and verify second user
    const userData2 = {
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'Password123!'
    };

    const regResponse2 = await request(app)
      .post('/api/auth/register')
      .send(userData2);

    const user2 = await User.findById(regResponse2.body.data.userId);
    
    const verifyResponse2 = await request(app)
      .post('/api/auth/verify-otp')
      .send({ userId: user2._id, otp: user2.otp });

    otherUserToken = verifyResponse2.body.data.token;
    otherUserId = user2._id;
  });

  describe('POST /api/posts - Black Box Testing', () => {
    test('TC1.2.1: Authenticated user can create post', async () => {
      const postData = {
        title: 'Test Post',
        content: 'This is a test post content.',
        status: 'published'
      };

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post.title).toBe(postData.title);
      expect(response.body.data.post.author._id).toBe(userId.toString());
    });

    test('TC1.2.1: Unauthenticated user cannot create post', async () => {
      const postData = {
        title: 'Test Post',
        content: 'This is a test post content.'
      };

      const response = await request(app)
        .post('/api/posts')
        .send(postData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('TC1.2.1: Invalid post data should return error', async () => {
      const postData = {
        title: '', // Empty title
        content: 'This is a test post content.'
      };

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/posts - Black Box Testing', () => {
    beforeEach(async () => {
      // Create test posts
      await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Public Post 1',
          content: 'Content 1',
          status: 'published'
        });

      await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Draft Post',
          content: 'Draft Content',
          status: 'draft'
        });
    });

    test('TC1.2.1: Public can view published posts', async () => {
      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(1); // Only published posts
      expect(response.body.data.posts[0].title).toBe('Public Post 1');
    });

    test('TC1.2.1: Pagination works correctly', async () => {
      const response = await request(app)
        .get('/api/posts?page=1&limit=1')
        .expect(200);

      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.posts).toHaveLength(1);
    });
  });

  describe('PUT /api/posts/:id - Authorization Testing', () => {
    let postId;

    beforeEach(async () => {
      // Create post by first user
      const createResponse = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Original Title',
          content: 'Original Content',
          status: 'published'
        });

      postId = createResponse.body.data.post._id;
    });

    test('TC1.2.2: Author can edit own post', async () => {
      const updateData = {
        title: 'Updated Title',
        content: 'Updated Content'
      };

      const response = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post.title).toBe(updateData.title);
    });

    test('TC1.2.2: Other user cannot edit post', async () => {
      const updateData = {
        title: 'Malicious Update',
        content: 'Hacked Content'
      };

      const response = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');
    });
  });

  describe('DELETE /api/posts/:id - Authorization Testing', () => {
    let postId;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Post to Delete',
          content: 'Content to Delete',
          status: 'published'
        });

      postId = createResponse.body.data.post._id;
    });

    test('TC1.2.2: Author can delete own post', async () => {
      const response = await request(app)
        .delete(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify post is deleted
      const getResponse = await request(app)
        .get('/api/posts');
      
      expect(getResponse.body.data.posts).toHaveLength(0);
    });

    test('TC1.2.2: Other user cannot delete post', async () => {
      const response = await request(app)
        .delete(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/posts/view/:id - View Tracking Tests', () => {
    let postId;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Post for View Testing',
          content: 'Content for viewing',
          status: 'published'
        });

      postId = createResponse.body.data.post._id;
    });

    test('TC1.2.3: View count increases for different users', async () => {
      // First view by other user
      const response1 = await request(app)
        .post(`/api/posts/view/${postId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(response1.body.data.post.views).toBe(1);
      expect(response1.body.meta.viewCounted).toBe(true);
    });

    test('TC1.2.3: Author viewing own post does not increase count', async () => {
      // Author views own post
      const response = await request(app)
        .post(`/api/posts/view/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.post.views).toBe(0);
      expect(response.body.meta.viewCounted).toBe(false);
    });

    test('TC1.2.3: Rapid views from same user are blocked', async () => {
      // First view
      await request(app)
        .post(`/api/posts/view/${postId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      // Immediate second view
      const response2 = await request(app)
        .post(`/api/posts/view/${postId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(response2.body.meta.viewCounted).toBe(false);
    });
  });
});

describe('Posts System - White Box Tests', () => {
  describe('View Tracking Algorithm', () => {
    const viewTracker = require('../js/src/middleware/viewTracking');

    test('TC2.1.3: IP cooldown logic works correctly', () => {
      const mockReq = {
        params: { identifier: 'test-post-id' },
        ip: '192.168.1.1',
        user: null
      };
      const mockRes = {};
      const mockNext = jest.fn();

      // First call should allow view
      viewTracker.shouldCountView(mockReq, mockRes, mockNext);
      expect(mockReq.shouldCountView).toBe(true);

      // Immediate second call should block view
      viewTracker.shouldCountView(mockReq, mockRes, mockNext);
      expect(mockReq.shouldCountView).toBe(false);
    });

    test('TC2.1.3: Fingerprint generation works', () => {
      const mockReq = {
        ip: '192.168.1.1',
        get: jest.fn((header) => {
          if (header === 'User-Agent') return 'Mozilla/5.0';
          if (header === 'Accept-Language') return 'en-US';
          return '';
        })
      };

      // White box: Test internal fingerprint function
      const createViewFingerprint = require('../js/src/middleware/viewTracking').createViewFingerprint;
      const fingerprint = createViewFingerprint(mockReq);

      expect(fingerprint).toBeDefined();
      expect(typeof fingerprint).toBe('string');
    });
  });

  describe('Post Model Validation', () => {
    test('TC2.1.4: Post validation logic', async () => {
      const validPost = new Post({
        title: 'Valid Title',
        content: 'Valid content',
        author: new mongoose.Types.ObjectId(),
        status: 'published'
      });

      await expect(validPost.validate()).resolves.toBeUndefined();

      const invalidPost = new Post({
        title: '', // Invalid: empty title
        content: 'Valid content',
        author: new mongoose.Types.ObjectId(),
        status: 'published'
      });

      await expect(invalidPost.validate()).rejects.toThrow();
    });
  });
});
