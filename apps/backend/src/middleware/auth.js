import jwt from 'jsonwebtoken';
import { redisClient, setEx, get, del } from '../config/redis.js';
import { AuthenticationError, AuthorizationError } from './errorHandler.js';
import UserService from '../services/userService.js';

/**
 * Middleware to authenticate JWT tokens
 * Expects token in Authorization header as 'Bearer <token>'
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Access token required');
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw new AuthenticationError('Access token required');
    }
    
    // Check if token is blacklisted
    const isBlacklisted = await get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new AuthenticationError('Token has been revoked');
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by ID
    const user = await UserService.findById(decoded.userId);
    
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    
    // Attach user to request object
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AuthenticationError('Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Token expired'));
    }
    next(error);
  }
};

/**
 * Middleware to check if user is an admin
 * Must be used after authenticate middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }
  
  if (!req.user.isAdmin) {
    return next(new AuthorizationError('Admin access required'));
  }
  
  next();
};

/**
 * Middleware to check if user's email is verified
 * Must be used after authenticate middleware
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }
  
  if (!req.user.emailVerifiedAt) {
    return next(new AuthorizationError('Email verification required', {
      message: 'Please verify your email address to access this resource'
    }));
  }
  
  next();
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is provided and valid, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token provided, continue without authentication
    }
    
    const token = authHeader.substring(7);
    
    if (!token) {
      return next(); // No token provided, continue without authentication
    }
    
    // Check if token is blacklisted
    const isBlacklisted = await get(`blacklist:${token}`);
    if (isBlacklisted) {
      return next(); // Token is blacklisted, continue without authentication
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by ID
    const user = await UserService.findById(decoded.userId);
    
    if (user) {
      req.user = user;
      req.token = token;
    }
    
    next();
  } catch (error) {
    // If there's an error with the token, just continue without authentication
    next();
  }
};

/**
 * Middleware to check if the authenticated user owns the resource
 * Expects the resource ID to be in req.params.id and the resource to have a 'createdBy' field
 */
const requireOwnership = (Model) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AuthenticationError('Authentication required'));
      }
      
      const resourceId = req.params.id;
      if (!resourceId) {
        return next(new Error('Resource ID not provided'));
      }
      
      const resource = await Model.findByPk(resourceId);
      if (!resource) {
        return next(new NotFoundError('Resource not found'));
      }
      
      // Check if user owns the resource or is an admin
      if (resource.createdBy !== req.user.id && !req.user.isAdmin) {
        return next(new AuthorizationError('Access denied', {
          message: 'You can only access your own resources'
        }));
      }
      
      // Attach resource to request for use in route handler
      req.resource = resource;
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Utility function to generate JWT tokens
 */
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  
  return { accessToken, refreshToken };
};

/**
 * Utility function to verify refresh tokens
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

/**
 * Utility function to blacklist a token
 */
const blacklistToken = async (token) => {
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await setEx(`blacklist:${token}`, ttl, true);
      }
    }
  } catch (error) {
    console.error('Error blacklisting token:', error);
  }
};

export {
  authenticate,
  requireAdmin,
  requireEmailVerification,
  optionalAuth,
  requireOwnership,
  generateTokens,
  verifyRefreshToken,
  blacklistToken
};