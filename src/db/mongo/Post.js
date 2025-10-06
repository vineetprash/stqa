const MongoPost = require('../../models/Post');

// Query builder wrapper for MongoDB to match DynamoDB interface
class PostQuery {
  constructor(query) {
    this.mongoQuery = query;
  }

  populate(field, select) {
    this.mongoQuery = this.mongoQuery.populate(field, select);
    return this;
  }

  sort(sortObj) {
    this.mongoQuery = this.mongoQuery.sort(sortObj);
    return this;
  }

  limit(num) {
    this.mongoQuery = this.mongoQuery.limit(num);
    return this;
  }

  skip(num) {
    this.mongoQuery = this.mongoQuery.skip(num);
    return this;
  }

  select(fields) {
    this.mongoQuery = this.mongoQuery.select(fields);
    return this;
  }

  async exec() {
    return await this.mongoQuery.exec();
  }
}

// Simple MongoDB Post operations
const Post = {
  async findOne(query, options = {}) {
    let mongoQuery = MongoPost.findOne(query);
    if (options.select) mongoQuery = mongoQuery.select(options.select);
    if (options.populate) mongoQuery = mongoQuery.populate(options.populate);
    return await mongoQuery.exec();
  },

  async findById(id, options = {}) {
    let mongoQuery = MongoPost.findById(id);
    if (options.select) mongoQuery = mongoQuery.select(options.select);
    if (options.populate) mongoQuery = mongoQuery.populate(options.populate);
    return await mongoQuery.exec();
  },

  async find(query = {}, options = {}) {
    let mongoQuery = MongoPost.find(query);
    if (options.sort) mongoQuery = mongoQuery.sort(options.sort);
    if (options.limit) mongoQuery = mongoQuery.limit(options.limit);
    if (options.skip) mongoQuery = mongoQuery.skip(options.skip);
    if (options.select) mongoQuery = mongoQuery.select(options.select);
    if (options.populate) mongoQuery = mongoQuery.populate(options.populate);
    
    // Return query builder for chaining
    return new PostQuery(mongoQuery);
  },

  async create(data) {
    const post = new MongoPost(data);
    return await post.save();
  },

  async findByIdAndUpdate(id, update, options = {}) {
    const opts = { new: true, runValidators: true, ...options };
    return await MongoPost.findByIdAndUpdate(id, update, opts);
  },

  async findOneAndUpdate(query, update, options = {}) {
    const opts = { new: true, runValidators: true, ...options };
    return await MongoPost.findOneAndUpdate(query, update, opts);
  },

  async findByIdAndDelete(id) {
    return await MongoPost.findByIdAndDelete(id);
  },

  async deleteOne(query) {
    return await MongoPost.deleteOne(query);
  },

  async deleteMany(query) {
    return await MongoPost.deleteMany(query);
  },

  async countDocuments(query = {}) {
    return await MongoPost.countDocuments(query);
  },

  async aggregate(pipeline) {
    return await MongoPost.aggregate(pipeline);
  }
};

module.exports = Post;