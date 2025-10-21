import mongoose from 'mongoose';
import logger from '../utils/logger';

const connectDB = async () => {
  try {
    let mongoURI = process.env.MONGODB_URI!;
    
    // Better URI handling
    if (mongoURI.includes('mongodb://') || mongoURI.includes('mongodb+srv://')) {
      // URI is already properly formatted
      console.log('✅ MongoDB URI format is correct');
    } else {
      // Extract URI from potential environment variable issues
      const uriMatch = mongoURI.match(/(mongodb(?:\+srv)?:\/\/[^ ]+)/);
      if (uriMatch) {
        mongoURI = uriMatch[1];
      }
    }
    
    console.log('🔗 Connecting to MongoDB...');
    
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log('✅ Database connection established successfully');
  } catch (error) {
    logger.error(`❌ Error connecting to MongoDB: ${error}`);
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

export default connectDB;