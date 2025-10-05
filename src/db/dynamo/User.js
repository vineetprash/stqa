const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.AWS_ENDPOINT && { endpoint: process.env.AWS_ENDPOINT })
});

const docClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.DYNAMODB_USERS_TABLE || 'Users';

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

// Simple DynamoDB User operations
const User = {
  async findOne(query, options = {}) {
    try {
      if (query._id || query.id) {
        const response = await docClient.send(new GetCommand({
          TableName: tableName,
          Key: { id: query._id || query.id }
        }));
        return formatUser(response.Item);
      }

      // Scan for other queries
      const scanParams = { TableName: tableName };
      if (query.email) {
        scanParams.FilterExpression = 'email = :email';
        scanParams.ExpressionAttributeValues = { ':email': query.email };
      } else if (query.username) {
        scanParams.FilterExpression = 'username = :username';
        scanParams.ExpressionAttributeValues = { ':username': query.username };
      }

      const response = await docClient.send(new ScanCommand(scanParams));
      return formatUser(response.Items?.[0]);
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
      return formatUser(response.Item);
    } catch (error) {
      console.error('DynamoDB findById error:', error);
      throw error;
    }
  },

  async find(query = {}, options = {}) {
    try {
      const scanParams = { TableName: tableName };
      
      if (Object.keys(query).length > 0) {
        const expressions = [];
        const values = {};
        Object.entries(query).forEach(([key, value], i) => {
          expressions.push(`${key} = :val${i}`);
          values[`:val${i}`] = value;
        });
        scanParams.FilterExpression = expressions.join(' AND ');
        scanParams.ExpressionAttributeValues = values;
      }

      if (options.limit) scanParams.Limit = options.limit;

      const response = await docClient.send(new ScanCommand(scanParams));
      let results = (response.Items || []).map(formatUser);

      // Simple sorting and skipping
      if (options.sort) {
        const [sortKey, direction] = Object.entries(options.sort)[0];
        results.sort((a, b) => {
          const comparison = a[sortKey] > b[sortKey] ? 1 : -1;
          return direction === -1 ? -comparison : comparison;
        });
      }

      if (options.skip) results = results.slice(options.skip);
      return results;
    } catch (error) {
      console.error('DynamoDB find error:', error);
      throw error;
    }
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