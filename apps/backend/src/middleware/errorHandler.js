const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Prisma validation error
  if (err.name === 'PrismaClientValidationError') {
    return res.status(400).json({
      status: 400,
      message: 'Validation Error',
      details: {
        message: err.message
      }
    });
  }

  // Prisma unique constraint error
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field';
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    return res.status(409).json({
      status: 409,
      message: 'Conflict',
      details: {
        field,
        message
      }
    });
  }

  // Prisma foreign key constraint error
  if (err.code === 'P2003') {
    return res.status(400).json({
      status: 400,
      message: 'Invalid reference',
      details: {
        message: 'Referenced resource does not exist'
      }
    });
  }

  // Prisma record not found error
  if (err.code === 'P2025') {
    return res.status(404).json({
      status: 404,
      message: 'Not Found',
      details: {
        message: 'Record not found'
      }
    });
  }

  // Prisma database connection error
  if (err.name === 'PrismaClientInitializationError' || err.name === 'PrismaClientRustPanicError') {
    return res.status(503).json({
      status: 503,
      message: 'Service Unavailable',
      details: {
        message: 'Database connection error'
      }
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 401,
      message: 'Invalid token',
      details: {
        message: 'Please provide a valid authentication token'
      }
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 401,
      message: 'Token expired',
      details: {
        message: 'Authentication token has expired'
      }
    });
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      status: 400,
      message: 'File too large',
      details: {
        message: `File size exceeds the maximum limit of ${process.env.MAX_FILE_SIZE || '5MB'}`
      }
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      status: 400,
      message: 'Invalid file field',
      details: {
        message: 'Unexpected file field in upload'
      }
    });
  }

  // Custom application errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      status: err.statusCode,
      message: err.message,
      details: err.details || {}
    });
  }

  // Validation errors from request validation middleware
  if (err.type === 'validation') {
    return res.status(400).json({
      status: 400,
      message: 'Validation Error',
      details: {
        errors: err.errors
      }
    });
  }

  // Authentication errors
  if (err.type === 'authentication') {
    return res.status(401).json({
      status: 401,
      message: err.message || 'Authentication failed',
      details: err.details || {}
    });
  }

  // Authorization errors
  if (err.type === 'authorization') {
    return res.status(403).json({
      status: 403,
      message: err.message || 'Access denied',
      details: err.details || {}
    });
  }

  // Not found errors
  if (err.type === 'not_found') {
    return res.status(404).json({
      status: 404,
      message: err.message || 'Resource not found',
      details: err.details || {}
    });
  }

  // Rate limiting errors
  if (err.type === 'rate_limit') {
    return res.status(429).json({
      status: 429,
      message: 'Too many requests',
      details: {
        message: 'Rate limit exceeded, please try again later'
      }
    });
  }

  // Default server error
  res.status(500).json({
    status: 500,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    details: process.env.NODE_ENV === 'production' 
      ? {} 
      : {
          stack: err.stack,
          name: err.name
        }
  });
};

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.type = 'validation';
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', details = {}) {
    super(message, 401, details);
    this.type = 'authentication';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied', details = {}) {
    super(message, 403, details);
    this.type = 'authorization';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = {}) {
    super(message, 404, details);
    this.type = 'not_found';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = {}) {
    super(message, 409, details);
    this.type = 'conflict';
  }
}

export {
  errorHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError
};

export default errorHandler;