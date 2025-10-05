require('dotenv').config();

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 3000,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '24h',
  
  // Database configuration
  DB_TYPE: process.env.DB_TYPE || 'mongodb', // 'mongodb' or 'dynamodb'
  
  // MongoDB configuration
  MONGODB_URI: process.env.MONGODB_URI,
  
  // DynamoDB configuration
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_ENDPOINT: process.env.AWS_ENDPOINT, // For local DynamoDB
  DYNAMODB_USERS_TABLE: process.env.DYNAMODB_USERS_TABLE || 'Users',
  DYNAMODB_POSTS_TABLE: process.env.DYNAMODB_POSTS_TABLE || 'Posts',
  
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,
};

// Validate required environment variables
if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

// Database-specific validation
const dbType = config.DB_TYPE.toLowerCase();
if (dbType === 'mongodb' || dbType === 'mongo') {
  if (!config.MONGODB_URI) {
    throw new Error('MONGODB_URI is required when using MongoDB');
  }
} else if (dbType === 'dynamodb' || dbType === 'dynamo') {
  if (!config.AWS_ACCESS_KEY_ID || !config.AWS_SECRET_ACCESS_KEY) {
    console.warn('⚠️ AWS credentials not found. Make sure they are configured via AWS CLI, IAM roles, or environment variables');
  }
}

module.exports = config;