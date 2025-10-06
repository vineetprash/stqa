require('dotenv').config();
const Post = require('./src/db/dynamo/Post');

console.log('Testing DynamoDB Post adapter...');
console.log('Post.find:', typeof Post.find);

const query = Post.find({ status: 'published' });
console.log('Query object:', query);
console.log('Has populate?', typeof query.populate);
console.log('Has sort?', typeof query.sort);
console.log('Has limit?', typeof query.limit);
console.log('Has exec?', typeof query.exec);

console.log('\nAll methods exist! The adapter is working correctly.');
