import { prisma } from '../config/database.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../middleware/errorHandler.js';
import { deleteFile } from '../middleware/upload.js';
import CacheService from './cacheService.js';

class BookService {
  /**
   * Create a new book
   * @param {Object} bookData - Book data
   * @param {string} userId - ID of the user creating the book
   * @returns {Promise<Object>} - Created book
   */
  static async createBook(bookData, userId) {
    const { title, author, description, thumbnailUrl, rating } = bookData;

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      throw new ValidationError('Rating must be between 1 and 5');
    }

    const book = await prisma.book.create({
      data: {
        title,
        author,
        description,
        rating: rating ? parseFloat(rating) : null,
        thumbnailUrl,
        createdBy: userId
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    // Invalidate books list cache and stats cache
    await CacheService.invalidateBooksCache();
    await CacheService.invalidateStats();

    return book;
  }

  /**
   * Get books with pagination and filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Books with pagination info
   */
  static async getBooks(options = {}) {
    const {
      page = 1,
      limit = 10,
      search,
      author,
      minRating,
      maxRating,
      createdBy,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Generate cache key based on parameters
    const cacheKey = `books:list:${page}:${limit}:${search || ''}:${author || ''}:${minRating || ''}:${maxRating || ''}:${createdBy || ''}:${sortBy}:${sortOrder}`;
    
    // Try to get from cache first
    const cachedResult = await CacheService.getCachedBooksList(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Build where clause
    const where = {};

    // Search filter (title or author)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Author filter
    if (author) {
      where.author = { contains: author, mode: 'insensitive' };
    }

    // Rating filters
    if (minRating !== undefined || maxRating !== undefined) {
      where.rating = {};
      if (minRating !== undefined) {
        where.rating.gte = parseFloat(minRating);
      }
      if (maxRating !== undefined) {
        where.rating.lte = parseFloat(maxRating);
      }
    }

    // Created by filter
    if (createdBy) {
      where.createdBy = createdBy;
    }

    // Calculate skip
    const skip = (page - 1) * limit;

    // Get books and count
    const [books, totalCount] = await Promise.all([
      prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.book.count({ where })
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const result = {
      books,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage
      }
    };
    
    // Cache the result for 5 minutes
    await CacheService.cacheBooksList(cacheKey, result, 300);
    
    return result;
  }

  /**
   * Get book by ID
   * @param {string} id - Book ID
   * @returns {Promise<Object|null>} - Book or null
   */
  static async getBookById(id) {
    // Try to get from cache first
    const cachedBook = await CacheService.getCachedBook(id);
    if (cachedBook) {
      return cachedBook;
    }
    
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    if (book) {
      // Cache the book for 10 minutes
      await CacheService.cacheBook(id, book, 600);
    }

    return book;
  }

  /**
   * Update book
   * @param {string} id - Book ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - ID of the user updating the book
   * @param {boolean} isAdmin - Whether the user is an admin
   * @returns {Promise<Object>} - Updated book
   */
  static async updateBook(id, updateData, userId, isAdmin = false) {
    const { title, author, description, thumbnailUrl, rating } = updateData;

    // Check if book exists
    const existingBook = await this.getBookById(id);
    if (!existingBook) {
      throw new NotFoundError('Book not found');
    }

    // Check permissions (owner or admin)
    if (!isAdmin && existingBook.createdBy !== userId) {
      throw new AuthorizationError('You can only edit your own books');
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      throw new ValidationError('Rating must be between 1 and 5');
    }

    // Prepare update data
    const data = {};

    if (title !== undefined) data.title = title;
    if (author !== undefined) data.author = author;
    if (description !== undefined) data.description = description;
    if (thumbnailUrl !== undefined) {
      // Delete old thumbnail if it exists and is different
      if (existingBook.thumbnailUrl && existingBook.thumbnailUrl !== thumbnailUrl) {
        try {
          await deleteFile(existingBook.thumbnailUrl);
        } catch (error) {
          console.error('Failed to delete old thumbnail:', error);
        }
      }
      data.thumbnailUrl = thumbnailUrl;
    }
    if (rating !== undefined) data.rating = rating ? parseFloat(rating) : null;

    // Update book
    const updatedBook = await prisma.book.update({
      where: { id: id },
      data: data,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    // Invalidate caches
    await CacheService.invalidateBook(id);
    await CacheService.invalidateBooksCache();
    await CacheService.invalidateStats();

    return updatedBook;
  }

  /**
   * Delete book
   * @param {string} id - Book ID
   * @param {string} userId - ID of the user deleting the book
   * @param {boolean} isAdmin - Whether the user is an admin
   * @returns {Promise<void>}
   */
  static async deleteBook(id, userId, isAdmin = false) {
    // Check if book exists
    const book = await this.getBookById(id);
    if (!book) {
      throw new NotFoundError('Book not found');
    }

    // Check permissions (owner or admin)
    if (!isAdmin && book.createdBy !== userId) {
      throw new AuthorizationError('You can only delete your own books');
    }

    // Delete thumbnail file if it exists
    if (book.thumbnailUrl) {
      try {
        await deleteFile(book.thumbnailUrl);
      } catch (error) {
        console.error('Failed to delete thumbnail file:', error);
      }
    }

    // Delete book
    await prisma.book.delete({
      where: { id }
    });
    
    // Invalidate caches
    await CacheService.invalidateBook(id);
    await CacheService.invalidateBooksCache();
    await CacheService.invalidateStats();
  }

  /**
   * Get books by user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - User's books with pagination
   */
  static async getBooksByUser(userId, options = {}) {
    return await this.getBooks({
      ...options,
      createdBy: userId
    });
  }

  /**
   * Get book statistics
   * @returns {Promise<Object>} - Book statistics
   */
  static async getBookStats() {
    // Try to get from cache first
    const cachedStats = await CacheService.getCachedStats('books');
    if (cachedStats) {
      return cachedStats;
    }
    
    const [totalBooks, booksWithRating, avgRating, recentBooks] = await Promise.all([
      prisma.book.count(),
      prisma.book.count({
        where: {
          rating: { not: null }
        }
      }),
      prisma.book.aggregate({
        _avg: {
          rating: true
        },
        where: {
          rating: { not: null }
        }
      }),
      prisma.book.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      })
    ]);

    // Get top authors
    const topAuthors = await prisma.book.groupBy({
      by: ['author'],
      _count: {
        author: true
      },
      orderBy: {
        _count: {
          author: 'desc'
        }
      },
      take: 5
    });

    const stats = {
      totalBooks,
      booksWithRating,
      booksWithoutRating: totalBooks - booksWithRating,
      averageRating: avgRating._avg.rating ? parseFloat(avgRating._avg.rating.toFixed(2)) : 0,
      recentBooks,
      topAuthors: topAuthors.map(author => ({
        name: author.author,
        bookCount: author._count.author
      }))
    };
    
    // Cache stats for 10 minutes
    await CacheService.cacheStats('books', stats, 600);

    return stats;
  }

  /**
   * Search books by title or author
   * @param {string} query - Search query
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} - Matching books
   */
  static async searchBooks(query, options = {}) {
    const { limit = 10 } = options;

    return await prisma.book.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { author: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: limit,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  }
}

export default BookService;