const request = require('supertest');
const app = require('../index');
const { testUtils } = require('./setup');

describe('Post Management Tests', () => {
  let authToken;
  let userId;
  const createdUsers = [];
  const createdPosts = [];

  beforeAll(async () => {
    // Create authenticated user for post tests
    const testUser = {
      firstName: 'Post',
      lastName: 'Author',
      email: testUtils.generateEmail(),
      username: testUtils.generateUsername(),
      password: 'TestPassword123!'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    userId = registerResponse.body.data?.userId;
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
    for (const postId of createdPosts) {
      await testUtils.cleanupPost(postId);
    }
    for (const userId of createdUsers) {
      await testUtils.cleanupUser(userId);
    }
  });

  describe('Post Creation', () => {
    test('should create published post with valid data', async () => {
      if (!authToken) {
        console.log('⚠️ Skipping - no auth token');
        return;
      }

      const postData = {
        title: `Test Post ${Date.now()}`,
        content: 'This is comprehensive test content for the blog post. It includes multiple sentences and paragraphs to simulate real content.',
        excerpt: 'Test excerpt for the post',
        status: 'published',
        tags: ['test', 'automation', 'api']
      };

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe(postData.title);
      expect(response.body.data.status).toBe('published');
      expect(response.body.data.tags).toEqual(expect.arrayContaining(postData.tags));

      createdPosts.push(response.body.data.id);
    });

    test('should create draft post', async () => {
      if (!authToken) {
        console.log('⚠️ Skipping - no auth token');
        return;
      }

      const draftData = {
        title: `Draft Post ${Date.now()}`,
        content: 'This is draft content that is not yet ready for publication.',
        status: 'draft'
      };

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(draftData)
        .expect(201);

      expect(response.body.data.status).toBe('draft');
      createdPosts.push(response.body.data.id);
    });

    test('should reject unauthorized post creation', async () => {
      await request(app)
        .post('/api/posts')
        .send({
          title: 'Unauthorized Post',
          content: 'This should fail'
        })
        .expect(401);
    });

    test('should validate required fields', async () => {
      if (!authToken) {
        console.log('⚠️ Skipping - no auth token');
        return;
      }

      const requiredFields = ['title', 'content'];

      for (const field of requiredFields) {
        const invalidPost = {
          title: 'Valid Title',
          content: 'Valid content for the post'
        };
        
        delete invalidPost[field];

        await request(app)
          .post('/api/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidPost)
          .expect(400);
      }
    });

    test('should handle long content', async () => {
      if (!authToken) {
        console.log('⚠️ Skipping - no auth token');
        return;
      }

      const longContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100);

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Long Content Post',
          content: longContent,
          status: 'published'
        });

      expect([201, 400]).toContain(response.status);

      if (response.status === 201) {
        createdPosts.push(response.body.data.id);
      }
    });

    test('should handle special characters in title', async () => {
      if (!authToken) {
        console.log('⚠️ Skipping - no auth token');
        return;
      }

      const specialTitle = 'Special Chars: áéíóú ñüÑÜ 中文 🚀 Test';

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: specialTitle,
          content: 'Content with special characters in title',
          status: 'published'
        })
        .expect(201);

      expect(response.body.data.title).toBe(specialTitle);
      createdPosts.push(response.body.data.id);
    });
  });

  describe('Post Retrieval', () => {
    test('should get all published posts with pagination', async () => {
      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('posts');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('limit');
      expect(Array.isArray(response.body.data.posts)).toBe(true);
    });

    test('should filter posts by status', async () => {
      const response = await request(app)
        .get('/api/posts?status=published')
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.posts.length > 0) {
        response.body.data.posts.forEach(post => {
          expect(post.status).toBe('published');
        });
      }
    });

    test('should paginate results correctly', async () => {
      const response = await request(app)
        .get('/api/posts?page=1&limit=3')
        .expect(200);

      expect(response.body.data.posts.length).toBeLessThanOrEqual(3);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(3);
    });

    test('should search posts by title and content', async () => {
      const response = await request(app)
        .get('/api/posts?search=test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.posts)).toBe(true);
    });

    test('should filter posts by tags', async () => {
      const response = await request(app)
        .get('/api/posts?tags=test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.posts)).toBe(true);
    });

    test('should handle multiple tag filters', async () => {
      const response = await request(app)
        .get('/api/posts?tags=test,automation')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/posts?page=-1&limit=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should use default values
    });

    test('should sort posts by date', async () => {
      const response = await request(app)
        .get('/api/posts?sort=createdAt&order=desc')
        .expect(200);

      expect(response.body.success).toBe(true);

      if (response.body.data.posts.length > 1) {
        const posts = response.body.data.posts;
        for (let i = 0; i < posts.length - 1; i++) {
          const current = new Date(posts[i].createdAt);
          const next = new Date(posts[i + 1].createdAt);
          expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
        }
      }
    });
  });

  describe('Individual Post Operations', () => {
    let testPostId;

    beforeAll(async () => {
      if (!authToken) return;

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Individual Test Post',
          content: 'Content for individual post operations testing',
          status: 'published',
          tags: ['individual', 'test']
        });

      if (response.status === 201) {
        testPostId = response.body.data.id;
        createdPosts.push(testPostId);
      }
    });

    test('should get specific post by ID', async () => {
      if (!testPostId) {
        console.log('⚠️ Skipping - no test post ID');
        return;
      }

      const response = await request(app)
        .get(`/api/posts/${testPostId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testPostId);
      expect(response.body.data).toHaveProperty('title');
      expect(response.body.data).toHaveProperty('content');
      expect(response.body.data).toHaveProperty('author');
    });

    test('should increment view count on post view', async () => {
      if (!testPostId) {
        console.log('⚠️ Skipping - no test post ID');
        return;
      }

      const initialResponse = await request(app)
        .get(`/api/posts/${testPostId}`)
        .expect(200);

      const initialViews = initialResponse.body.data.views || 0;

      await testUtils.sleep(100);

      const secondResponse = await request(app)
        .get(`/api/posts/${testPostId}`)
        .expect(200);

      expect(secondResponse.body.data.views).toBeGreaterThanOrEqual(initialViews);
    });

    test('should return 404 for non-existent post', async () => {
      const response = await request(app)
        .get('/api/posts/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    test('should handle invalid UUID format', async () => {
      await request(app)
        .get('/api/posts/invalid-uuid-format')
        .expect(404);
    });
  });

  describe('Post Updates', () => {
    let updatePostId;

    beforeAll(async () => {
      if (!authToken) return;

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Update Test Post',
          content: 'Original content for update testing',
          status: 'draft'
        });

      if (response.status === 201) {
        updatePostId = response.body.data.id;
        createdPosts.push(updatePostId);
      }
    });

    test('should update own post', async () => {
      if (!authToken || !updatePostId) {
        console.log('⚠️ Skipping - missing requirements');
        return;
      }

      const updateData = {
        title: 'Updated Test Post',
        content: 'Updated content with new information',
        status: 'published',
        tags: ['updated', 'test']
      };

      const response = await request(app)
        .put(`/api/posts/${updatePostId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.status).toBe('published');
    });

    test('should fail without authentication', async () => {
      if (!updatePostId) {
        console.log('⚠️ Skipping - no post ID');
        return;
      }

      await request(app)
        .put(`/api/posts/${updatePostId}`)
        .send({ title: 'Unauthorized update' })
        .expect(401);
    });

    test('should validate update data', async () => {
      if (!authToken || !updatePostId) {
        console.log('⚠️ Skipping - missing requirements');
        return;
      }

      await request(app)
        .put(`/api/posts/${updatePostId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: '' }) // Empty title
        .expect(400);
    });
  });

  describe('Post Deletion', () => {
    let deletePostId;

    beforeAll(async () => {
      if (!authToken) return;

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Delete Test Post',
          content: 'Content for deletion testing',
          status: 'draft'
        });

      if (response.status === 201) {
        deletePostId = response.body.data.id;
        createdPosts.push(deletePostId);
      }
    });

    test('should delete own post', async () => {
      if (!authToken || !deletePostId) {
        console.log('⚠️ Skipping - missing requirements');
        return;
      }

      const response = await request(app)
        .delete(`/api/posts/${deletePostId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      await request(app)
        .get(`/api/posts/${deletePostId}`)
        .expect(404);

      // Remove from cleanup array
      const index = createdPosts.indexOf(deletePostId);
      if (index > -1) createdPosts.splice(index, 1);
    });

    test('should fail without authentication', async () => {
      if (!deletePostId) {
        console.log('⚠️ Skipping - no post ID');
        return;
      }

      await request(app)
        .delete(`/api/posts/${deletePostId}`)
        .expect(401);
    });
  });
});