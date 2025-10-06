const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.AWS_ENDPOINT && { endpoint: process.env.AWS_ENDPOINT })
});

const docClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.DYNAMODB_USERS_TABLE || 'Users';

// Helper to translate MongoDB-style queries to DynamoDB FilterExpression
const buildFilterExpression = (query) => {
  const expressions = [];
  const values = {};
  const names = {};
  let valueCounter = 0;

  const processCondition = (key, value) => {
    if (key === '$or') {
      // Handle $or operator
      const orExpressions = value.map(condition => {
        const orParts = [];
        Object.entries(condition).forEach(([k, v]) => {
          const valName = `:val${valueCounter++}`;
          const attrName = `#${k}`;
          orParts.push(`${attrName} = ${valName}`);
          values[valName] = v;
          names[attrName] = k;
        });
        return `(${orParts.join(' OR ')})`;
      });
      expressions.push(`(${orExpressions.join(' OR ')})`);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Handle MongoDB operators
      Object.entries(value).forEach(([op, val]) => {
        const valName = `:val${valueCounter++}`;
        const attrName = `#${key}`;
        
        if (op === '$in') {
          // Handle $in operator
          const inValues = val.map((v, i) => {
            const vn = `:val${valueCounter++}`;
            values[vn] = v;
            return vn;
          });
          expressions.push(`${attrName} IN (${inValues.join(', ')})`);
          names[attrName] = key;
        } else if (op === '$lte') {
          expressions.push(`${attrName} <= ${valName}`);
          values[valName] = val;
          names[attrName] = key;
        } else if (op === '$gte') {
          expressions.push(`${attrName} >= ${valName}`);
          values[valName] = val;
          names[attrName] = key;
        } else if (op === '$lt') {
          expressions.push(`${attrName} < ${valName}`);
          values[valName] = val;
          names[attrName] = key;
        } else if (op === '$gt') {
          expressions.push(`${attrName} > ${valName}`);
          values[valName] = val;
          names[attrName] = key;
        } else if (op === '$ne') {
          expressions.push(`${attrName} <> ${valName}`);
          values[valName] = val;
          names[attrName] = key;
        }
      });
    } else {
      // Simple equality
      const valName = `:val${valueCounter++}`;
      const attrName = `#${key}`;
      expressions.push(`${attrName} = ${valName}`);
      values[valName] = value;
      names[attrName] = key;
    }
  };

  Object.entries(query).forEach(([key, value]) => {
    if (key !== '$text') { // Skip $text for now, would need ElasticSearch integration
      processCondition(key, value);
    }
  });

  return {
    FilterExpression: expressions.length > 0 ? expressions.join(' AND ') : undefined,
    ExpressionAttributeValues: Object.keys(values).length > 0 ? values : undefined,
    ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined
  };
};

// Helper functions
const formatUser = (item) => {
  if (!item) return null;
  return {
    _id: item.id,
    id: item.id,
    username: item.username,
    email: item.email,
    password: item.password,
    role: item.role || 'user',
    isActive: item.isActive !== false,
    verified: item.verified || false,
    otp: item.otp,
    otpExpiry: item.otpExpiry ? new Date(item.otpExpiry) : null,
    profile: item.profile || {},
    createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
  };
};

const prepareForDynamo = (data) => {
  const now = new Date().toISOString();
  const dynamoData = { ...data, updatedAt: now };

  if (!dynamoData.id && !dynamoData._id) {
    dynamoData.id = uuidv4();
    dynamoData.createdAt = now;
  } else if (dynamoData._id) {
    dynamoData.id = dynamoData._id;
    delete dynamoData._id;
  }

  if (dynamoData.otpExpiry instanceof Date) {
    dynamoData.otpExpiry = dynamoData.otpExpiry.toISOString();
  }

  return dynamoData;
};

// Query builder for chainable methods
class UserQuery {
  constructor(query = {}) {
    this.query = query;
    this.options = {};
  }

  populate(field, select) {
    // DynamoDB doesn't support joins, but we can fetch related data after
    this.options.populate = { field, select };
    return this;
  }

  sort(sortObj) {
    this.options.sort = sortObj;
    return this;
  }

  limit(num) {
    this.options.limit = num;
    return this;
  }

  skip(num) {
    this.options.skip = num;
    return this;
  }

  select(fields) {
    this.options.select = fields;
    return this;
  }

  async exec() {
    return await User._executeQuery(this.query, this.options);
  }
}

// Simple DynamoDB User operations
const User = {
  // Internal method to execute queries
  async _executeQuery(query, options = {}) {
    try {
      const scanParams = { TableName: tableName };
      
      // Build filter expression from MongoDB-style query
      if (Object.keys(query).length > 0 && !query._id && !query.id) {
        const { FilterExpression, ExpressionAttributeValues, ExpressionAttributeNames } = buildFilterExpression(query);
        if (FilterExpression) scanParams.FilterExpression = FilterExpression;
        if (ExpressionAttributeValues) scanParams.ExpressionAttributeValues = ExpressionAttributeValues;
        if (ExpressionAttributeNames) scanParams.ExpressionAttributeNames = ExpressionAttributeNames;
      }

      if (options.limit && !options.skip) {
        scanParams.Limit = options.limit;
      }

      const response = await docClient.send(new ScanCommand(scanParams));
      let results = (response.Items || []).map(formatUser);

      // Apply sorting
      if (options.sort) {
        const sortEntries = Object.entries(options.sort);
        results.sort((a, b) => {
          for (const [sortKey, direction] of sortEntries) {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            if (aVal === bVal) continue;
            
            let comparison = 0;
            if (aVal > bVal) comparison = 1;
            if (aVal < bVal) comparison = -1;
            
            return direction === -1 ? -comparison : comparison;
          }
          return 0;
        });
      }

      // Apply skip and limit
      if (options.skip) results = results.slice(options.skip);
      if (options.limit && options.skip) results = results.slice(0, options.limit);

      // Handle populate (fetch related data)
      if (options.populate && results.length > 0) {
        // For User populate, we might need to fetch related Post data
        // This is a simplified version - you'd need to implement actual join logic
        console.log('⚠️ DynamoDB populate is limited - related data not fully supported');
      }

      return results;
    } catch (error) {
      console.error('DynamoDB _executeQuery error:', error);
      throw error;
    }
  },

  async findOne(query, options = {}) {
    try {
      // Handle direct ID lookup
      if (query._id || query.id) {
        const response = await docClient.send(new GetCommand({
          TableName: tableName,
          Key: { id: query._id || query.id }
        }));
        return formatUser(response.Item);
      }

      // Use query builder for complex queries
      const results = await this._executeQuery(query, { ...options, limit: 1 });
      return results[0] || null;
    } catch (error) {
      console.error('DynamoDB findOne error:', error);
      throw error;
    }
  },

  async findById(id, options = {}) {
    try {
      const response = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: { id: id.toString() }
      }));
      const user = formatUser(response.Item);
      
      // Support chainable methods
      if (options.select || options.populate) {
        const query = new UserQuery({ id });
        if (options.select) query.select(options.select);
        if (options.populate) query.populate(options.populate);
        return query;
      }
      
      return user;
    } catch (error) {
      console.error('DynamoDB findById error:', error);
      throw error;
    }
  },

  async find(query = {}, options = {}) {
    // Return query builder for chaining
    const queryBuilder = new UserQuery(query);
    if (options.sort) queryBuilder.sort(options.sort);
    if (options.limit) queryBuilder.limit(options.limit);
    if (options.skip) queryBuilder.skip(options.skip);
    if (options.select) queryBuilder.select(options.select);
    if (options.populate) queryBuilder.populate(options.populate);
    
    // If no chaining is needed, execute immediately
    if (Object.keys(options).length === 0) {
      return queryBuilder;
    }
    
    return queryBuilder;
  },

  async create(data) {
    try {
      if (data.password) {
        data.password = await bcrypt.hash(data.password, 12);
      }

      const dynamoData = prepareForDynamo(data);
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: dynamoData,
        ConditionExpression: 'attribute_not_exists(id)'
      }));
      
      return formatUser(dynamoData);
    } catch (error) {
      console.error('DynamoDB create error:', error);
      throw error;
    }
  },

  async findByIdAndUpdate(id, update, options = {}) {
    try {
      const updateData = prepareForDynamo({ ...update, id });
      delete updateData.id;
      
      const expressions = [];
      const values = {};
      const names = {};
      
      Object.entries(updateData).forEach(([key, value]) => {
        expressions.push(`#${key} = :${key}`);
        values[`:${key}`] = value;
        names[`#${key}`] = key;
      });

      const response = await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: { id: id.toString() },
        UpdateExpression: `SET ${expressions.join(', ')}`,
        ExpressionAttributeValues: values,
        ExpressionAttributeNames: names,
        ReturnValues: 'ALL_NEW'
      }));
      
      return formatUser(response.Attributes);
    } catch (error) {
      console.error('DynamoDB findByIdAndUpdate error:', error);
      throw error;
    }
  },

  async findOneAndUpdate(query, update, options = {}) {
    const item = await this.findOne(query);
    if (!item) return null;
    return await this.findByIdAndUpdate(item._id, update, options);
  },

  async findByIdAndDelete(id) {
    try {
      const response = await docClient.send(new DeleteCommand({
        TableName: tableName,
        Key: { id: id.toString() },
        ReturnValues: 'ALL_OLD'
      }));
      return formatUser(response.Attributes);
    } catch (error) {
      console.error('DynamoDB findByIdAndDelete error:', error);
      throw error;
    }
  },

  async deleteOne(query) {
    const item = await this.findOne(query);
    if (!item) return { deletedCount: 0 };
    await this.findByIdAndDelete(item._id);
    return { deletedCount: 1 };
  },

  async deleteMany(query) {
    const items = await this.find(query);
    for (const item of items) {
      await this.findByIdAndDelete(item._id);
    }
    return { deletedCount: items.length };
  },

  async countDocuments(query = {}) {
    const items = await this.find(query);
    return items.length;
  }
};

module.exports = User;