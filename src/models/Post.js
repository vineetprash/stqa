const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  images: [{
    type: String,
    trim: true
  }],
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },

  content: {
    type: String,
    required: true
  },
  excerpt: {
    type: String,
    maxlength: 300
  },
  // slug: {
  //   type: String,
  //   unique: true,
  //   required: true
  // },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  publishedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// // Indexes
// postSchema.index({ status: 1, publishedAt: -1 });
// postSchema.index({ author: 1, status: 1 });
// postSchema.index({ slug: 1 });

// // Text search index
// postSchema.index({ title: 'text', content: 'text' });

// Virtual for like count
postSchema.virtual('likeCount').get(function() {
  return this.likes?.length || 0;
});

// Auto-generate slug and excerpt
postSchema.pre('save', function(next) {
  // Generate slug from title
  // if (this.isModified('title') && !this.isModified('slug')) {
  //   this.slug = this.title
  //     .toLowerCase()
  //     .replace(/[^a-zA-Z0-9\s]/g, '')
  //     .replace(/\s+/g, '-')
  //     .substring(0, 100);
  // }

  // Generate excerpt from content
  if (this.isModified('content') && !this.excerpt) {
    this.excerpt = this.content.substring(0, 200) + '...';
  }

  // Set publishedAt when publishing
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  next();
});

module.exports = mongoose.model('Post', postSchema);
