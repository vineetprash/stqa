const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');

const cloudwatch = new CloudWatchClient({
  region: process.env.AWS_REGION || 'ap-south-1'
});

const checkDynamoDBUsage = async () => {
  console.log('📊 Checking DynamoDB Usage...\n');
  
  const tables = ['simple-blogs-Users', 'simple-blogs-Posts'];
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
  
  let totalReadCapacity = 0;
  let totalWriteCapacity = 0;
  
  for (const tableName of tables) {
    try {
      // Get Read Capacity Usage
      const readParams = {
        Namespace: 'AWS/DynamoDB',
        MetricName: 'ConsumedReadCapacityUnits',
        Dimensions: [
          {
            Name: 'TableName',
            Value: tableName
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600, // 1 hour periods
        Statistics: ['Average']
      };
      
      const readResult = await cloudwatch.send(new GetMetricStatisticsCommand(readParams));
      const avgReadCapacity = readResult.Datapoints?.[0]?.Average || 0;
      
      // Get Write Capacity Usage
      const writeParams = {
        ...readParams,
        MetricName: 'ConsumedWriteCapacityUnits'
      };
      
      const writeResult = await cloudwatch.send(new GetMetricStatisticsCommand(writeParams));
      const avgWriteCapacity = writeResult.Datapoints?.[0]?.Average || 0;
      
      totalReadCapacity += avgReadCapacity;
      totalWriteCapacity += avgWriteCapacity;
      
      console.log(`📋 ${tableName} Table:`);
      console.log(`   Read Capacity: ${avgReadCapacity.toFixed(2)} RCU/hour`);
      console.log(`   Write Capacity: ${avgWriteCapacity.toFixed(2)} WCU/hour`);
      console.log('');
      
    } catch (error) {
      console.log(`⚠️  Could not get metrics for ${tableName}: ${error.message}`);
    }
  }
  
  // Calculate monthly projections
  const monthlyReads = totalReadCapacity * 24 * 30;
  const monthlyWrites = totalWriteCapacity * 24 * 30;
  
  console.log('🎯 Always Free Tier Status:');
  console.log(`   Monthly Read Projection: ${monthlyReads.toFixed(0)} RCU (Limit: 25 RCU)`);
  console.log(`   Monthly Write Projection: ${monthlyWrites.toFixed(0)} WCU (Limit: 25 WCU)`);
  console.log('');
  
  // Status check
  if (monthlyReads <= 20 && monthlyWrites <= 20) {
    console.log('✅ You are well within Always Free limits! 🎉');
  } else if (monthlyReads <= 25 && monthlyWrites <= 25) {
    console.log('⚠️  You are approaching Always Free limits. Monitor usage closely.');
  } else {
    console.log('❌ You may exceed Always Free limits. Consider reducing usage.');
  }
};

// Run if called directly
if (require.main === module) {
  checkDynamoDBUsage().catch(console.error);
}

module.exports = { checkDynamoDBUsage };