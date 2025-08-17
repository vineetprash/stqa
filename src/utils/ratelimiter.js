class TokenBucketRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.maxRequests = options.maxRequests || 100;
    this.tokensPerInterval = options.tokensPerInterval || 10;
    this.interval = options.interval || 60 * 1000; // 1 minute
    this.keyGenerator = options.keyGenerator || ((req) => req.ip);
    
    this.buckets = new Map();
    
    // Clean up old buckets periodically
    setInterval(() => this.cleanup(), this.windowMs);
  }

  getBucket(key) {
    const now = Date.now();
    
    if (!this.buckets.has(key)) {
      this.buckets.set(key, {
        tokens: this.maxRequests,
        lastRefill: now,
        requests: []
      });
    }

    return this.buckets.get(key);
  }

  refillTokens(bucket) {
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.interval) * this.tokensPerInterval;
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }

  isAllowed(key) {
    const bucket = this.getBucket(key);
    this.refillTokens(bucket);
    
    const now = Date.now();
    
    // Remove old requests (sliding window)
    bucket.requests = bucket.requests.filter(time => now - time < this.windowMs);
    
    // Check both token bucket and sliding window
    const hasTokens = bucket.tokens >= 1;
    const withinWindow = bucket.requests.length < this.maxRequests;
    
    if (hasTokens && withinWindow) {
      bucket.tokens -= 1;
      bucket.requests.push(now);
      return {
        allowed: true,
        remaining: Math.min(bucket.tokens, this.maxRequests - bucket.requests.length),
        resetTime: now + this.windowMs
      };
    }
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: now + this.windowMs,
      retryAfter: Math.ceil(this.windowMs / 1000)
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > this.windowMs * 2) {
        this.buckets.delete(key);
      }
    }
  }

  middleware() {
    return (req, res, next) => {
      const key = this.keyGenerator(req);
      const result = this.isAllowed(key);
      
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': this.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });
      
      if (!result.allowed) {
        res.set('Retry-After', result.retryAfter?.toString() || '900');
        return res.status(429).json({
          success: false,
          message: 'Too many requests',
          retryAfter: result.retryAfter
        });
      }
      
      next();
    };
  }
}

module.exports = TokenBucketRateLimiter;