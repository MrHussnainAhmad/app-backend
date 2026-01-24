const mongoose = require('mongoose');

// Cache the connection to reuse across invocations in serverless env
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable Mongoose buffering
      serverSelectionTimeoutMS: 5000, // Fail fast if no connection
    };

    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      console.error('CRITICAL ERROR: MONGO_URI environment variable is not set!');
      throw new Error('MONGO_URI is not set. Cannot connect to MongoDB.');
    }
    
    // Log the connection string (masked credentials) for debugging
    const maskedUri = mongoUri.replace(/(mongodb(\+srv)?:\/\/[^:]+):([^@]+@)/, '$1:***@');
    console.log(`Attempting to connect to MongoDB with URI: ${maskedUri}`);

    cached.promise = mongoose.connect(mongoUri, opts).then((mongoose) => {
      console.log(`MongoDB Connected: ${mongoose.connection.host}`);
      return mongoose;
    }).catch(err => {
      console.error('MongoDB Connection PROMISE Rejected:', err);
      throw err; // Re-throw to propagate the error
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null; // Clear promise so next attempt is fresh
    console.error('MongoDB Connection AWAIT Failed:', e);
    throw e;
  }

  return cached.conn;
};

module.exports = connectDB;
