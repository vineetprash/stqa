const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');
const { authenticateToken } = require('../middleware/auth');
const { authRateLimit } = require('../middleware/ratelimit');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const emailService = require('../services/emailService');

const router = express.Router();

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
    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      console.log('❌ Registration failed: User already exists', existingUser, { 
        email, 
        username, 
        existingEmail: existingUser.email, 
        existingUsername: existingUser.username 
      });
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email or username'
      });
    }

    console.log('📝 Creating new user:', { email, username, firstName, lastName });
    // Create user but don't mark as verified
    const user = new User({
      username,
      email,
      password,
      verified: false,
      profile: { firstName, lastName }
    });

    // Generate OTP
    const otp = user.generateOTP();
    console.log('🔐 OTP generated for user:', { userId: user._id, email });
    await user.save();
    console.log('💾 User saved to database:', { userId: user._id, email });

    // Send OTP email
    console.log('📧 Sending OTP email to:', email);
    const emailResult = await emailService.sendOTPEmail(email, otp, firstName);
    
    if (!emailResult.success) {
      console.error('❌ Failed to send OTP email:', emailResult.error);
      // Don't fail registration if email fails
    } else {
      console.log('✅ OTP email sent successfully to:', email);
    }

    console.log('✅ Registration initiated successfully:', { userId: user._id, email });
    res.status(201).json({
      success: true,
      message: 'Registration initiated. Please check your email for the OTP.',
      data: {
        userId: user._id,
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
    const user = await User.findById(userId).select('+otp +otpExpiry');

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
    if (!user.verifyOTP(otp)) {
      console.log('❌ OTP verification failed: Invalid or expired OTP', { userId, email: user.email });
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    console.log('✅ OTP verified successfully, marking user as verified:', { userId, email: user.email });
    // Mark user as verified and clear OTP
    user.verified = true;
    user.clearOTP();
    await user.save();

    console.log('📧 Sending welcome email to:', user.email);
    // Send welcome email
    await emailService.sendWelcomeEmail(user.email, user.profile.firstName);

    // Generate token
    const token = generateToken(user._id);
    console.log('🎫 Token generated for verified user:', { userId, email: user.email });

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: {
          id: user._id,
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
    const user = await User.findById(userId);

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
    const otp = user.generateOTP();
    await user.save();

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
    const user = await User.findOne({ email, isActive: true }).select('+password');

    if (!user) {
      console.log('❌ Login failed: User not found or inactive', { email });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('🔐 Checking password for user:', { userId: user._id, email });
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log('❌ Login failed: Invalid password', { userId: user._id, email });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('🔍 Checking user verification status:', { userId: user._id, email, verified: user.verified });
    // Check if user is verified
    if (!user.verified) {
      console.log('❌ Login failed: User not verified', { userId: user._id, email });
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address first',
        requiresVerification: true,
        userId: user._id
      });
    }

    console.log('🎫 Generating token for successful login:', { userId: user._id, email });
    // Generate token
    const token = generateToken(user._id);

    console.log('✅ Login successful:', { userId: user._id, email, role: user.role });
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
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
  console.log('🔵 Get current user request:', { userId: req.user._id, email: req.user.email });
  console.log('✅ Returning current user data:', { userId: req.user._id, email: req.user.email });
  res.json({
    success: true,
    data: { user: req.user }
  });
});

module.exports = router;
