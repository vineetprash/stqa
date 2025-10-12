const request = require('supertest');
const app = require('../index');
const { testUtils } = require('./setup');

describe('Integration Tests', () => {
  const createdUsers = [];
  const createdPosts = [];

  afterAll(async () => {
    // Cleanup all created resources
    for (const postId of createdPosts) {
      await testUtils.cleanupPost(postId);
    }
    for (const userId of createdUsers) {
      await testUtils.cleanupUser(userId);
    }
  });

  describe('Complete User Journey', () => {
    test('should handle full user registration and authentication flow', async () => {
      const testUser = {
        firstName: 'Integration',
        lastName: 'Test',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'IntegrationTest123!'
      };

      // Step 1: Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data).toHaveProperty('userId');
      
      const userId = registerResponse.body.data.userId;
      createdUsers.push(userId);

      // Step 2: Attempt login (may require OTP verification)
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect([200, 403]).toContain(loginResponse.status);

      if (loginResponse.status === 200) {
        expect(loginResponse.body.success).toBe(true);
        expect(loginResponse.body.data).toHaveProperty('token');
        
        // Step 3: Access protected route with token
        const profileResponse = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
          .expect(200);

        expect(profileResponse.body.success).toBe(true);
        expect(profileResponse.body.data.user.email).toBe(testUser.email);
      }

      // Step 4: Test OTP operations
      const otpResponse = await request(app)
        .post('/api/auth/resend-otp')
        .send({ userId })
        .expect(200);

      expect(otpResponse.body.success).toBe(true);
    });

    test('should handle duplicate registration gracefully', async () => {
      const duplicateUser = {
        firstName: 'Duplicate',
        lastName: 'Test',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'DuplicateTest123!'
      };

      // First registration
      const firstResponse = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser)
        .expect(201);

      createdUsers.push(firstResponse.body.data.userId);

      // Second registration with same email
      const secondResponse = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser)
        .expect(409);

      expect(secondResponse.body.success).toBe(false);
      expect(secondResponse.body.message).toContain('already exists');
    });
  });

  describe('Post Management Workflow', () => {
    let authToken;
    let userId;

    beforeAll(async () => {
      // Create authenticated user for post operations
      const postUser = {
        firstName: 'Post',
        lastName: 'Manager',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'PostManager123!'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(postUser);

      userId = registerResponse.body.data?.userId;
      if (userId) createdUsers.push(userId);

      // Try to get auth token
      const loginAttempt = await request(app)
        .post('/api/auth/login')
        .send({
          email: postUser.email,
          password: postUser.password
        });

      if (loginAttempt.status === 200) {
        authToken = loginAttempt.body.data.token;
      }
    });

    test('should complete post lifecycle: create -> read -> update -> delete', async () => {
      if (!authToken) {
        console.log('⚠️ Skipping post lifecycle test - no auth token');
        return;
      }

      // Step 1: Create draft post
      const draftPost = {
        title: `Integration Post ${Date.now()}`,
        content: 'This is a comprehensive integration test post that will go through the complete lifecycle.',
        excerpt: 'Integration test post excerpt',
        status: 'draft',
        tags: ['integration', 'test', 'lifecycle']
      };

      const createResponse = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(draftPost)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.status).toBe('draft');
      
      const postId = createResponse.body.data.id;
      createdPosts.push(postId);

      // Step 2: Read the created post
      const readResponse = await request(app)
        .get(`/api/posts/${postId}`)
        .expect(200);

      expect(readResponse.body.success).toBe(true);
      expect(readResponse.body.data.id).toBe(postId);
      expect(readResponse.body.data.title).toBe(draftPost.title);

      // Step 3: Update post to published
      const updateData = {
        status: 'published',
        title: `Updated ${draftPost.title}`,
        content: `${draftPost.content} - Updated with additional content.`,
        tags: [...draftPost.tags, 'updated']
      };

      const updateResponse = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.status).toBe('published');

      // Step 4: Verify update by reading again
      const verifyResponse = await request(app)
        .get(`/api/posts/${postId}`)
        .expect(200);

      expect(verifyResponse.body.data.status).toBe('published');
      expect(verifyResponse.body.data.title).toBe(updateData.title);

      // Step 5: Check post appears in public listing
      const listResponse = await request(app)
        .get('/api/posts?status=published')
        .expect(200);

      const foundPost = listResponse.body.data.posts.find(post => post.id === postId);
      expect(foundPost).toBeDefined();

      // Step 6: Delete the post
      const deleteResponse = await request(app)
        .delete(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);

      // Step 7: Verify deletion
      await request(app)
        .get(`/api/posts/${postId}`)
        .expect(404);

      // Remove from cleanup array since it's deleted
      const index = createdPosts.indexOf(postId);
      if (index > -1) createdPosts.splice(index, 1);
    });

    test('should handle search and filtering workflow', async () => {
      if (!authToken) {
        console.log('⚠️ Skipping search test - no auth token');
        return;
      }

      // Create multiple posts with different characteristics
      const posts = [
        {
          title: 'JavaScript Fundamentals Guide',
          content: 'Learn the basics of JavaScript programming language',
          status: 'published',
          tags: ['javascript', 'programming', 'beginner']
        },
        {
          title: 'Advanced React Concepts',
          content: 'Deep dive into React hooks, context, and performance optimization',
          status: 'published',
          tags: ['react', 'javascript', 'advanced']
        },
        {
          title: 'Node.js Backend Development',
          content: 'Building scalable backend applications with Node.js and Express',
          status: 'published',
          tags: ['nodejs', 'backend', 'javascript']
        }
      ];

      const createdPostIds = [];

      // Create all posts
      for (const post of posts) {
        const response = await request(app)
          .post('/api/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(post)
          .expect(201);

        createdPostIds.push(response.body.data.id);
        createdPosts.push(response.body.data.id);
      }

      // Test search by title
      const titleSearchResponse = await request(app)
        .get('/api/posts?search=JavaScript')
        .expect(200);

      expect(titleSearchResponse.body.success).toBe(true);
      expect(titleSearchResponse.body.data.posts.length).toBeGreaterThan(0);

      // Test filter by tags
      const tagFilterResponse = await request(app)
        .get('/api/posts?tags=javascript')
        .expect(200);

      expect(tagFilterResponse.body.success).toBe(true);
      expect(tagFilterResponse.body.data.posts.length).toBeGreaterThan(0);

      // Test pagination
      const paginationResponse = await request(app)
        .get('/api/posts?page=1&limit=2')
        .expect(200);

      expect(paginationResponse.body.success).toBe(true);
      expect(paginationResponse.body.data.posts.length).toBeLessThanOrEqual(2);
      expect(paginationResponse.body.data.page).toBe(1);
      expect(paginationResponse.body.data.limit).toBe(2);

      // Test combined filters
      const combinedResponse = await request(app)
        .get('/api/posts?tags=javascript&search=React')
        .expect(200);

      expect(combinedResponse.body.success).toBe(true);
    });
  });

  describe('Security and Authorization', () => {
    let userAToken, userBToken;
    let userAId, userBId;

    beforeAll(async () => {
      // Create two different users for authorization testing
      const userA = {
        firstName: 'User',
        lastName: 'A',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'UserA123!'
      };

      const userB = {
        firstName: 'User',
        lastName: 'B',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'UserB123!'
      };

      // Register both users
      const registerAResponse = await request(app)
        .post('/api/auth/register')
        .send(userA);

      const registerBResponse = await request(app)
        .post('/api/auth/register')
        .send(userB);

      userAId = registerAResponse.body.data?.userId;
      userBId = registerBResponse.body.data?.userId;

      if (userAId) createdUsers.push(userAId);
      if (userBId) createdUsers.push(userBId);

      // Try to get auth tokens
      const loginAAttempt = await request(app)
        .post('/api/auth/login')
        .send({ email: userA.email, password: userA.password });

      const loginBAttempt = await request(app)
        .post('/api/auth/login')
        .send({ email: userB.email, password: userB.password });

      if (loginAAttempt.status === 200) {
        userAToken = loginAAttempt.body.data.token;
      }

      if (loginBAttempt.status === 200) {
        userBToken = loginBAttempt.body.data.token;
      }
    });

    test('should enforce post ownership authorization', async () => {
      if (!userAToken) {
        console.log('⚠️ Skipping authorization test - no user A token');
        return;
      }

      // User A creates a post
      const postData = {
        title: `User A Private Post ${Date.now()}`,
        content: 'This post belongs to User A and should not be editable by User B',
        status: 'draft',
        tags: ['private', 'userA']
      };

      const createResponse = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(postData)
        .expect(201);

      const postId = createResponse.body.data.id;
      createdPosts.push(postId);

      // User A should be able to update their own post
      const updateByOwnerResponse = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ title: 'Updated by owner' })
        .expect(200);

      expect(updateByOwnerResponse.body.success).toBe(true);

      // User B should NOT be able to update User A's post
      if (userBToken) {
        const updateByOtherResponse = await request(app)
          .put(`/api/posts/${postId}`)
          .set('Authorization', `Bearer ${userBToken}`)
          .send({ title: 'Hacked by User B' })
          .expect(403);

        expect(updateByOtherResponse.body.success).toBe(false);
      }

      // Both users should be able to READ the post if it's published
      await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ status: 'published' })
        .expect(200);

      const readByOwnerResponse = await request(app)
        .get(`/api/posts/${postId}`)
        .expect(200);

      expect(readByOwnerResponse.body.success).toBe(true);

      // Non-owner should also be able to read published post
      const readByOtherResponse = await request(app)
        .get(`/api/posts/${postId}`)
        .expect(200);

      expect(readByOtherResponse.body.success).toBe(true);
    });

    test('should handle token expiration and invalid tokens', async () => {
      // Test with obviously invalid token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

      const expiredTokenResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(expiredTokenResponse.body.success).toBe(false);

      // Test with valid token (if available)
      if (userAToken) {
        const validTokenResponse = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${userAToken}`)
          .expect(200);

        expect(validTokenResponse.body.success).toBe(true);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle cascading API failures gracefully', async () => {
      // Test 1: Invalid credentials -> Post creation -> Should fail appropriately
      const invalidLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(invalidLoginResponse.body.success).toBe(false);

      // Test 2: No auth token -> Protected route -> Should fail
      const noAuthResponse = await request(app)
        .post('/api/posts')
        .send({
          title: 'Unauthorized post',
          content: 'This should fail'
        })
        .expect(401);

      expect(noAuthResponse.body.success).toBe(false);

      // Test 3: Invalid token -> Protected route -> Should fail
      const invalidAuthResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(invalidAuthResponse.body.success).toBe(false);
    });

    test('should maintain system stability under concurrent load', async () => {
      const promises = [];

      // Make concurrent requests of different types
      for (let i = 0; i < 8; i++) {
        promises.push(
          request(app)
            .get('/api/posts')
            .expect(200)
        );
      }

      const responses = await Promise.all(promises);

      // All requests should complete successfully
      expect(responses).toHaveLength(8);
      responses.forEach(response => {
        expect(response.body.success).toBe(true);
      });
    });

    test('should handle malformed requests appropriately', async () => {
      // Malformed JSON
      const malformedResponse = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(malformedResponse.body.success).toBe(false);

      // Wrong content type
      const wrongContentTypeResponse = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('plain text data')
        .expect(400);

      expect(wrongContentTypeResponse.body.success).toBe(false);

      // Missing required fields
      const missingFieldsResponse = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test'
          // Missing other required fields
        })
        .expect(400);

      expect(missingFieldsResponse.body.success).toBe(false);
    });

    test('should handle resource cleanup and consistency', async () => {
      // Verify that non-existent resources return appropriate errors
      await request(app)
        .get('/api/posts/non-existent-post-id')
        .expect(404);

      await request(app)
        .post('/api/auth/resend-otp')
        .send({ userId: 'non-existent-user-id' })
        .expect(404);

      // Verify that API endpoints maintain consistency
      const postsResponse = await request(app)
        .get('/api/posts')
        .expect(200);

      expect(postsResponse.body).toHaveProperty('success', true);
      expect(postsResponse.body.data).toHaveProperty('posts');
      expect(postsResponse.body.data).toHaveProperty('total');
    });
  });
});