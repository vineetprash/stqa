// routes/posts.js
const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

async function uploadToS3(file) {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `${Date.now()}_${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
    // ACL: 'public-read'
  };
  const data = await s3.upload(params).promise();
  return data.Location;
}
const Post = require('../models/Post');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { contentRateLimit } = require('../middleware/ratelimit');
const { validatePost } = require('../middleware/validation');
const { viewRateLimit, shouldCountView, validateView } = require('../middleware/viewTracking');
const viewAnalytics = require('../utils/viewAnalytics');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Get all posts with pagination and filtering
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = 'published',
      author,
      tags,
      search
    } = req.query;

    // Build query
    const query = {};
    // Only show published posts to non-authenticated users
    if (!req.user || req.user.role !== 'admin') {
      query.status = 'published';
      query.publishedAt = { $lte: new Date() };
    } else if (status) {
      query.status = status;
    }

    // Additional filters
    if (author) query.author = author;
    if (tags) query.tags = { $in: Array.isArray(tags) ? tags : [tags] };
    if (search) query.$text = { $search: search };

    const posts = await Post.find(query)
      .populate('author', 'username profile.firstName profile.lastName')
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch posts',
      error: error.message
    });
  }
});

// Get single post by ID or slug
router.post('/view/:identifier', viewRateLimit, optionalAuth, shouldCountView, validateView, async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Check if identifier is ObjectId or slug
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
    const query = isObjectId ? { _id: identifier } : { slug: identifier };

    const post = await Post.findOne(query)
      .populate('author', 'username profile');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user can view unpublished posts
    if (post.status !== 'published') {
      if (!req.user || (req.user.role !== 'admin' && post.author._id.toString() !== req.user._id.toString())) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }
    }

    // Increment views with anti-spam protection
    if (post.status === 'published') {
      const userId = req.user?._id?.toString();
      const authorId = post.author._id.toString();
      
      // Only count view if:
      // 1. View tracking allows it (cooldown period)
      // 2. User is not the author
      // 3. No suspicious activity detected
      if (req.shouldCountView && userId !== authorId && !req.suspiciousActivity) {
        await Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } });
        
        // Log view for monitoring (optional)
        console.log(`View counted for post ${post._id} from ${req.ip || 'unknown IP'}`);
      } else if (req.suspiciousActivity) {
        console.log(`Suspicious view activity detected for post ${post._id} from ${req.ip || 'unknown IP'}`);
      }
    }

    res.json({
      success: true,
      data: { post },
      meta: {
        viewCounted: req.shouldCountView && !req.suspiciousActivity,
        suspiciousActivity: req.suspiciousActivity
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch post',
      error: error.message
    });
  }
});

// Create new post
router.post('/', authenticateToken, contentRateLimit, upload.array('images'), async (req, res) => {
  try {
    const { title, content, status = 'draft', tags = [] } = req.body;
    let tagArr = [];
    try {
      tagArr = JSON.parse(tags);
    } catch {
      tagArr = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : [];
    }

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = await Promise.all(req.files.map(file => uploadToS3(file)));
    }

    const post = new Post({
      title,
      content,
      author: req.user._id,
      status,
      tags: Array.isArray(tagArr) ? tagArr.slice(0, 10) : [],
      images: imageUrls
    });

    await post.save();
    await post.populate('author', 'username profile');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: { post }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create post',
      error: error.message
    });
  }
});

// Update post
router.put('/:id', authenticateToken, upload.array('images'), async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    // Check permissions
    if (req.user.role !== 'admin' && post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    // Handle tags
    let tagArr = [];
    try {
      tagArr = JSON.parse(req.body.tags);
    } catch {
      tagArr = typeof req.body.tags === 'string' ? req.body.tags.split(',').map(t => t.trim()) : [];
    }
    // Handle images
    let imageUrls = post.images || [];
    if (req.files && req.files.length > 0) {
      const newUrls = await Promise.all(req.files.map(file => uploadToS3(file)));
      imageUrls = [...imageUrls, ...newUrls];
    }
    post.title = req.body.title || post.title;
    post.content = req.body.content || post.content;
    post.status = req.body.status || post.status;
    post.tags = Array.isArray(tagArr) ? tagArr.slice(0, 10) : post.tags;
    post.images = imageUrls;
    await post.save();
    await post.populate('author', 'username profile');
    res.json({ success: true, message: 'Post updated successfully', data: { post } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update post', error: error.message });
  }
});

// Delete post
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await Post.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete post',
      error: error.message
    });
  }
});

// Toggle post like
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const userId = req.user._id;
    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      post.likes = post.likes.filter(id => id.toString() !== userId.toString());
    } else {
      post.likes.push(userId);
    }

    await post.save();

    res.json({
      success: true,
      message: isLiked ? 'Post unliked' : 'Post liked',
      data: {
        liked: !isLiked,
        likeCount: post.likes.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle like',
      error: error.message
    });
  }
});

// Admin endpoint to get view analytics
router.get('/analytics/views', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const analytics = viewAnalytics.getAnalyticsSummary();
    
    res.json({
      success: true,
      data: analytics,
      message: 'View analytics retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics',
      error: error.message
    });
  }
});

module.exports = router;
