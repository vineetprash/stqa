// DynamoDB table creation script
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.AWS_ENDPOINT && { endpoint: process.env.AWS_ENDPOINT }),
});

const createUsersTable = async () => {
  const tableName = process.env.DYNAMODB_USERS_TABLE || 'Users';
  
  const params = {
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
      { AttributeName: 'username', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'email-index',
        KeySchema: [
          { AttributeName: 'email', KeyType: 'HASH' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 2,
          WriteCapacityUnits: 1
        }
      },
      {
        IndexName: 'username-index',
        KeySchema: [
          { AttributeName: 'username', KeyType: 'HASH' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 2,
          WriteCapacityUnits: 1
        }
      }
    ],
    BillingMode: 'PROVISIONED',
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 3
    }
  };

  try {
    // Check if table exists
    try {
      await client.send(new DescribeTableCommand({ TableName: tableName }));
      console.log(`✅ Users table '${tableName}' already exists`);
      return;
    } catch (error) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    // Create table
    console.log(`🔨 Creating Users table '${tableName}'...`);
    const result = await client.send(new CreateTableCommand(params));
    console.log(`✅ Users table '${tableName}' created successfully`);
    return result;
  } catch (error) {
    console.error(`❌ Error creating Users table '${tableName}':`, error);
    throw error;
  }
};

const createPostsTable = async () => {
  const tableName = process.env.DYNAMODB_POSTS_TABLE || 'Posts';
  
  const params = {
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'author', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'author-index',
        KeySchema: [
          { AttributeName: 'author', KeyType: 'HASH' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 3,
          WriteCapacityUnits: 1
        }
      },
      {
        IndexName: 'status-index',
        KeySchema: [
          { AttributeName: 'status', KeyType: 'HASH' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 3,
          WriteCapacityUnits: 1
        }
      }
    ],
    BillingMode: 'PROVISIONED',
    ProvisionedThroughput: {
      ReadCapacityUnits: 8,
      WriteCapacityUnits: 2
    }
  };

  try {
    // Check if table exists
    try {
      await client.send(new DescribeTableCommand({ TableName: tableName }));
      console.log(`✅ Posts table '${tableName}' already exists`);
      return;
    } catch (error) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    // Create table
    console.log(`🔨 Creating Posts table '${tableName}'...`);
    const result = await client.send(new CreateTableCommand(params));
    console.log(`✅ Posts table '${tableName}' created successfully`);
    return result;
  } catch (error) {
    console.error(`❌ Error creating Posts table '${tableName}':`, error);
    throw error;
  }
};

const createTables = async () => {
  console.log('🚀 Setting up DynamoDB tables...');
  
  try {
    await createUsersTable();
    await createPostsTable();
    console.log('🎉 All DynamoDB tables are ready!');
  } catch (error) {
    console.error('💥 Failed to set up DynamoDB tables:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  createTables();
}

module.exports = {
  createUsersTable,
  createPostsTable,
  createTables
};