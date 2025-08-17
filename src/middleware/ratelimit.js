const TokenBucketRateLimiter = require('../utils/ratelimiter');

// General API rate limiting
const generalRateLimit = new TokenBucketRateLimiter({
  windowMs: 15 * 60 * 1000,      // 15 minutes
  maxRequests: 100,              // 100 requests per window
  tokensPerInterval: 20,         // Refill 20 tokens
  interval: 60 * 1000           // Every minute
}).middleware();

// Strict auth rate limiting
const authRateLimit = new TokenBucketRateLimiter({
  windowMs: 15 * 60 * 1000,      // 15 minutes
  maxRequests: 5,                // 5 requests per window
  tokensPerInterval: 1,          // Refill 1 token
  interval: 3 * 60 * 1000,      // Every 3 minutes
  keyGenerator: (req) => `auth:${req.ip}`
}).middleware();

// Content creation rate limiting
const contentRateLimit = new TokenBucketRateLimiter({
  windowMs: 60 * 60 * 1000,      // 1 hour
  maxRequests: 10,               // 10 posts per hour
  tokensPerInterval: 5,          // Refill 5 tokens
  interval: 60 * 60 * 1000,     // Every hour
  keyGenerator: (req) => `content:${req.user?.id || req.ip}`
}).middleware();

module.exports = {
  generalRateLimit,
  authRateLimit,
  contentRateLimit
};
