// tests/viewSpamProtection.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../js/app');
const viewAnalytics = require('../js/src/utils/viewAnalytics');
const { viewTracker } = require('../js/src/middleware/viewTracking');

describe('View Spam Protection - White Box Tests', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/blog_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('TC2.1.3: View Tracking Data Structures', () => {
    beforeEach(() => {
      // Clear tracking data
      viewTracker.ipViews.clear();
      viewTracker.userViews.clear();
      viewTracker.fingerprints.clear();
    });

    test('IP-based tracking stores data correctly', () => {
      const ip = '192.168.1.1';
      const postId = 'test-post-123';
      const now = Date.now();

      // Simulate view tracking
      viewTracker.ipViews.set(ip, {
        posts: new Map([[postId, now]]),
        lastCleanup: now
      });

      const ipData = viewTracker.ipViews.get(ip);
      expect(ipData).toBeDefined();
      expect(ipData.posts.get(postId)).toBe(now);
    });

    test('User-based tracking works independently', () => {
      const userId = 'user-123';
      const postId = 'post-456';
      const now = Date.now();

      viewTracker.userViews.set(userId, {
        posts: new Map([[postId, now]]),
        lastCleanup: now
      });

      const userData = viewTracker.userViews.get(userId);
      expect(userData.posts.get(postId)).toBe(now);
    });

    test('Fingerprint tracking stores multiple timestamps', () => {
      const fingerprint = 'fp-test-123';
      const postId = 'post-789';
      const timestamps = [Date.now() - 1000, Date.now()];

      viewTracker.fingerprints.set(fingerprint, new Map([
        [postId, timestamps]
      ]));

      const fpData = viewTracker.fingerprints.get(fingerprint);
      expect(fpData.get(postId)).toEqual(timestamps);
    });
  });

  describe('TC2.1.3: Cooldown Logic Testing', () => {
    test('30-minute cooldown is enforced', () => {
      const mockReq = {
        params: { identifier: 'test-post' },
        ip: '192.168.1.1',
        user: { _id: 'user123' }
      };

      const now = Date.now();
      const thirtyMinutesAgo = now - (30 * 60 * 1000);
      const twentyNineMinutesAgo = now - (29 * 60 * 1000);

      // Set last view 30 minutes ago (should allow)
      viewTracker.ipViews.set('192.168.1.1', {
        posts: new Map([['test-post', thirtyMinutesAgo]]),
        lastCleanup: now
      });

      const mockNext = jest.fn();
      const shouldCountView = require('../js/src/middleware/viewTracking').shouldCountView;
      
      shouldCountView(mockReq, {}, mockNext);
      expect(mockReq.shouldCountView).toBe(true);

      // Set last view 29 minutes ago (should block)
      viewTracker.ipViews.set('192.168.1.1', {
        posts: new Map([['test-post', twentyNineMinutesAgo]]),
        lastCleanup: now
      });

      shouldCountView(mockReq, {}, mockNext);
      expect(mockReq.shouldCountView).toBe(false);
    });
  });

  describe('TC2.1.3: Suspicious Activity Detection', () => {
    test('Multiple rapid views trigger suspicious flag', () => {
      const mockReq = {
        params: { identifier: 'test-post' },
        ip: '192.168.1.100',
        get: jest.fn((header) => {
          if (header === 'User-Agent') return 'TestBot/1.0';
          return '';
        })
      };

      const validateView = require('../js/src/middleware/viewTracking').validateView;
      const mockNext = jest.fn();

      // Simulate 6 rapid views (threshold is 5)
      for (let i = 0; i < 6; i++) {
        validateView(mockReq, {}, mockNext);
      }

      expect(mockReq.suspiciousActivity).toBe(true);
      expect(mockReq.shouldCountView).toBe(false);
    });
  });
});

describe('View Analytics System - White Box Tests', () => {
  beforeEach(() => {
    // Reset analytics
    viewAnalytics.suspiciousIPs.clear();
    viewAnalytics.viewPatterns.clear();
  });

  describe('TC2.1.3: Analytics Data Recording', () => {
    test('View attempts are recorded correctly', () => {
      const ip = '192.168.1.1';
      const postId = 'post-123';
      const userAgent = 'Mozilla/5.0';

      viewAnalytics.recordViewAttempt(ip, postId, false, userAgent);

      const hour = Math.floor(Date.now() / (60 * 60 * 1000));
      const key = `${ip}-${hour}`;
      const pattern = viewAnalytics.viewPatterns.get(key);

      expect(pattern).toBeDefined();
      expect(pattern.totalViews).toBe(1);
      expect(pattern.blockedViews).toBe(0);
      expect(pattern.posts.has(postId)).toBe(true);
      expect(pattern.userAgents.has(userAgent)).toBe(true);
    });

    test('Blocked views are tracked separately', () => {
      const ip = '192.168.1.1';
      const postId = 'post-123';

      viewAnalytics.recordViewAttempt(ip, postId, true, 'Bot/1.0');

      const hour = Math.floor(Date.now() / (60 * 60 * 1000));
      const key = `${ip}-${hour}`;
      const pattern = viewAnalytics.viewPatterns.get(key);

      expect(pattern.totalViews).toBe(1);
      expect(pattern.blockedViews).toBe(1);
    });
  });

  describe('TC2.1.3: Suspicious Activity Flagging', () => {
    test('High view count triggers suspicious flag', () => {
      const ip = '192.168.1.1';
      
      // Simulate 51 views (threshold is 50)
      for (let i = 0; i < 51; i++) {
        viewAnalytics.recordViewAttempt(ip, `post-${i}`, false, 'Browser/1.0');
      }

      expect(viewAnalytics.suspiciousIPs.has(ip)).toBe(true);
    });

    test('High block ratio triggers suspicious flag', () => {
      const ip = '192.168.1.2';
      
      // 10 total views, 9 blocked (90% block rate, threshold is 80%)
      for (let i = 0; i < 9; i++) {
        viewAnalytics.recordViewAttempt(ip, 'post-spam', true, 'Bot/1.0');
      }
      viewAnalytics.recordViewAttempt(ip, 'post-legit', false, 'Bot/1.0');

      expect(viewAnalytics.suspiciousIPs.has(ip)).toBe(true);
    });
  });

  describe('TC2.1.3: Analytics Summary Generation', () => {
    test('Summary aggregates data correctly', () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';

      // Create some test data
      viewAnalytics.recordViewAttempt(ip1, 'post-1', false, 'Browser/1.0');
      viewAnalytics.recordViewAttempt(ip1, 'post-2', true, 'Browser/1.0');
      viewAnalytics.recordViewAttempt(ip2, 'post-1', false, 'Mobile/1.0');

      const summary = viewAnalytics.getAnalyticsSummary();

      expect(summary.last24Hours.totalViews).toBe(3);
      expect(summary.last24Hours.totalBlocked).toBe(1);
      expect(summary.last24Hours.uniqueIPs).toBe(2);
      expect(summary.last24Hours.uniquePosts).toBe(2);
    });
  });
});
