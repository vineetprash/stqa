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
  console.log('📤 Starting S3 upload:', { 
    fileName: file.originalname, 
    size: file.size, 
    mimeType: file.mimetype 
  });
  
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `${Date.now()}_${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
    // ACL: 'public-read'
  };
  
  try {
    const data = await s3.upload(params).promise();
    console.log('✅ S3 upload successful:', { 
      fileName: file.originalname, 
      url: data.Location,
      key: params.Key 
    });
    return data.Location;
  } catch (error) {
    console.error('❌ S3 upload failed:', { 
      fileName: file.originalname, 
      error: error.message 
    });
    throw error;
  }
}
const { Post } = require('../db');
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
    console.log('🔵 Get posts request:', { 
      query: req.query, 
      userId: req.user?._id, 
      userRole: req.user?.role 
    });
    
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

    console.log('🔍 Posts query built:', query);

    const posts = await Post.find(query)
      .populate('author', 'username profile.firstName profile.lastName')
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Post.countDocuments(query);

    console.log('✅ Posts fetched successfully:', { 
      postsCount: posts.length, 
      total, 
      page: parseInt(page), 
      limit: parseInt(limit) 
    });

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
    console.error('💥 Get posts error:', {
      error: error.message,
      stack: error.stack,
      query: req.query,
      userId: req.user?._id
    });
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
    console.log('🔵 View post request:', { 
      identifier: req.params.identifier, 
      userId: req.user?._id,
      ip: req.ip 
    });
    
    const { identifier } = req.params;
    
    // Check if identifier is ObjectId or slug
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
    const query = isObjectId ? { _id: identifier } : { slug: identifier };

    console.log('🔍 Looking for post with query:', query);

    const post = await Post.findOne(query)
      .populate('author', 'username profile');

    if (!post) {
      console.log('❌ Post not found:', { identifier, query });
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    console.log('📄 Post found:', { 
      postId: post._id, 
      title: post.title, 
      status: post.status, 
      author: post.author.username 
    });

    // Check if user can view unpublished posts
    if (post.status !== 'published') {
      console.log('🔐 Checking access to unpublished post:', { 
        postId: post._id, 
        status: post.status,
        userId: req.user?._id,
        authorId: post.author._id,
        userRole: req.user?.role 
      });
      
      if (!req.user || (req.user.role !== 'admin' && post.author._id.toString() !== req.user._id.toString())) {
        console.log('❌ Access denied to unpublished post:', { 
          postId: post._id, 
          userId: req.user?._id 
        });
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }
    }

    // Increment views with anti-spam protection
    const userId = req.user?._id?.toString();
    const authorId = post.author._id.toString();
    
    if (post.status === 'published') {
      // Only count view if:
      // 1. View tracking allows it (cooldown period)
      // 2. User is not the author
      // 3. No suspicious activity detected
      if (req.shouldCountView && userId !== authorId && !req.suspiciousActivity) {
        await Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } });
        console.log(`👁️ View counted for post ${post._id} from ${req.ip || 'unknown IP'}, user: ${userId || 'anonymous'}`);
      } else if (req.suspiciousActivity) {
        console.log(`🚨 Suspicious view activity detected for post ${post._id} from ${req.ip || 'unknown IP'}`);
      } else {
        console.log(`👁️ View not counted for post ${post._id} (shouldCount: ${req.shouldCountView}, isAuthor: ${userId === authorId})`);
      }
    }

    console.log('✅ Post view successful:', { 
      postId: post._id, 
      title: post.title,
      viewCounted: req.shouldCountView && userId !== authorId && !req.suspiciousActivity 
    });

    res.json({
      success: true,
      data: { post },
      meta: {
        viewCounted: req.shouldCountView && !req.suspiciousActivity,
        suspiciousActivity: req.suspiciousActivity
      }
    });
  } catch (error) {
    console.error('💥 View post error:', {
      error: error.message,
      stack: error.stack,
      identifier: req.params.identifier,
      userId: req.user?._id,
      ip: req.ip
    });
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
    console.log('🔵 Create post request:', { 
      userId: req.user._id, 
      username: req.user.username,
      hasFiles: req.files?.length || 0,
      bodyKeys: Object.keys(req.body)
    });
    
    const { title, content, status = 'draft', tags = [] } = req.body;
    let tagArr = [];
    try {
      tagArr = JSON.parse(tags);
      console.log('📝 Tags parsed successfully:', tagArr);
    } catch {
      tagArr = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : [];
      console.log('📝 Tags parsed as string/fallback:', tagArr);
    }

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      console.log('📸 Processing image uploads:', { count: req.files.length });
      imageUrls = await Promise.all(req.files.map(file => uploadToS3(file)));
      console.log('✅ All images uploaded successfully:', { count: imageUrls.length, urls: imageUrls });
    }

    console.log('📝 Creating post with data:', { 
      title, 
      contentLength: content?.length, 
      status, 
      tagsCount: tagArr.length,
      imagesCount: imageUrls.length 
    });

    const post = new Post({
      title,
      content,
      author: req.user._id,
      status,
      tags: Array.isArray(tagArr) ? tagArr.slice(0, 10) : [],
      images: imageUrls
    });

    await post.save();
    console.log('💾 Post saved to database:', { postId: post._id, title: post.title });
    
    await post.populate('author', 'username profile');
    console.log('✅ Post created successfully:', { postId: post._id, title: post.title, author: post.author.username });

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: { post }
    });
  } catch (error) {
    console.error('💥 Create post error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      title: req.body.title,
      filesCount: req.files?.length || 0
    });
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
    console.log('🔵 Update post request:', { 
      postId: req.params.id, 
      userId: req.user._id,
      hasFiles: req.files?.length || 0,
      bodyKeys: Object.keys(req.body)
    });
    
    const post = await Post.findById(req.params.id);
    if (!post) {
      console.log('❌ Post not found for update:', { postId: req.params.id });
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    
    console.log('📄 Post found for update:', { 
      postId: post._id, 
      title: post.title, 
      authorId: post.author,
      currentImagesCount: post.images?.length || 0 
    });
    
    // Check permissions
    if (req.user.role !== 'admin' && post.author.toString() !== req.user._id.toString()) {
      console.log('❌ Update access denied:', { 
        postId: req.params.id, 
        userId: req.user._id, 
        postAuthor: post.author,
        userRole: req.user.role 
      });
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    console.log('✅ Update permission granted:', { postId: req.params.id, userId: req.user._id });
    
    // Handle tags
    let tagArr = [];
    try {
      tagArr = JSON.parse(req.body.tags);
      console.log('📝 Tags parsed for update:', tagArr);
    } catch {
      tagArr = typeof req.body.tags === 'string' ? req.body.tags.split(',').map(t => t.trim()) : [];
      console.log('📝 Tags parsed as fallback for update:', tagArr);
    }
    
    // Handle images
    let imageUrls = post.images || [];
    if (req.files && req.files.length > 0) {
      console.log('📸 Processing new image uploads for update:', { count: req.files.length });
      const newUrls = await Promise.all(req.files.map(file => uploadToS3(file)));
      imageUrls = [...imageUrls, ...newUrls];
      console.log('✅ New images added to post:', { 
        previousCount: post.images?.length || 0, 
        newCount: newUrls.length,
        totalCount: imageUrls.length 
      });
    }
    
    console.log('📝 Updating post fields:', {
      postId: post._id,
      titleChanged: req.body.title !== post.title,
      contentChanged: req.body.content !== post.content,
      statusChanged: req.body.status !== post.status,
      tagsChanged: JSON.stringify(tagArr) !== JSON.stringify(post.tags),
      imagesChanged: imageUrls.length !== (post.images?.length || 0)
    });
    
    post.title = req.body.title || post.title;
    post.content = req.body.content || post.content;
    post.status = req.body.status || post.status;
    post.tags = Array.isArray(tagArr) ? tagArr.slice(0, 10) : post.tags;
    post.images = imageUrls;
    
    await post.save();
    console.log('💾 Post updated and saved:', { postId: post._id, title: post.title });
    
    await post.populate('author', 'username profile');
    console.log('✅ Post update successful:', { postId: post._id, title: post.title, author: post.author.username });
    
    res.json({ success: true, message: 'Post updated successfully', data: { post } });
  } catch (error) {
    console.error('💥 Update post error:', {
      error: error.message,
      stack: error.stack,
      postId: req.params.id,
      userId: req.user._id,
      filesCount: req.files?.length || 0
    });
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
