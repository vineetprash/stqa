const MongoUser = require('../../models/User');

// Query builder wrapper for MongoDB to match DynamoDB interface
class UserQuery {
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

// Simple MongoDB User operations
const User = {
  async findOne(query, options = {}) {
    let mongoQuery = MongoUser.findOne(query);
    if (options.select) mongoQuery = mongoQuery.select(options.select);
    if (options.populate) mongoQuery = mongoQuery.populate(options.populate);
    return await mongoQuery.exec();
  },

  async findById(id, options = {}) {
    let mongoQuery = MongoUser.findById(id);
    if (options.select) mongoQuery = mongoQuery.select(options.select);
    if (options.populate) mongoQuery = mongoQuery.populate(options.populate);
    return await mongoQuery.exec();
  },

  async find(query = {}, options = {}) {
    let mongoQuery = MongoUser.find(query);
    if (options.sort) mongoQuery = mongoQuery.sort(options.sort);
    if (options.limit) mongoQuery = mongoQuery.limit(options.limit);
    if (options.skip) mongoQuery = mongoQuery.skip(options.skip);
    if (options.select) mongoQuery = mongoQuery.select(options.select);
    if (options.populate) mongoQuery = mongoQuery.populate(options.populate);
    
    // Return query builder for chaining
    return new UserQuery(mongoQuery);
  },

  async create(data) {
    const user = new MongoUser(data);
    return await user.save();
  },

  async findByIdAndUpdate(id, update, options = {}) {
    const opts = { new: true, runValidators: true, ...options };
    return await MongoUser.findByIdAndUpdate(id, update, opts);
  },

  async findOneAndUpdate(query, update, options = {}) {
    const opts = { new: true, runValidators: true, ...options };
    return await MongoUser.findOneAndUpdate(query, update, opts);
  },

  async findByIdAndDelete(id) {
    return await MongoUser.findByIdAndDelete(id);
  },

  async deleteOne(query) {
    return await MongoUser.deleteOne(query);
  },

  async deleteMany(query) {
    return await MongoUser.deleteMany(query);
  },

  async countDocuments(query = {}) {
    return await MongoUser.countDocuments(query);
  }
};

module.exports = User;