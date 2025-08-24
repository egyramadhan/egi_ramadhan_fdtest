import multer from 'multer';
import path from 'path';
import fs, { promises as fsPromises } from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create subdirectory based on file type
    const subDir = path.join(uploadDir, 'thumbnails');
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
    cb(null, subDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    // Allowed image types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
    }
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: 1 // Only allow one file at a time
  }
});

// Middleware for single file upload
const uploadSingle = (fieldName = 'thumbnail') => {
  return (req, res, next) => {
    const uploadMiddleware = upload.single(fieldName);
    
    uploadMiddleware(req, res, (err) => {
      if (err) {
        // Handle multer errors
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              status: 400,
              message: 'File too large',
              details: {
                message: `File size exceeds the maximum limit of ${(parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024) / (1024 * 1024)}MB`
              }
            });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
              status: 400,
              message: 'Unexpected file field',
              details: {
                message: `Expected file field: ${fieldName}`
              }
            });
          }
        }
        
        return res.status(400).json({
          status: 400,
          message: 'File upload error',
          details: {
            message: err.message
          }
        });
      }
      
      // If file was uploaded, add the file URL to request body
      if (req.file) {
        const fileUrl = `/uploads/thumbnails/${req.file.filename}`;
        req.body.thumbnailUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}${fileUrl}`;
      }
      
      next();
    });
  };
};

// Middleware for multiple file upload
const uploadMultiple = (fieldName = 'files', maxCount = 5) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.array(fieldName, maxCount);
    
    uploadMiddleware(req, res, (err) => {
      if (err) {
        // Handle multer errors
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              status: 400,
              message: 'File too large',
              details: {
                message: `File size exceeds the maximum limit of ${(parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024) / (1024 * 1024)}MB`
              }
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              status: 400,
              message: 'Too many files',
              details: {
                message: `Maximum ${maxCount} files allowed`
              }
            });
          }
        }
        
        return res.status(400).json({
          status: 400,
          message: 'File upload error',
          details: {
            message: err.message
          }
        });
      }
      
      // If files were uploaded, add the file URLs to request body
      if (req.files && req.files.length > 0) {
        req.body.fileUrls = req.files.map(file => {
          const fileUrl = `/uploads/thumbnails/${file.filename}`;
          return `${process.env.BACKEND_URL || 'http://localhost:5000'}${fileUrl}`;
        });
      }
      
      next();
    });
  };
};

// Utility function to delete uploaded file
const deleteFile = async (filePath) => {
  try {
    // Extract filename from URL if it's a full URL
    let filename = filePath;
    if (filePath.includes('/uploads/')) {
      filename = filePath.split('/uploads/')[1];
    }
    
    const fullPath = path.join(uploadDir, filename);
    
    await fsPromises.unlink(fullPath);
    console.log('File deleted successfully:', fullPath);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// Utility function to check if file exists
const fileExists = async (filePath) => {
  try {
    let filename = filePath;
    if (filePath.includes('/uploads/')) {
      filename = filePath.split('/uploads/')[1];
    }
    
    const fullPath = path.join(uploadDir, filename);
    await fsPromises.access(fullPath);
    return true;
  } catch {
    return false;
  }
};

// Cleanup old files (can be used in a cron job)
const cleanupOldFiles = async (daysOld = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const thumbnailsDir = path.join(uploadDir, 'thumbnails');
    
    if (!fs.existsSync(thumbnailsDir)) {
      return;
    }
    
    const files = await fsPromises.readdir(thumbnailsDir);
    
    for (const file of files) {
      const filePath = path.join(thumbnailsDir, file);
      
      try {
        const stats = await fsPromises.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fsPromises.unlink(filePath);
          console.log('Deleted old file:', file);
        }
      } catch (err) {
        console.error('Error processing file:', file, err);
      }
    }
  } catch (error) {
    console.error('Error cleaning up old files:', error);
  }
};

export {
  upload,
  uploadSingle,
  uploadMultiple,
  deleteFile,
  fileExists,
  cleanupOldFiles
};