const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.AWS_ENDPOINT && { endpoint: process.env.AWS_ENDPOINT })
});

const docClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.DYNAMODB_POSTS_TABLE || 'Posts';

// Helper functions
const formatPost = (item) => {
  if (!item) return null;
  return {
    _id: item.id,
    id: item.id,
    images: item.images || [],
    title: item.title,
    content: item.content,
    excerpt: item.excerpt,
    author: item.author,
    status: item.status || 'draft',
    tags: item.tags || [],
    views: item.views || 0,
    likes: item.likes || [],
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
    createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
    get likeCount() { return this.likes?.length || 0; }
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

  if (dynamoData.publishedAt instanceof Date) {
    dynamoData.publishedAt = dynamoData.publishedAt.toISOString();
  }

  if (dynamoData.author && dynamoData.author._id) {
    dynamoData.author = dynamoData.author._id;
  }

  return dynamoData;
};

// Simple DynamoDB Post operations
const Post = {
  async findOne(query, options = {}) {
    try {
      if (query._id || query.id) {
        const response = await docClient.send(new GetCommand({
          TableName: tableName,
          Key: { id: query._id || query.id }
        }));
        return formatPost(response.Item);
      }

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

      const response = await docClient.send(new ScanCommand(scanParams));
      return formatPost(response.Items?.[0]);
    } catch (error) {
      console.error('DynamoDB Post findOne error:', error);
      throw error;
    }
  },

  async findById(id, options = {}) {
    try {
      const response = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: { id: id.toString() }
      }));
      return formatPost(response.Item);
    } catch (error) {
      console.error('DynamoDB Post findById error:', error);
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
      let results = (response.Items || []).map(formatPost);

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
      console.error('DynamoDB Post find error:', error);
      throw error;
    }
  },

  async create(data) {
    try {
      const dynamoData = prepareForDynamo(data);
      
      if (!dynamoData.excerpt && dynamoData.content) {
        dynamoData.excerpt = dynamoData.content.substring(0, 200) + '...';
      }

      if (dynamoData.status === 'published' && !dynamoData.publishedAt) {
        dynamoData.publishedAt = new Date().toISOString();
      }
      
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: dynamoData
      }));
      
      return formatPost(dynamoData);
    } catch (error) {
      console.error('DynamoDB Post create error:', error);
      throw error;
    }
  },

  async findByIdAndUpdate(id, update, options = {}) {
    try {
      const updateData = prepareForDynamo({ ...update });
      
      const expressions = [];
      const values = {};
      const names = {};
      
      Object.entries(updateData).forEach(([key, value]) => {
        if (key === '$inc') {
          Object.entries(value).forEach(([incKey, incValue]) => {
            expressions.push(`#${incKey} = if_not_exists(#${incKey}, :zero) + :${incKey}`);
            values[`:${incKey}`] = incValue;
            values[':zero'] = 0;
            names[`#${incKey}`] = incKey;
          });
        } else {
          expressions.push(`#${key} = :${key}`);
          values[`:${key}`] = value;
          names[`#${key}`] = key;
        }
      });

      if (expressions.length === 0) return null;

      const response = await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: { id: id.toString() },
        UpdateExpression: `SET ${expressions.join(', ')}`,
        ExpressionAttributeValues: values,
        ExpressionAttributeNames: names,
        ReturnValues: 'ALL_NEW'
      }));
      
      return formatPost(response.Attributes);
    } catch (error) {
      console.error('DynamoDB Post findByIdAndUpdate error:', error);
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
      return formatPost(response.Attributes);
    } catch (error) {
      console.error('DynamoDB Post findByIdAndDelete error:', error);
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
  },

  async aggregate(pipeline) {
    console.warn('DynamoDB aggregate is simplified');
    return await this.find();
  }
};

module.exports = Post;