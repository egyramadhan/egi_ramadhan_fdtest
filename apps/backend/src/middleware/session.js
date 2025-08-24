import { v4 as uuidv4 } from 'uuid';
import CacheService from '../services/cacheService.js';
import { AuthenticationError } from './errorHandler.js';

/**
 * Session middleware for managing user sessions with Redis
 */
class SessionManager {
  /**
   * Create a new session
   * @param {Object} user - User object
   * @param {Object} req - Express request object
   * @returns {Promise<string>} - Session ID
   */
  static async createSession(user, req) {
    const sessionId = uuidv4();
    const sessionData = {
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      isAdmin: user.isAdmin,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || 'Unknown'
    };

    // Store session for 24 hours
    await CacheService.setSession(sessionId, sessionData, 86400);
    
    // Also store user ID to session mapping for quick lookups
    const userSessionKey = `user_sessions:${user.id}`;
    const existingSessions = await CacheService.get(userSessionKey) || [];
    existingSessions.push(sessionId);
    await CacheService.set(userSessionKey, existingSessions, 86400);

    return sessionId;
  }

  /**
   * Get session data
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} - Session data or null
   */
  static async getSession(sessionId) {
    return await CacheService.getSession(sessionId);
  }

  /**
   * Update session activity
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} - Success status
   */
  static async updateActivity(sessionId) {
    const sessionData = await CacheService.getSession(sessionId);
    if (sessionData) {
      sessionData.lastActivity = new Date().toISOString();
      await CacheService.setSession(sessionId, sessionData, 86400);
      return true;
    }
    return false;
  }

  /**
   * Destroy a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} - Success status
   */
  static async destroySession(sessionId) {
    const sessionData = await CacheService.getSession(sessionId);
    if (sessionData) {
      // Remove from user sessions list
      const userSessionKey = `user_sessions:${sessionData.userId}`;
      const existingSessions = await CacheService.get(userSessionKey) || [];
      const updatedSessions = existingSessions.filter(id => id !== sessionId);
      
      if (updatedSessions.length > 0) {
        await CacheService.set(userSessionKey, updatedSessions, 86400);
      } else {
        await CacheService.delete(userSessionKey);
      }
      
      // Delete the session
      await CacheService.deleteSession(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Destroy all sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of sessions destroyed
   */
  static async destroyUserSessions(userId) {
    const userSessionKey = `user_sessions:${userId}`;
    const existingSessions = await CacheService.get(userSessionKey) || [];
    
    let destroyedCount = 0;
    for (const sessionId of existingSessions) {
      const success = await CacheService.deleteSession(sessionId);
      if (success) destroyedCount++;
    }
    
    // Clear user sessions list
    await CacheService.delete(userSessionKey);
    
    return destroyedCount;
  }

  /**
   * Get all active sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of session data
   */
  static async getUserSessions(userId) {
    const userSessionKey = `user_sessions:${userId}`;
    const sessionIds = await CacheService.get(userSessionKey) || [];
    
    const sessions = [];
    for (const sessionId of sessionIds) {
      const sessionData = await CacheService.getSession(sessionId);
      if (sessionData) {
        sessions.push({
          sessionId,
          ...sessionData
        });
      }
    }
    
    return sessions;
  }

  /**
   * Clean expired sessions (called periodically)
   * @returns {Promise<number>} - Number of sessions cleaned
   */
  static async cleanExpiredSessions() {
    // This would typically be handled by Redis TTL, but we can implement
    // additional cleanup logic here if needed
    console.log('🧹 Cleaning expired sessions...');
    return 0;
  }
}

/**
 * Express middleware to handle sessions
 */
export const sessionMiddleware = async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;
    
    if (sessionId) {
      const sessionData = await SessionManager.getSession(sessionId);
      if (sessionData) {
        // Update last activity
        await SessionManager.updateActivity(sessionId);
        
        // Attach session data to request
        req.session = {
          id: sessionId,
          ...sessionData
        };
      }
    }
    
    // Add session helper methods to request
    req.createSession = async (user) => {
      const sessionId = await SessionManager.createSession(user, req);
      
      // Set session cookie
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      return sessionId;
    };
    
    req.destroySession = async () => {
      if (req.session?.id) {
        await SessionManager.destroySession(req.session.id);
        res.clearCookie('sessionId');
        req.session = null;
      }
    };
    
    next();
  } catch (error) {
    console.error('Session middleware error:', error);
    next();
  }
};

/**
 * Middleware to require active session
 */
export const requireSession = (req, res, next) => {
  if (!req.session) {
    throw new AuthenticationError('Active session required');
  }
  next();
};

export default SessionManager;