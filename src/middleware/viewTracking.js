// middleware/viewTracking.js
const rateLimit = require('express-rate-limit');
const viewAnalytics = require('../utils/viewAnalytics');
const config = require('../config/config');

// In-memory store for tracking views (in production, use Redis)
const viewTracker = {
  // Track by IP address
  ipViews: new Map(),
  // Track by user ID for authenticated users
  userViews: new Map(),
  // Track fingerprints for advanced detection
  fingerprints: new Map(),
  // Cleanup old entries periodically
  cleanup: function() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    // Cleanup IP views
    for (const [key, data] of this.ipViews.entries()) {
      if (now - data.lastCleanup > maxAge) {
        data.posts.clear();
        data.lastCleanup = now;
      }
    }
    
    // Cleanup user views
    for (const [key, data] of this.userViews.entries()) {
      if (now - data.lastCleanup > maxAge) {
        data.posts.clear();
        data.lastCleanup = now;
      }
    }

    // Cleanup fingerprints
    for (const [key, posts] of this.fingerprints.entries()) {
      for (const [postId, views] of posts.entries()) {
        const recentViews = views.filter(viewTime => now - viewTime < maxAge);
        if (recentViews.length === 0) {
          posts.delete(postId);
        } else {
          posts.set(postId, recentViews);
        }
      }
      if (posts.size === 0) {
        this.fingerprints.delete(key);
      }
    }
  }
};

// Cleanup every hour
setInterval(() => viewTracker.cleanup(), 60 * 60 * 1000);

// Rate limiter for post views
const viewRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 view requests per windowMs
  message: {
    success: false,
    message: 'Too many view requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware to check if view should be counted
const shouldCountView = (req, res, next) => {
  const postId = req.params.identifier;
  const userIp = req.ip || req.connection.remoteAddress;
  const userId = req.user?._id?.toString();
  const now = Date.now();
  const viewCooldown = 30 * 60 * 1000; // 30 minutes cooldown between views

  // Check IP-based views
  if (!viewTracker.ipViews.has(userIp)) {
    viewTracker.ipViews.set(userIp, {
      posts: new Map(),
      lastCleanup: now
    });
  }

  const ipData = viewTracker.ipViews.get(userIp);
  const lastIpView = ipData.posts.get(postId);

  // Check user-based views for authenticated users
  let lastUserView = null;
  if (userId) {
    if (!viewTracker.userViews.has(userId)) {
      viewTracker.userViews.set(userId, {
        posts: new Map(),
        lastCleanup: now
      });
    }
    const userData = viewTracker.userViews.get(userId);
    lastUserView = userData.posts.get(postId);
  }

  // Determine if view should be counted
  const shouldCount = !lastIpView || (now - lastIpView > viewCooldown);
  const userShouldCount = !userId || !lastUserView || (now - lastUserView > viewCooldown);

  if (shouldCount && userShouldCount) {
    // Update tracking data
    ipData.posts.set(postId, now);
    if (userId) {
      const userData = viewTracker.userViews.get(userId);
      userData.posts.set(postId, now);
    }
    req.shouldCountView = true;
  } else {
    req.shouldCountView = false;
  }

  next();
};

// Enhanced view tracking with session fingerprinting
const createViewFingerprint = (req) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';
  const acceptLanguage = req.get('Accept-Language') || '';
  
  // Create a simple fingerprint (in production, use a proper fingerprinting library)
  const fingerprint = Buffer.from(`${ip}-${userAgent}-${acceptLanguage}`).toString('base64');
  return fingerprint;
};

// Advanced view validation middleware
const validateView = (req, res, next) => {
  const postId = req.params.identifier;
  const fingerprint = createViewFingerprint(req);
  const userIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';
  const now = Date.now();
  const suspiciousThreshold = 5; // Max 5 views per fingerprint per hour
  const hourlyWindow = 60 * 60 * 1000; // 1 hour

  // In development mode, don't permanently block IPs - just log for debugging
  const isDevelopment = config.NODE_ENV === 'development';

  // Check if IP is already flagged as suspicious
  if (viewAnalytics.isSuspicious(userIp)) {
    req.suspiciousActivity = true;
    
    if (isDevelopment) {
      // In development, allow the view but mark as suspicious for logging
      console.warn(`[DEV MODE] Suspicious IP detected but allowing view: ${userIp}`);
      req.shouldCountView = true; // Still count in dev mode for testing
    } else {
      // In production, block the view
      req.shouldCountView = false;
    }
    
    viewAnalytics.recordViewAttempt(userIp, postId, !isDevelopment, userAgent);
    return next();
  }

  // Track views by fingerprint
  if (!viewTracker.fingerprints.has(fingerprint)) {
    viewTracker.fingerprints.set(fingerprint, new Map());
  }

  const fingerprintData = viewTracker.fingerprints.get(fingerprint);
  const postViews = fingerprintData.get(postId) || [];

  // Remove views older than 1 hour
  const recentViews = postViews.filter(viewTime => now - viewTime < hourlyWindow);

  // Check if this seems like suspicious activity
  if (recentViews.length >= suspiciousThreshold) {
    req.suspiciousActivity = true;
    
    if (isDevelopment) {
      // In development, allow but log the suspicious activity
      console.warn(`[DEV MODE] Suspicious activity detected but allowing view:`, {
        ip: userIp,
        postId,
        recentViews: recentViews.length,
        threshold: suspiciousThreshold
      });
      req.shouldCountView = true;
    } else {
      // In production, block the view
      req.shouldCountView = false;
    }
    
    viewAnalytics.recordViewAttempt(userIp, postId, !isDevelopment, userAgent);
  } else {
    // Add current view time
    recentViews.push(now);
    fingerprintData.set(postId, recentViews);
    req.suspiciousActivity = false;
    viewAnalytics.recordViewAttempt(userIp, postId, false, userAgent);
  }

  next();
};

module.exports = {
  viewRateLimit,
  shouldCountView,
  validateView,
  viewTracker
};
