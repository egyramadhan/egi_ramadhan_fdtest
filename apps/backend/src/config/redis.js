import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: 0,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
};

// Create Redis client
const redisClient = createClient({
  socket: {
    host: redisConfig.host,
    port: redisConfig.port,
  },
  password: redisConfig.password,
  database: redisConfig.db,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.error('Redis connection refused');
      return new Error('Redis connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      console.error('Redis retry time exhausted');
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      console.error('Redis max retry attempts reached');
      return undefined;
    }
    // Reconnect after
    return Math.min(options.attempt * 100, 3000);
  }
});

// Redis event handlers
redisClient.on('connect', () => {
  console.log('✅ Redis client connected');
});

redisClient.on('ready', () => {
  console.log('✅ Redis client ready');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis client error:', err);
});

redisClient.on('end', () => {
  console.log('🔄 Redis client disconnected');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis client reconnecting...');
});

// Connect to Redis
const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    console.log('Redis connection established successfully.');
  } catch (error) {
    console.error('Unable to connect to Redis:', error);
    throw error;
  }
};

// Disconnect from Redis
const disconnectRedis = async () => {
  try {
    if (redisClient.isOpen) {
      await redisClient.disconnect();
    }
    console.log('Redis connection closed successfully.');
  } catch (error) {
    console.error('Error closing Redis connection:', error);
    throw error;
  }
};

// Redis utility functions
const redisUtils = {
  // Set key with expiration
  setEx: async (key, seconds, value) => {
    try {
      return await redisClient.setEx(key, seconds, JSON.stringify(value));
    } catch (error) {
      console.error('Redis setEx error:', error);
      throw error;
    }
  },

  // Get key
  get: async (key) => {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      throw error;
    }
  },

  // Delete key
  del: async (key) => {
    try {
      return await redisClient.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
      throw error;
    }
  },

  // Check if key exists
  exists: async (key) => {
    try {
      return await redisClient.exists(key);
    } catch (error) {
      console.error('Redis exists error:', error);
      throw error;
    }
  },

  // Set key without expiration
  set: async (key, value) => {
    try {
      return await redisClient.set(key, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
      throw error;
    }
  },

  // Get TTL of key
  ttl: async (key) => {
    try {
      return await redisClient.ttl(key);
    } catch (error) {
      console.error('Redis ttl error:', error);
      throw error;
    }
  },

  // Increment key
  incr: async (key) => {
    try {
      return await redisClient.incr(key);
    } catch (error) {
      console.error('Redis incr error:', error);
      throw error;
    }
  },

  // Get all keys matching pattern
  keys: async (pattern) => {
    try {
      return await redisClient.keys(pattern);
    } catch (error) {
      console.error('Redis keys error:', error);
      throw error;
    }
  }
};

// Extract utility functions from redisUtils object
const { setEx, get, del, exists, set, ttl, incr, keys } = redisUtils;

// Initialize Redis connection
connectRedis();

export {
  redisClient,
  connectRedis,
  disconnectRedis,
  setEx,
  get,
  del,
  exists,
  set,
  ttl,
  incr,
  keys
};