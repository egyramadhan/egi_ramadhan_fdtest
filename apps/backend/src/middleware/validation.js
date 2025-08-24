import { z } from 'zod';
import { ValidationError } from './errorHandler.js';

/**
 * Middleware factory to validate request data using Zod schemas
 * @param {Object} schemas - Object containing schemas for body, params, query
 * @param {z.ZodSchema} schemas.body - Schema for request body
 * @param {z.ZodSchema} schemas.params - Schema for request params
 * @param {z.ZodSchema} schemas.query - Schema for request query
 */
const validate = (schemas) => {
  return (req, res, next) => {
    const errors = [];
    
    try {
      // Validate request body
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
          errors.push(...result.error.errors.map(err => ({
            field: `body.${err.path.join('.')}`,
            message: err.message,
            value: err.input
          })));
        } else {
          req.body = result.data;
        }
      }
      
      // Validate request params
      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
          errors.push(...result.error.errors.map(err => ({
            field: `params.${err.path.join('.')}`,
            message: err.message,
            value: err.input
          })));
        } else {
          req.params = result.data;
        }
      }
      
      // Validate request query
      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
          errors.push(...result.error.errors.map(err => ({
            field: `query.${err.path.join('.')}`,
            message: err.message,
            value: err.input
          })));
        } else {
          req.query = result.data;
        }
      }
      
      if (errors.length > 0) {
        throw new ValidationError('Validation failed', errors);
      }
      
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        next(error);
      } else {
        next(new ValidationError('Validation error', [{
          field: 'unknown',
          message: error.message
        }]));
      }
    }
  };
};

// Common validation schemas
const commonSchemas = {
  // ID parameter validation
  idParam: z.object({
    id: z.string().min(1, 'ID is required')
  }),
  
  // Pagination query validation
  pagination: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default(10)
  }).refine(data => data.page >= 1, {
    message: 'Page must be at least 1',
    path: ['page']
  }).refine(data => data.limit >= 1 && data.limit <= 100, {
    message: 'Limit must be between 1 and 100',
    path: ['limit']
  }),
  
  // Email validation
  email: z.string().email('Invalid email format').toLowerCase(),
  
  // Password validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  // Name validation
  name: z.string()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name must be at most 100 characters long')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  
  // Rating validation
  rating: z.number().int().min(1).max(5),
  
  // URL validation
  url: z.string().url('Invalid URL format').optional()
};

// Auth validation schemas
const authSchemas = {
  register: {
    body: z.object({
      name: commonSchemas.name,
      email: commonSchemas.email,
      password: commonSchemas.password
    })
  },
  
  login: {
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(1, 'Password is required')
    })
  },
  
  refresh: {
    body: z.object({
      refreshToken: z.string().min(1, 'Refresh token is required')
    })
  },
  
  logout: {
    body: z.object({
      refreshToken: z.string().min(1, 'Refresh token is required')
    })
  },
  
  forgotPassword: {
    body: z.object({
      email: commonSchemas.email
    })
  },
  
  resetPassword: {
    body: z.object({
      token: z.string().min(1, 'Reset token is required'),
      newPassword: commonSchemas.password
    })
  },
  
  changePassword: {
    body: z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: commonSchemas.password
    })
  },
  
  verifyEmail: {
    body: z.object({
      token: z.string().min(1, 'Verification token is required')
    })
  }
};

// User validation schemas
const userSchemas = {
  getUsers: {
    query: z.object({
      page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
      limit: z.string().regex(/^\d+$/).transform(Number).optional().default(10),
      q: z.string().optional(),
      verified: z.string().transform(val => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return undefined;
      }).optional()
    }).refine(data => data.page >= 1, {
      message: 'Page must be at least 1',
      path: ['page']
    }).refine(data => data.limit >= 1 && data.limit <= 100, {
      message: 'Limit must be between 1 and 100',
      path: ['limit']
    })
  }
};

// Book validation schemas
const bookSchemas = {
  getBooks: {
    query: z.object({
      page: z.string().regex(/^\d+$/).optional(),
      limit: z.string().regex(/^\d+$/).optional(),
      search: z.string().optional(),
      author: z.string().optional(),
      minRating: z.string().regex(/^[1-5]$/).optional(),
      maxRating: z.string().regex(/^[1-5]$/).optional(),
      sortBy: z.enum(['title', 'author', 'rating', 'createdAt']).optional(),
      sortOrder: z.enum(['asc', 'desc']).optional()
    }).transform(data => ({
      page: data.page ? Number(data.page) : 1,
      limit: data.limit ? Number(data.limit) : 10,
      search: data.search,
      author: data.author,
      minRating: data.minRating ? Number(data.minRating) : undefined,
      maxRating: data.maxRating ? Number(data.maxRating) : undefined,
      sortBy: data.sortBy || 'createdAt',
      sortOrder: data.sortOrder || 'desc'
    })).refine(data => data.page >= 1, {
      message: 'Page must be at least 1',
      path: ['page']
    }).refine(data => data.limit >= 1 && data.limit <= 100, {
      message: 'Limit must be between 1 and 100',
      path: ['limit']
    })
  },
  
  getBook: {
    params: commonSchemas.idParam
  },
  
  createBook: {
    body: z.object({
      title: z.string()('Title is required').max(255, 'Title must be at most 255 characters'),
      author: z.string()('Author is required').max(255, 'Author must be at most 255 characters'),
      description: z.string()('Description must be at least 10 characters').max(5000, 'Description must be at most 5000 characters'),
      rating: z.string().regex(/^[1-5]$/, 'Rating must be between 1 and 5').transform(Number).optional(),
      thumbnailUrl: commonSchemas.url.optional()
    })
  },
  
  updateBook: {
    params: commonSchemas.idParam,
    body: z.object({
      title: z.string().max(255).optional(),
      author: z.string().max(255).optional(),
      description: z.string().max(5000).optional(),
      rating: z.string().regex(/^[1-5]$/, 'Rating must be between 1 and 5').transform(Number).optional(),
      thumbnailUrl: commonSchemas.url.optional()
    })
  },
  
  deleteBook: {
    params: commonSchemas.idParam
  }
};

// File upload validation
const validateFileUpload = (allowedTypes = ['image/jpeg', 'image/png', 'image/gif'], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file) {
      return next();
    }
    
    const errors = [];
    
    // Check file type
    if (!allowedTypes.includes(req.file.mimetype)) {
      errors.push({
        field: 'file',
        message: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        value: req.file.mimetype
      });
    }
    
    // Check file size
    if (req.file.size > maxSize) {
      errors.push({
        field: 'file',
        message: `File size too large. Maximum size: ${maxSize / (1024 * 1024)}MB`,
        value: `${(req.file.size / (1024 * 1024)).toFixed(2)}MB`
      });
    }
    
    if (errors.length > 0) {
      return next(new ValidationError('File validation failed', errors));
    }
    
    next();
  };
};

export {
  validate,
  commonSchemas,
  authSchemas,
  userSchemas,
  bookSchemas,
  validateFileUpload
};