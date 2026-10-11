import mongoose from 'mongoose';

/**
 * Mongoose ORM Database Connection Config
 */
const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.log('MongoDB MONGO_URI is not set. Database persistence is disabled.');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DATABASE || 'resumely'
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to database: ${error.message}`);
  }
};

export default connectDB;
