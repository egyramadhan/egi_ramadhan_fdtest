import { setEx, get, del, keys, exists, incr } from '../config/redis.js';

class CacheService {
  /**
   * Generate cache key with prefix
   * @param {string} prefix - Cache key prefix
   * @param {string} key - Cache key
   * @returns {string} - Full cache key
   */
  static generateKey(prefix, key) {
    return `${prefix}:${key}`;
  }

  /**
   * Set cache with expiration
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
   * @returns {Promise<string>} - Redis response
   */
  static async set(key, value, ttl = 300) {
    try {
      return await setEx(key, ttl, value);
    } catch (error) {
      console.error('Cache set error:', error);
      return null;
    }
  }

  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Cached value or null
   */
  static async get(key) {
    try {
      return await get(key);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Delete cached value
   * @param {string} key - Cache key
   * @returns {Promise<number>} - Number of keys deleted
   */
  static async delete(key) {
    try {
      return await del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
      return 0;
    }
  }

  /**
   * Delete multiple keys by pattern
   * @param {string} pattern - Key pattern
   * @returns {Promise<number>} - Number of keys deleted
   */
  static async deleteByPattern(pattern) {
    try {
      const keysToDelete = await keys(pattern);
      if (keysToDelete.length > 0) {
        return await del(keysToDelete);
      }
      return 0;
    } catch (error) {
      console.error('Cache delete by pattern error:', error);
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - True if exists
   */
  static async exists(key) {
    try {
      return await exists(key) === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Increment counter
   * @param {string} key - Cache key
   * @returns {Promise<number>} - New value
   */
  static async increment(key) {
    try {
      return await incr(key);
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  // Book-specific cache methods
  static async cacheBook(bookId, book, ttl = 600) {
    const key = this.generateKey('book', bookId);
    return await this.set(key, book, ttl);
  }

  static async getCachedBook(bookId) {
    const key = this.generateKey('book', bookId);
    return await this.get(key);
  }

  static async invalidateBook(bookId) {
    const key = this.generateKey('book', bookId);
    return await this.delete(key);
  }

  static async cacheBooksList(cacheKey, books, ttl = 300) {
    return await this.set(cacheKey, books, ttl);
  }

  static async getCachedBooksList(cacheKey) {
    return await this.get(cacheKey);
  }

  static async invalidateBooksCache() {
    return await this.deleteByPattern('books:*');
  }

  // User-specific cache methods
  static async cacheUser(userId, user, ttl = 600) {
    const key = this.generateKey('user', userId);
    return await this.set(key, user, ttl);
  }

  static async getCachedUser(userId) {
    const key = this.generateKey('user', userId);
    return await this.get(key);
  }

  static async invalidateUser(userId) {
    const key = this.generateKey('user', userId);
    return await this.delete(key);
  }

  static async invalidateUsersCache() {
    return await this.deleteByPattern('users:*');
  }

  // Session management
  static async setSession(sessionId, sessionData, ttl = 86400) { // 24 hours
    const key = this.generateKey('session', sessionId);
    return await this.set(key, sessionData, ttl);
  }

  static async getSession(sessionId) {
    const key = this.generateKey('session', sessionId);
    return await this.get(key);
  }

  static async deleteSession(sessionId) {
    const key = this.generateKey('session', sessionId);
    return await this.delete(key);
  }

  static async extendSession(sessionId, ttl = 86400) {
    const key = this.generateKey('session', sessionId);
    const sessionData = await this.get(key);
    if (sessionData) {
      return await this.set(key, sessionData, ttl);
    }
    return null;
  }

  // Statistics cache
  static async cacheStats(type, stats, ttl = 300) {
    const key = this.generateKey('stats', type);
    return await this.set(key, stats, ttl);
  }

  static async getCachedStats(type) {
    const key = this.generateKey('stats', type);
    return await this.get(key);
  }

  static async invalidateStats() {
    return await this.deleteByPattern('stats:*');
  }

  // Rate limiting helpers
  static async incrementRateLimit(identifier, window = 900) { // 15 minutes
    const key = this.generateKey('rate_limit', identifier);
    const count = await this.increment(key);
    
    // Set expiration only on first increment
    if (count === 1) {
      await setEx(key, window, count);
    }
    
    return count;
  }

  static async getRateLimit(identifier) {
    const key = this.generateKey('rate_limit', identifier);
    return await this.get(key) || 0;
  }

  // Cache warming methods
  static async warmCache() {
    console.log('🔥 Starting cache warming...');
    
    try {
      // Warm popular books cache
      // This would typically be based on analytics data
      console.log('✅ Cache warming completed');
    } catch (error) {
      console.error('❌ Cache warming failed:', error);
    }
  }

  // Cache health check
  static async healthCheck() {
    try {
      const testKey = 'health_check';
      const testValue = { timestamp: Date.now() };
      
      await this.set(testKey, testValue, 10);
      const retrieved = await this.get(testKey);
      await this.delete(testKey);
      
      return retrieved && retrieved.timestamp === testValue.timestamp;
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }
}

export default CacheService;