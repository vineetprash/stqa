
// Analytics for monitoring view patterns and detecting potential spam
const config = require('../config/config');

class ViewAnalytics {
  constructor() {
    this.suspiciousIPs = new Set();
    this.viewPatterns = new Map();
    this.alertThresholds = {
      maxViewsPerHour: 50,
      maxPostsPerHour: 20,
      suspiciousRatio: 0.8 // 80% of views being flagged as suspicious
    };
  }

  // Record a view attempt
  recordViewAttempt(ip, postId, wasBlocked, userAgent) {
    const now = Date.now();
    const hour = Math.floor(now / (60 * 60 * 1000));
    const key = `${ip}-${hour}`;

    if (!this.viewPatterns.has(key)) {
      this.viewPatterns.set(key, {
        ip,
        hour,
        totalViews: 0,
        blockedViews: 0,
        posts: new Set(),
        userAgents: new Set(),
        timestamps: []
      });
    }

    const pattern = this.viewPatterns.get(key);
    pattern.totalViews++;
    pattern.posts.add(postId);
    pattern.userAgents.add(userAgent);
    pattern.timestamps.push(now);

    if (wasBlocked) {
      pattern.blockedViews++;
    }

    // Check for suspicious activity
    this.checkSuspiciousActivity(pattern);
  }

  // Check if an IP shows suspicious patterns
  checkSuspiciousActivity(pattern) {
    const { totalViews, blockedViews, posts, userAgents } = pattern;
    const suspiciousRatio = blockedViews / totalViews;
    const isDevelopment = config.NODE_ENV === 'development';

    // Flag as suspicious if:
    // 1. Too many views per hour
    // 2. Too many different posts viewed
    // 3. High ratio of blocked views
    if (
      totalViews > this.alertThresholds.maxViewsPerHour ||
      posts.size > this.alertThresholds.maxPostsPerHour ||
      suspiciousRatio > this.alertThresholds.suspiciousRatio
    ) {
      if (isDevelopment) {
        // In development, just log but don't permanently flag
        console.warn(`[DEV MODE] Suspicious activity detected from IP: ${pattern.ip} (not blocking)`, {
          totalViews,
          blockedViews,
          postsViewed: posts.size,
          suspiciousRatio: suspiciousRatio.toFixed(2),
          note: 'IP not permanently blocked in development mode'
        });
        // Don't add to suspicious IPs in development
      } else {
        // In production, flag as suspicious
        this.suspiciousIPs.add(pattern.ip);
        console.warn(`Suspicious activity detected from IP: ${pattern.ip}`, {
          totalViews,
          blockedViews,
          postsViewed: posts.size,
          suspiciousRatio: suspiciousRatio.toFixed(2)
        });
      }
    }
  }

  // Get analytics summary
  getAnalyticsSummary() {
    const now = Date.now();
    const currentHour = Math.floor(now / (60 * 60 * 1000));
    const last24Hours = Array.from({ length: 24 }, (_, i) => currentHour - i);

    let totalViews = 0;
    let totalBlocked = 0;
    let uniqueIPs = new Set();
    let uniquePosts = new Set();

    last24Hours.forEach(hour => {
      this.viewPatterns.forEach((pattern, key) => {
        if (pattern.hour === hour) {
          totalViews += pattern.totalViews;
          totalBlocked += pattern.blockedViews;
          uniqueIPs.add(pattern.ip);
          pattern.posts.forEach(post => uniquePosts.add(post));
        }
      });
    });

    return {
      last24Hours: {
        totalViews,
        totalBlocked,
        uniqueIPs: uniqueIPs.size,
        uniquePosts: uniquePosts.size,
        blockRate: totalViews > 0 ? (totalBlocked / totalViews * 100).toFixed(2) : 0
      },
      suspiciousIPs: Array.from(this.suspiciousIPs),
      suspiciousIPCount: this.suspiciousIPs.size
    };
  }

  // Clean up old data
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    this.viewPatterns.forEach((pattern, key) => {
      const patternAge = now - (pattern.hour * 60 * 60 * 1000);
      if (patternAge > maxAge) {
        this.viewPatterns.delete(key);
      }
    });

    // Clean suspicious IPs every 24 hours
    if (this.lastCleanup && now - this.lastCleanup > maxAge) {
      this.suspiciousIPs.clear();
      this.lastCleanup = now;
    } else if (!this.lastCleanup) {
      this.lastCleanup = now;
    }
  }

  // Check if IP is flagged as suspicious
  isSuspicious(ip) {
    const isDevelopment = config.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // In development mode, never consider IPs as permanently suspicious
      // This allows for easier testing and development
      return false;
    }
    
    return this.suspiciousIPs.has(ip);
  }

  // Force clear suspicious IPs (useful for development/testing)
  clearSuspiciousIPs() {
    this.suspiciousIPs.clear();
    console.log('All suspicious IPs cleared');
  }

  // Get current suspicious IPs (for debugging)
  getSuspiciousIPs() {
    return Array.from(this.suspiciousIPs);
  }
}

// Create singleton instance
const viewAnalytics = new ViewAnalytics();

// Clean up every hour
setInterval(() => viewAnalytics.cleanup(), 60 * 60 * 1000);

module.exports = viewAnalytics;
