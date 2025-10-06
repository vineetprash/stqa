const jwt = require('jsonwebtoken');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const config = require('../config/config');

// Configure DynamoDB
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'Users';

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    
    // Get user from DynamoDB
    const response = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { id: decoded.userId }
    }));
    
    const user = response.Item;
    
    if (!user || user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive user'
      });
    }

    // Remove password before sending
    delete user.password;
    req.user = {
      ...user,
      _id: user.id
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      
      // Get user from DynamoDB
      const response = await docClient.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { id: decoded.userId }
      }));
      
      const user = response.Item;
      
      if (user && user.isActive !== false) {
        delete user.password;
        req.user = {
          ...user,
          _id: user.id
        };
      }
    } catch (error) {
      // Silently fail for optional auth
    }
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  optionalAuth
};
