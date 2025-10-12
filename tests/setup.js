const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config();

// Mock nodemailer to NEVER send real emails
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ 
      messageId: 'test-email-123',
      accepted: ['test@example.com']
    })
  })
}));

// Real DB client for cleanup only
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

// Simple test utilities
const testUtils = {
  generateEmail: () => `test${Date.now()}@example.com`,
  generateUsername: () => `testuser${Date.now()}`,
  
  async cleanupUser(userId) {
    try {
      await dynamodb.send(new DeleteCommand({
        TableName: 'Users',
        Key: { id: userId }
      }));
      return true;
    } catch (error) {
      console.log(`Cleanup user ${userId}:`, error.message);
      return false;
    }
  },

  async cleanupPost(postId) {
    try {
      await dynamodb.send(new DeleteCommand({
        TableName: 'Posts',
        Key: { id: postId }
      }));
      return true;
    } catch (error) {
      console.log(`Cleanup post ${postId}:`, error.message);
      return false;
    }
  },

  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

module.exports = {
  testUtils
};