import bcrypt from 'bcrypt';
import { prisma } from '../config/database.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import CacheService from './cacheService.js';

class UserService {
  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  static async hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Validate password against hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} - True if password is valid
   */
  static async validatePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} - Created user
   */
  static async createUser(userData) {
    const { name, email, password, isAdmin = false } = userData;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        isAdmin
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return user;
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} - User or null
   */
  static async findByEmail(email) {
    return await prisma.user.findUnique({
      where: { email },
      include: {
        books: {
          select: {
            id: true,
            title: true,
            author: true,
            rating: true,
            createdAt: true
          }
        }
      }
    });
  }

  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object|null>} - User or null
   */
  static async findById(id) {
    const userId = parseInt(id);
    
    // Try to get from cache first
    const cachedUser = await CacheService.getCachedUser(userId);
    if (cachedUser) {
      return cachedUser;
    }
    
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
        isAdmin: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (user) {
      // Cache the user for 10 minutes
      await CacheService.cacheUser(userId, user, 600);
    }

    return user;
  }

  /**
   * Find user by ID with password hash (for authentication)
   * @param {string} id - User ID
   * @returns {Promise<Object|null>} - User with password hash or null
   */
  static async findByIdWithPassword(id) {
    return await prisma.user.findUnique({
      where: { id }
    });
  }

  /**
   * Get users with pagination and filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Users with pagination info
   */
  static async getUsers(options = {}) {
    const {
      page = 1,
      limit = 10,
      search,
      isAdmin,
      emailVerified,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Build where clause
    const where = {};

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Admin filter
    if (typeof isAdmin === 'boolean') {
      where.isAdmin = isAdmin;
    }

    // Email verification filter
    if (typeof emailVerified === 'boolean') {
      if (emailVerified) {
        where.emailVerifiedAt = { not: null };
      } else {
        where.emailVerifiedAt = null;
      }
    }

    // Calculate skip
    const skip = (page - 1) * limit;

    // Get users and count
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerifiedAt: true,
          isAdmin: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              books: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      users: users.map(user => ({
        ...user,
        booksCount: user._count.books
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage
      }
    };
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} - Updated user
   */
  static async updateUser(id, updateData) {
    const { name, email, password, isAdmin } = updateData;

    // Check if user exists
    const existingUser = await this.findById(id);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Prepare update data
    const data = {};

    if (name !== undefined) {
      data.name = name;
    }

    if (email !== undefined) {
      // Check if email is already taken by another user
      const emailTaken = await prisma.user.findFirst({
        where: {
          email,
          id: { not: id }
        }
      });

      if (emailTaken) {
        throw new ConflictError('Email is already taken by another user');
      }

      data.email = email;
      // Reset email verification if email is changed
      if (email !== existingUser.email) {
        data.emailVerifiedAt = null;
      }
    }

    if (password !== undefined) {
      data.passwordHash = await this.hashPassword(password);
    }

    if (isAdmin !== undefined) {
      data.isAdmin = isAdmin;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    // Invalidate user cache and users list cache
    await CacheService.invalidateUser(parseInt(id));
    await CacheService.invalidateUsersCache();
    await CacheService.invalidateStats();

    return updatedUser;
  }

  /**
   * Delete user
   * @param {string} id - User ID
   * @returns {Promise<void>}
   */
  static async deleteUser(id) {
    // Check if user exists
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id }
    });
    
    // Invalidate user cache and users list cache
    await CacheService.invalidateUser(parseInt(id));
    await CacheService.invalidateUsersCache();
    await CacheService.invalidateStats();
  }

  /**
   * Mark email as verified
   * @param {string} id - User ID
   * @returns {Promise<Object>} - Updated user
   */
  static async markEmailAsVerified(id) {
    return await prisma.user.update({
      where: { id },
      data: {
        emailVerifiedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  /**
   * Update last login time
   * @param {string} id - User ID
   * @returns {Promise<void>}
   */
  static async updateLastLogin(id) {
    await prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date()
      }
    });
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} - User statistics
   */
  static async getUserStats() {
    // Try to get from cache first
    const cachedStats = await CacheService.getCachedStats('users');
    if (cachedStats) {
      return cachedStats;
    }
    
    const [totalUsers, verifiedUsers, adminUsers, recentUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          emailVerifiedAt: { not: null }
        }
      }),
      prisma.user.count({
        where: {
          isAdmin: true
        }
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      })
    ]);

    const stats = {
      totalUsers,
      verifiedUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
      adminUsers,
      regularUsers: totalUsers - adminUsers,
      recentUsers,
      verificationRate: totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(2) : 0
    };
    
    // Cache stats for 10 minutes
    await CacheService.cacheStats('users', stats, 600);

    return stats;
  }
}

export default UserService;