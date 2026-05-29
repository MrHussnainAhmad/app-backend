const mongoose = require('mongoose');
const dns = require('dns');

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
    const fallbackUri = process.env.MONGO_URI_FALLBACK;

    if (!mongoUri) {
      console.error('CRITICAL ERROR: MONGO_URI environment variable is not set!');
      throw new Error('MONGO_URI is not set. Cannot connect to MongoDB.');
    }
    
    const maskUri = (uri) => uri.replace(/(mongodb(\+srv)?:\/\/[^:]+):([^@]+@)/, '$1:***@');
    const connectWithUri = (uri) => {
      console.log(`Attempting to connect to MongoDB with URI: ${maskUri(uri)}`);
      return mongoose.connect(uri, opts).then((mongoose) => {
        console.log(`MongoDB Connected: ${mongoose.connection.host}`);
        return mongoose;
      });
    };

    cached.promise = (async () => {
      try {
        return await connectWithUri(mongoUri);
      } catch (err) {
        if (mongoUri.startsWith('mongodb+srv://') && err?.code === 'ECONNREFUSED' && err?.syscall === 'querySrv') {
          const dnsServers = (process.env.MONGO_DNS_SERVERS || '8.8.8.8,1.1.1.1')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

          if (dnsServers.length > 0) {
            try {
              dns.setServers(dnsServers);
              console.warn(`Mongo SRV lookup failed. Retrying with explicit DNS servers: ${dnsServers.join(', ')}`);
              return await connectWithUri(mongoUri);
            } catch (dnsRetryErr) {
              err = dnsRetryErr;
            }
          }

          if (fallbackUri) {
            console.warn('Mongo SRV lookup still failing. Falling back to MONGO_URI_FALLBACK.');
            return connectWithUri(fallbackUri);
          }
        }

        throw err;
      }
    })().catch(err => {
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
