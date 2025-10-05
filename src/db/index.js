const config = require('../config/config');

// Database factory that returns the appropriate implementation
class DatabaseFactory {
  constructor() {
    this.dbType = process.env.DB_TYPE || 'mongodb'; // Default to MongoDB
    this.instance = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return this.instance;

    console.log(`🗄️ Initializing database layer: ${this.dbType}`);
    
    try {
      switch (this.dbType.toLowerCase()) {
        case 'mongodb':
        case 'mongo':
          this.instance = require('./mongo');
          break;
        case 'dynamodb':
        case 'dynamo':
          this.instance = require('./dynamo');
          break;
        default:
          console.warn(`⚠️ Unknown database type: ${this.dbType}, falling back to MongoDB`);
          this.instance = require('./mongo');
          break;
      }
      
      this.initialized = true;
      console.log(`✅ Database layer initialized successfully: ${this.dbType}`);
      return this.instance;
    } catch (error) {
      console.error(`❌ Failed to initialize database layer: ${this.dbType}`, error);
      throw error;
    }
  }

  getDatabase() {
    return this.initialize();
  }
}

// Export singleton instance
const factory = new DatabaseFactory();
module.exports = factory.getDatabase();