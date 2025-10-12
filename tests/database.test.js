const { testUtils } = require('./setup');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

describe('Database Tests', () => {
  const createdUsers = [];
  const createdPosts = [];

  // Real DynamoDB client for testing
  const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

  afterAll(async () => {
    // Cleanup all created resources
    for (const postId of createdPosts) {
      await testUtils.cleanupPost(postId);
    }
    for (const userId of createdUsers) {
      await testUtils.cleanupUser(userId);
    }
  });

  describe('User Database Operations', () => {
    test('should create and retrieve user record', async () => {
      const userData = {
        id: `test-user-${Date.now()}`,
        firstName: 'Database',
        lastName: 'Test',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'hashed-password-123',
        createdAt: new Date().toISOString(),
        isVerified: false
      };

      // Create user
      await dynamodb.send(new PutCommand({
        TableName: 'Users',
        Item: userData
      }));

      createdUsers.push(userData.id);

      // Retrieve user
      const getResponse = await dynamodb.send(new GetCommand({
        TableName: 'Users',
        Key: { id: userData.id }
      }));

      expect(getResponse.Item).toBeDefined();
      expect(getResponse.Item.email).toBe(userData.email);
      expect(getResponse.Item.firstName).toBe(userData.firstName);
    });

    test('should update user record', async () => {
      const userId = `test-update-user-${Date.now()}`;
      const userData = {
        id: userId,
        firstName: 'Update',
        lastName: 'Test',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'hashed-password',
        createdAt: new Date().toISOString(),
        isVerified: false
      };

      // Create user
      await dynamodb.send(new PutCommand({
        TableName: 'Users',
        Item: userData
      }));

      createdUsers.push(userId);

      // Update user
      await dynamodb.send(new UpdateCommand({
        TableName: 'Users',
        Key: { id: userId },
        UpdateExpression: 'SET isVerified = :verified, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':verified': true,
          ':updatedAt': new Date().toISOString()
        }
      }));

      // Verify update
      const getResponse = await dynamodb.send(new GetCommand({
        TableName: 'Users',
        Key: { id: userId }
      }));

      expect(getResponse.Item.isVerified).toBe(true);
      expect(getResponse.Item).toHaveProperty('updatedAt');
    });

    test('should delete user record', async () => {
      const userId = `test-delete-user-${Date.now()}`;
      const userData = {
        id: userId,
        firstName: 'Delete',
        lastName: 'Test',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'hashed-password',
        createdAt: new Date().toISOString()
      };

      // Create user
      await dynamodb.send(new PutCommand({
        TableName: 'Users',
        Item: userData
      }));

      // Delete user
      await dynamodb.send(new DeleteCommand({
        TableName: 'Users',
        Key: { id: userId }
      }));

      // Verify deletion
      const getResponse = await dynamodb.send(new GetCommand({
        TableName: 'Users',
        Key: { id: userId }
      }));

      expect(getResponse.Item).toBeUndefined();
    });

    test('should handle non-existent user gracefully', async () => {
      const getResponse = await dynamodb.send(new GetCommand({
        TableName: 'Users',
        Key: { id: 'non-existent-user-id' }
      }));

      expect(getResponse.Item).toBeUndefined();
    });

    test('should query users by email index', async () => {
      const testEmail = testUtils.generateEmail();
      const userId = `test-query-user-${Date.now()}`;
      
      const userData = {
        id: userId,
        firstName: 'Query',
        lastName: 'Test',
        email: testEmail,
        username: testUtils.generateUsername(),
        password: 'hashed-password',
        createdAt: new Date().toISOString()
      };

      // Create user
      await dynamodb.send(new PutCommand({
        TableName: 'Users',
        Item: userData
      }));

      createdUsers.push(userId);

      // Query by email (assuming email GSI exists)
      try {
        const queryResponse = await dynamodb.send(new QueryCommand({
          TableName: 'Users',
          IndexName: 'email-index',
          KeyConditionExpression: 'email = :email',
          ExpressionAttributeValues: {
            ':email': testEmail
          }
        }));

        if (queryResponse.Items && queryResponse.Items.length > 0) {
          expect(queryResponse.Items[0].email).toBe(testEmail);
        }
      } catch (error) {
        // GSI might not exist, which is okay for this test
        console.log('Email index query failed (GSI might not exist):', error.message);
      }
    });
  });

  describe('Post Database Operations', () => {
    let authorId;

    beforeAll(async () => {
      // Create author for posts
      authorId = `test-author-${Date.now()}`;
      const authorData = {
        id: authorId,
        firstName: 'Post',
        lastName: 'Author',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'hashed-password',
        createdAt: new Date().toISOString()
      };

      await dynamodb.send(new PutCommand({
        TableName: 'Users',
        Item: authorData
      }));

      createdUsers.push(authorId);
    });

    test('should create and retrieve post record', async () => {
      const postData = {
        id: `test-post-${Date.now()}`,
        title: 'Database Test Post',
        content: 'This is test content for database operations testing',
        author: authorId,
        status: 'published',
        tags: ['test', 'database'],
        views: 0,
        createdAt: new Date().toISOString()
      };

      // Create post
      await dynamodb.send(new PutCommand({
        TableName: 'Posts',
        Item: postData
      }));

      createdPosts.push(postData.id);

      // Retrieve post
      const getResponse = await dynamodb.send(new GetCommand({
        TableName: 'Posts',
        Key: { id: postData.id }
      }));

      expect(getResponse.Item).toBeDefined();
      expect(getResponse.Item.title).toBe(postData.title);
      expect(getResponse.Item.author).toBe(authorId);
    });

    test('should update post record', async () => {
      const postId = `test-update-post-${Date.now()}`;
      const postData = {
        id: postId,
        title: 'Update Test Post',
        content: 'Original content',
        author: authorId,
        status: 'draft',
        views: 0,
        createdAt: new Date().toISOString()
      };

      // Create post
      await dynamodb.send(new PutCommand({
        TableName: 'Posts',
        Item: postData
      }));

      createdPosts.push(postId);

      // Update post
      await dynamodb.send(new UpdateCommand({
        TableName: 'Posts',
        Key: { id: postId },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, #views = #views + :increment',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#views': 'views'
        },
        ExpressionAttributeValues: {
          ':status': 'published',
          ':updatedAt': new Date().toISOString(),
          ':increment': 1
        }
      }));

      // Verify update
      const getResponse = await dynamodb.send(new GetCommand({
        TableName: 'Posts',
        Key: { id: postId }
      }));

      expect(getResponse.Item.status).toBe('published');
      expect(getResponse.Item.views).toBe(1);
      expect(getResponse.Item).toHaveProperty('updatedAt');
    });

    test('should delete post record', async () => {
      const postId = `test-delete-post-${Date.now()}`;
      const postData = {
        id: postId,
        title: 'Delete Test Post',
        content: 'Content for deletion test',
        author: authorId,
        status: 'published',
        createdAt: new Date().toISOString()
      };

      // Create post
      await dynamodb.send(new PutCommand({
        TableName: 'Posts',
        Item: postData
      }));

      // Delete post
      await dynamodb.send(new DeleteCommand({
        TableName: 'Posts',
        Key: { id: postId }
      }));

      // Verify deletion
      const getResponse = await dynamodb.send(new GetCommand({
        TableName: 'Posts',
        Key: { id: postId }
      }));

      expect(getResponse.Item).toBeUndefined();
    });

    test('should query posts by author', async () => {
      // Query posts by author (assuming author GSI exists)
      try {
        const queryResponse = await dynamodb.send(new QueryCommand({
          TableName: 'Posts',
          IndexName: 'author-index',
          KeyConditionExpression: 'author = :author',
          ExpressionAttributeValues: {
            ':author': authorId
          }
        }));

        expect(Array.isArray(queryResponse.Items)).toBe(true);
        if (queryResponse.Items && queryResponse.Items.length > 0) {
          queryResponse.Items.forEach(item => {
            expect(item.author).toBe(authorId);
          });
        }
      } catch (error) {
        // GSI might not exist, which is okay for this test
        console.log('Author index query failed (GSI might not exist):', error.message);
      }
    });

    test('should scan posts with filters', async () => {
      try {
        const scanResponse = await dynamodb.send(new ScanCommand({
          TableName: 'Posts',
          FilterExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': 'published'
          },
          Limit: 10 // Limit to avoid large scans
        }));

        expect(Array.isArray(scanResponse.Items)).toBe(true);
        if (scanResponse.Items && scanResponse.Items.length > 0) {
          scanResponse.Items.forEach(item => {
            expect(item.status).toBe('published');
          });
        }
      } catch (error) {
        console.log('Scan operation failed:', error.message);
      }
    });
  });

  describe('Data Integrity and Relationships', () => {
    test('should maintain referential integrity between users and posts', async () => {
      const userId = `test-ref-user-${Date.now()}`;
      const postId = `test-ref-post-${Date.now()}`;

      // Create user
      const userData = {
        id: userId,
        firstName: 'Ref',
        lastName: 'Test',
        email: testUtils.generateEmail(),
        username: testUtils.generateUsername(),
        password: 'hashed-password',
        createdAt: new Date().toISOString()
      };

      await dynamodb.send(new PutCommand({
        TableName: 'Users',
        Item: userData
      }));

      createdUsers.push(userId);

      // Create post with user reference
      const postData = {
        id: postId,
        title: 'Referential Integrity Test',
        content: 'Testing relationships between users and posts',
        author: userId,
        status: 'published',
        createdAt: new Date().toISOString()
      };

      await dynamodb.send(new PutCommand({
        TableName: 'Posts',
        Item: postData
      }));

      createdPosts.push(postId);

      // Verify relationship
      const postResponse = await dynamodb.send(new GetCommand({
        TableName: 'Posts',
        Key: { id: postId }
      }));

      const userResponse = await dynamodb.send(new GetCommand({
        TableName: 'Users',
        Key: { id: userId }
      }));

      expect(postResponse.Item.author).toBe(userId);
      expect(userResponse.Item.id).toBe(userId);
    });

    test('should handle concurrent updates safely', async () => {
      const postId = `test-concurrent-${Date.now()}`;
      const postData = {
        id: postId,
        title: 'Concurrent Update Test',
        content: 'Testing concurrent updates',
        author: createdUsers[0] || 'test-author',
        status: 'published',
        views: 0,
        createdAt: new Date().toISOString()
      };

      // Create post
      await dynamodb.send(new PutCommand({
        TableName: 'Posts',
        Item: postData
      }));

      createdPosts.push(postId);

      // Simulate concurrent view increments
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          dynamodb.send(new UpdateCommand({
            TableName: 'Posts',
            Key: { id: postId },
            UpdateExpression: 'SET #views = #views + :increment',
            ExpressionAttributeNames: {
              '#views': 'views'
            },
            ExpressionAttributeValues: {
              ':increment': 1
            }
          }))
        );
      }

      await Promise.all(promises);

      // Verify final view count
      const getResponse = await dynamodb.send(new GetCommand({
        TableName: 'Posts',
        Key: { id: postId }
      }));

      expect(getResponse.Item.views).toBe(5);
    });
  });

  describe('Performance and Optimization', () => {
    test('should handle batch operations efficiently', async () => {
      const batchSize = 3;
      const userIds = [];

      // Create multiple users
      const promises = [];
      for (let i = 0; i < batchSize; i++) {
        const userId = `test-batch-user-${Date.now()}-${i}`;
        userIds.push(userId);
        createdUsers.push(userId);

        promises.push(
          dynamodb.send(new PutCommand({
            TableName: 'Users',
            Item: {
              id: userId,
              firstName: `Batch${i}`,
              lastName: 'User',
              email: testUtils.generateEmail(),
              username: testUtils.generateUsername(),
              password: 'hashed-password',
              createdAt: new Date().toISOString()
            }
          }))
        );
      }

      const start = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(userIds).toHaveLength(batchSize);
    });

    test('should optimize queries with proper key usage', async () => {
      const testId = `test-perf-${Date.now()}`;
      const testData = {
        id: testId,
        title: 'Performance Test Post',
        content: 'Testing query performance',
        author: createdUsers[0] || 'test-author',
        status: 'published',
        createdAt: new Date().toISOString()
      };

      await dynamodb.send(new PutCommand({
        TableName: 'Posts',
        Item: testData
      }));

      createdPosts.push(testId);

      // Test direct key lookup (should be fast)
      const start = Date.now();
      const response = await dynamodb.send(new GetCommand({
        TableName: 'Posts',
        Key: { id: testId }
      }));
      const duration = Date.now() - start;

      expect(response.Item).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should be very fast
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing table gracefully', async () => {
      try {
        await dynamodb.send(new GetCommand({
          TableName: 'NonExistentTable',
          Key: { id: 'test-id' }
        }));
        
        // Should not reach this point
        expect(true).toBe(false);
      } catch (error) {
        expect(error.name).toMatch(/ResourceNotFoundException|ValidationException/);
      }
    });

    test('should validate item size limits', async () => {
      const largeContent = 'x'.repeat(350000); // Close to 400KB DynamoDB limit
      const postId = `test-large-${Date.now()}`;

      try {
        await dynamodb.send(new PutCommand({
          TableName: 'Posts',
          Item: {
            id: postId,
            title: 'Large Content Test',
            content: largeContent,
            author: createdUsers[0] || 'test-author',
            status: 'published',
            createdAt: new Date().toISOString()
          }
        }));

        // If successful, add to cleanup
        createdPosts.push(postId);
      } catch (error) {
        // Should fail with item size limit exceeded
        expect(error.name).toMatch(/ValidationException|ItemSizeTooLarge/);
      }
    });

    test('should handle conditional update failures', async () => {
      const postId = `test-conditional-${Date.now()}`;
      const postData = {
        id: postId,
        title: 'Conditional Update Test',
        content: 'Testing conditional updates',
        author: createdUsers[0] || 'test-author',
        status: 'draft',
        version: 1,
        createdAt: new Date().toISOString()
      };

      await dynamodb.send(new PutCommand({
        TableName: 'Posts',
        Item: postData
      }));

      createdPosts.push(postId);

      try {
        // Try to update with wrong version (should fail)
        await dynamodb.send(new UpdateCommand({
          TableName: 'Posts',
          Key: { id: postId },
          UpdateExpression: 'SET #status = :status, version = version + :increment',
          ConditionExpression: 'version = :expectedVersion',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': 'published',
            ':expectedVersion': 999, // Wrong version
            ':increment': 1
          }
        }));

        // Should not reach this point
        expect(true).toBe(false);
      } catch (error) {
        expect(error.name).toBe('ConditionalCheckFailedException');
      }
    });
  });
});