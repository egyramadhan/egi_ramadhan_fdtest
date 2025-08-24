import express from 'express';
import BookService from '../services/bookService.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate, bookSchemas, commonSchemas } from '../middleware/validation.js';
import { upload, uploadSingle } from '../middleware/upload.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../middleware/errorHandler.js';
import { redisClient, setEx, get, del } from '../config/redis.js';

const router = express.Router();

/**
 * @swagger
 * /api/books:
 *   get:
 *     tags: [Books]
 *     summary: Get books list with pagination and filters
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *       - in: query
 *         name: maxRating
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [title, author, rating, createdAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Books retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      author,
      minRating,
      maxRating,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Get books with pagination and filters
    const result = await BookService.getBooks({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      author,
      minRating: minRating ? parseFloat(minRating) : undefined,
      maxRating: maxRating ? parseFloat(maxRating) : undefined,
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      message: 'Books retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/books:
 *   post:
 *     tags: [Books]
 *     summary: Create a new book
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - author
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *               author:
 *                 type: string
 *               description:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Book created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
/**
 * @swagger
 * /api/books:
 *   post:
 *     summary: Create a new book
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - author
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               author:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: Book thumbnail image
 *     responses:
 *       201:
 *         description: Book created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Book'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/',
  authenticate,
  uploadSingle('thumbnail'),
  validate(bookSchemas.createBook),
  async (req, res, next) => {
    try {
      const { title, author, description, rating } = req.body;
      const thumbnailUrl = req.file ? `/uploads/${req.file.filename}` : null;

      const book = await BookService.createBook({
        title,
        author,
        description,
        rating,
        thumbnailUrl
      }, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Book created successfully',
        data: { book }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/books/{id}:
 *   get:
 *     summary: Get a book by ID
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Book ID
 *     responses:
 *       200:
 *         description: Book found
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Book'
 *       404:
 *         description: Book not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', validate(bookSchemas.getBook), async (req, res, next) => {
  try {
    const { id } = req.params;

    const book = await BookService.getBookById(id);
    if (!book) {
      throw new NotFoundError('Book not found');
    }

    res.json({
      success: true,
      message: 'Book retrieved successfully',
      data: { book }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/books/{id}:
 *   patch:
 *     tags: [Books]
 *     summary: Update book
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               author:
 *                 type: string
 *               description:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Book updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not authorized to update this book
 *       404:
 *         description: Book not found
 */
router.patch('/:id',
  authenticate,
  uploadSingle('thumbnail'),
  validate(bookSchemas.updateBook),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { title, author, description, rating } = req.body;
      const thumbnailUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (author !== undefined) updateData.author = author;
      if (description !== undefined) updateData.description = description;
      if (rating !== undefined) updateData.rating = rating ? parseFloat(rating) : null;
      if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;

      const updatedBook = await BookService.updateBook(
        id,
        updateData,
        req.user.id,
        req.user.isAdmin
      );

      // Clear cache
      await del('book_stats');

      res.json({
        success: true,
        message: 'Book updated successfully',
        data: { book: updatedBook }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/books/{id}:
 *   delete:
 *     tags: [Books]
 *     summary: Delete book
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Book deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not authorized to delete this book
 *       404:
 *         description: Book not found
 */
router.delete('/:id',
  authenticate,
  validate(bookSchemas.deleteBook),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      await BookService.deleteBook(id, req.user.id, req.user.isAdmin);

      // Clear cache
      await del('book_stats');

      res.json({
        success: true,
        message: 'Book deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/books/user/{userId}:
 *   get:
 *     tags: [Books]
 *     summary: Get books by user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: User books retrieved successfully
 *       404:
 *         description: User not found
 */
router.get('/user/:userId', validate(commonSchemas.idParam), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await BookService.getBooksByUser(userId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      message: 'User books retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/books/search:
 *   get:
 *     tags: [Books]
 *     summary: Search books
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *       400:
 *         description: Search query is required
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query) {
      throw new ValidationError('Search query is required');
    }

    const books = await BookService.searchBooks(query, {
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      message: 'Search results retrieved successfully',
      data: { books }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/books/stats:
 *   get:
 *     tags: [Books]
 *     summary: Get book statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Book statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/stats', authenticate, requireAdmin, async (req, res, next) => {
  try {
    // Check cache first
    const cacheKey = 'book_stats';
    const cachedStats = await get(cacheKey);
    
    if (cachedStats) {
      return res.json({
        success: true,
        message: 'Book statistics retrieved successfully',
        data: JSON.parse(cachedStats)
      });
    }

    // Get statistics from service
    const stats = await BookService.getBookStats();

    // Cache for 5 minutes
    await setEx(cacheKey, 300, JSON.stringify(stats));

    res.json({
      success: true,
      message: 'Book statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

export default router;