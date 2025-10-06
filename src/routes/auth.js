const express = require('express');
const jwt = require('jsonwebtoken');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');
const { authenticateToken } = require('../middleware/auth');
const { authRateLimit } = require('../middleware/ratelimit');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const emailService = require('../services/emailService');

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

const router = express.Router();

// Helper functions for DynamoDB operations
async function findUserByEmail(email) {
  const response = await docClient.send(new ScanCommand({
    TableName: USERS_TABLE,
    FilterExpression: '#email = :email',
    ExpressionAttributeNames: { '#email': 'email' },
    ExpressionAttributeValues: { ':email': email }
  }));
  return response.Items?.[0] || null;
}

async function findUserByUsername(username) {
  const response = await docClient.send(new ScanCommand({
    TableName: USERS_TABLE,
    FilterExpression: '#username = :username',
    ExpressionAttributeNames: { '#username': 'username' },
    ExpressionAttributeValues: { ':username': username }
  }));
  return response.Items?.[0] || null;
}

async function findUserByEmailOrUsername(email, username) {
  const response = await docClient.send(new ScanCommand({
    TableName: USERS_TABLE,
    FilterExpression: '#email = :email OR #username = :username',
    ExpressionAttributeNames: { 
      '#email': 'email',
      '#username': 'username'
    },
    ExpressionAttributeValues: { 
      ':email': email,
      ':username': username
    }
  }));
  return response.Items?.[0] || null;
}

async function findUserById(id) {
  const response = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { id }
  }));
  return response.Item || null;
}

async function findActiveUserByEmail(email) {
  const response = await docClient.send(new ScanCommand({
    TableName: USERS_TABLE,
    FilterExpression: '#email = :email AND #isActive = :isActive',
    ExpressionAttributeNames: { 
      '#email': 'email',
      '#isActive': 'isActive'
    },
    ExpressionAttributeValues: { 
      ':email': email,
      ':isActive': true
    }
  }));
  return response.Items?.[0] || null;
}

async function createUser(userData) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const hashedPassword = await bcrypt.hash(userData.password, 12);
  
  const user = {
    id,
    ...userData,
    password: hashedPassword,
    role: 'user',
    isActive: true,
    verified: false,
    createdAt: now,
    updatedAt: now
  };
  
  await docClient.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: user
  }));
  
  return { ...user, _id: id };
}

async function updateUser(id, updates) {
  const expressions = [];
  const values = {};
  const names = {};
  
  Object.entries(updates).forEach(([key, value]) => {
    if (key.includes('.')) {
      const [parent, child] = key.split('.');
      expressions.push(`#${parent}.#${child} = :${key.replace('.', '_')}`);
      names[`#${parent}`] = parent;
      names[`#${child}`] = child;
      values[`:${key.replace('.', '_')}`] = value;
    } else {
      expressions.push(`#${key} = :${key}`);
      values[`:${key}`] = value;
      names[`#${key}`] = key;
    }
  });
  
  values[':updatedAt'] = new Date().toISOString();
  expressions.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  
  const response = await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { id },
    UpdateExpression: `SET ${expressions.join(', ')}`,
    ExpressionAttributeValues: values,
    ExpressionAttributeNames: names,
    ReturnValues: 'ALL_NEW'
  }));
  
  return { ...response.Attributes, _id: response.Attributes.id };
}

// Generate JWT token 
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRATION }
  );
};

// Step 1: Initial registration - send OTP
router.post('/register', authRateLimit, async (req, res) => {
  try {
    console.log('🔵 Registration attempt started:', { email: req.body.email, username: req.body.username });
    const { username, email, password, firstName, lastName } = req.body;

    // Basic validation
    if (!email || !password || !username || !firstName || !lastName) {
      console.log('❌ Registration failed: Missing required fields', { email, username, firstName, lastName });
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (password.length < 6) {
      console.log('❌ Registration failed: Password too short', { email, username });
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    console.log('🔍 Checking for existing user:', { email, username });
    
    const existingUser = await findUserByEmailOrUsername(email, username);

    let partiallyRegisteredUser;
    if (existingUser && existingUser.verified) {
      partiallyRegisteredUser = null;
    } else {
      partiallyRegisteredUser = existingUser;
    }

    // exists and verified
    if (existingUser && existingUser.verified) {
      console.log('❌ Registration failed: User already exists and verified', existingUser);
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email or username'
      });
    }
    let user;
    // exists and not verified
    if (partiallyRegisteredUser) {
      console.log('ℹ️ Partially registered user found, updating record:', { email, username });
      
      // Update the existing user
      const updateData = {
        username,
        password: await bcrypt.hash(password, 12),
        'profile.firstName': firstName,
        'profile.lastName': lastName
      };
      
      user = await updateUser(partiallyRegisteredUser.id, updateData);
    }
    // doesnt exist - create new user
    else {
      console.log('📝 Creating new user:', { email, username, firstName, lastName });
      user = await createUser({
        username,
        email,
        password,
        verified: false, // Will be verified after OTP confirmation
        profile: { firstName, lastName }
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes as ISO string
    console.log('🔐 OTP generated for user:', { userId: user.id, email, otp });
    
    // Save user with OTP
    await updateUser(user.id, { otp: user.otp, otpExpiry: user.otpExpiry });
    console.log('💾 User saved to database:', { userId: user.id, email });

    // Send OTP email
    console.log('📧 Sending OTP email to:', email);
    const emailResult = await emailService.sendOTPEmail(email, otp, firstName);
    
    if (!emailResult.success) {
      console.error('❌ Failed to send OTP email:', emailResult.error);
      // Don't fail registration if email fails
    } else {
      console.log('✅ OTP email sent successfully to:', email);
    }

    console.log('✅ Registration initiated successfully:', { userId: user.id, email });
    res.status(201).json({
      success: true,
      message: 'Registration initiated. Please check your email for the OTP.',
      data: {
        userId: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('💥 Registration error:', {
      error: error.message,
      stack: error.stack,
      email: req.body.email,
      username: req.body.username
    });
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: config.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Step 2: Verify OTP and complete registration
router.post('/verify-otp', authRateLimit, async (req, res) => {
  try {
    console.log('🔵 OTP verification started:', { userId: req.body.userId });
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      console.log('❌ OTP verification failed: Missing required fields', { userId: !!userId, otp: !!otp });
      return res.status(400).json({
        success: false,
        message: 'User ID and OTP are required'
      });
    }

    console.log('🔍 Finding user for OTP verification:', { userId });
    // Find user with OTP fields
    const user = await findUserById(userId);

    if (!user) {
      console.log('❌ OTP verification failed: User not found', { userId });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.verified) {
      console.log('❌ OTP verification failed: User already verified', { userId, email: user.email });
      return res.status(400).json({
        success: false,
        message: 'User already verified'
      });
    }

    console.log('🔐 Verifying OTP for user:', { userId, email: user.email });
    // Verify OTP
    if (!user.otp || !user.otpExpiry || new Date() > new Date(user.otpExpiry) || user.otp !== otp) {
      console.log('❌ OTP verification failed: Invalid or expired OTP', { userId, email: user.email });
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    console.log('✅ OTP verified successfully, marking user as verified:', { userId, email: user.email });
    // Mark user as verified and clear OTP
    await updateUser(userId, { 
      verified: true,
      otp: null,
      otpExpiry: null
    });

    console.log('📧 Sending welcome email to:', user.email);
    // Send welcome email
    await emailService.sendWelcomeEmail(user.email, user.profile.firstName);

    // Generate token
    const token = generateToken(user.id);
    console.log('🎫 Token generated for verified user:', { userId, email: user.email });

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          verified: user.verified
        },
        token
      }
    });
  } catch (error) {
    console.error('💥 OTP verification error:', {
      error: error.message,
      stack: error.stack,
      userId: req.body.userId
    });
    res.status(500).json({
      success: false,
      message: 'OTP verification failed',
      error: config.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Resend OTP
router.post('/resend-otp', authRateLimit, async (req, res) => {
  try {
    console.log('🔵 OTP resend requested:', { userId: req.body.userId });
    const { userId } = req.body;

    if (!userId) {
      console.log('❌ OTP resend failed: Missing userId');
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    console.log('🔍 Finding user for OTP resend:', { userId });
    const user = await findUserById(userId);

    if (!user) {
      console.log('❌ OTP resend failed: User not found', { userId });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.verified) {
      console.log('❌ OTP resend failed: User already verified', { userId, email: user.email });
      return res.status(400).json({
        success: false,
        message: 'User already verified'
      });
    }

    console.log('🔐 Generating new OTP for user:', { userId, email: user.email });
    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await updateUser(userId, { 
      otp: otp,
      otpExpiry: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });

    console.log('📧 Sending new OTP email to:', user.email);
    // Send OTP email
    const emailResult = await emailService.sendOTPEmail(user.email, otp, user.profile.firstName);
    
    if (!emailResult.success) {
      console.error('❌ Failed to send OTP email during resend:', emailResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }

    console.log('✅ OTP resent successfully to:', user.email);
    res.json({
      success: true,
      message: 'OTP resent successfully'
    });
  } catch (error) {
    console.error('💥 OTP resend error:', {
      error: error.message,
      stack: error.stack,
      userId: req.body.userId
    });
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP',
      error: config.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Login
router.post('/login', authRateLimit, validateLogin, async (req, res) => {
  try {
    console.log('🔵 Login attempt started:', { email: req.body.email });
    const { email, password } = req.body;

    console.log('🔍 Finding user for login:', { email });
    // Find user with password field
    const user = await findActiveUserByEmail(email);

    if (!user) {
      console.log('❌ Login failed: User not found or inactive', { email });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('🔐 Checking password for user:', { userId: user.id, email });
    // Check password  
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('❌ Login failed: Invalid password', { userId: user.id, email });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('🔍 Checking user verification status:', { userId: user.id, email, verified: user.verified });
    // Check if user is verified
    if (!user.verified) {
      console.log('❌ Login failed: User not verified', { userId: user.id, email });
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address first',
        requiresVerification: true,
        userId: user.id
      });
    }

    console.log('🎫 Generating token for successful login:', { userId: user.id, email });
    // Generate token
    const token = generateToken(user.id);

    console.log('✅ Login successful:', { userId: user.id, email, role: user.role });
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          verified: user.verified
        },
        token
      }
    });
  } catch (error) {
    console.error('💥 Login error:', {
      error: error.message,
      stack: error.stack,
      email: req.body.email
    });
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: config.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  console.log('🔵 Get current user request:', { userId: req.user.id, email: req.user.email });
  console.log('✅ Returning current user data:', { userId: req.user.id, email: req.user.email });
  res.json({
    success: true,
    data: { user: req.user }
  });
});

module.exports = router;
