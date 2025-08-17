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
    const { username, email, password, firstName, lastName } = req.body;

    // Basic validation
    if (!email || !password || !username || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email or username'
      });
    }

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
    await user.save();

    // Send OTP email
    const emailResult = await emailService.sendOTPEmail(email, otp, firstName);
    
    if (!emailResult.success) {
      console.error('Failed to send OTP email:', emailResult.error);
      // Don't fail registration if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Registration initiated. Please check your email for the OTP.',
      data: {
        userId: user._id,
        email: user.email
      }
    });
  } catch (error) {
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
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'User ID and OTP are required'
      });
    }

    // Find user with OTP fields
    const user = await User.findById(userId).select('+otp +otpExpiry');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.verified) {
      return res.status(400).json({
        success: false,
        message: 'User already verified'
      });
    }

    // Verify OTP
    if (!user.verifyOTP(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Mark user as verified and clear OTP
    user.verified = true;
    user.clearOTP();
    await user.save();

    // Send welcome email
    await emailService.sendWelcomeEmail(user.email, user.profile.firstName);

    // Generate token
    const token = generateToken(user._id);

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
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.verified) {
      return res.status(400).json({
        success: false,
        message: 'User already verified'
      });
    }

    // Generate new OTP
    const otp = user.generateOTP();
    await user.save();

    // Send OTP email
    const emailResult = await emailService.sendOTPEmail(user.email, otp, user.profile.firstName);
    
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }

    res.json({
      success: true,
      message: 'OTP resent successfully'
    });
  } catch (error) {
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
    const { email, password } = req.body;

    // Find user with password field
    const user = await User.findOne({ email, isActive: true }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is verified
    if (!user.verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address first',
        requiresVerification: true,
        userId: user._id
      });
    }

    // Generate token
    const token = generateToken(user._id);

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
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: config.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    data: { user: req.user }
  });
});

module.exports = router;
