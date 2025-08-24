import express from 'express';
import UserService from '../services/userService.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate, userSchemas, commonSchemas } from '../middleware/validation.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../middleware/errorHandler.js';
import { redisClient, setEx, get, del, keys } from '../config/redis.js';

const router = express.Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of users per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *       - in: query
 *         name: isAdmin
 *         schema:
 *           type: boolean
 *         description: Filter by admin status
 *       - in: query
 *         name: emailVerified
 *         schema:
 *           type: boolean
 *         description: Filter by email verification status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, email, createdAt, updatedAt]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/', authenticate, requireAdmin, validate(userSchemas.getUsers), async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      isAdmin,
      emailVerified,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Get users with pagination and filters
    const result = await UserService.getUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      isAdmin: typeof isAdmin === 'boolean' ? isAdmin : undefined,
      emailVerified: typeof emailVerified === 'boolean' ? emailVerified : undefined,
      sortBy,
      sortOrder
    });

    res.json({
      status: 200,
      message: 'Users retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Users can only get their own profile, admins can get any user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden - can only access own profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', authenticate, validate(commonSchemas.idParam), async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if user can access this profile (own profile or admin)
    if (currentUser.id !== id && !currentUser.isAdmin) {
      throw new AuthorizationError('You can only access your own profile');
    }

    // Find user
    const user = await UserService.findById(id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      status: 200,
      message: 'User retrieved successfully',
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               email:
 *                 type: string
 *                 format: email
 *               isAdmin:
 *                 type: boolean
 *                 description: Only admins can modify this field
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.put('/:id', authenticate, validate(commonSchemas.idParam), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, isAdmin } = req.body;
    const currentUser = req.user;

    // Check if user can update this profile (own profile or admin)
    if (currentUser.id !== id && !currentUser.isAdmin) {
      throw new AuthorizationError('You can only update your own profile');
    }

    // Prepare update data
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (email !== undefined) {
      updateData.email = email;
    }

    // Only admins can modify isAdmin field
    if (isAdmin !== undefined) {
      if (!currentUser.isAdmin) {
        throw new AuthorizationError('Only admins can modify admin status');
      }
      updateData.isAdmin = isAdmin;
    }

    // Update user
    const updatedUser = await UserService.updateUser(id, updateData);

    res.json({
      status: 200,
      message: 'User updated successfully',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User not found
 */
router.delete('/:id', authenticate, requireAdmin, validate(commonSchemas.idParam), async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Prevent admin from deleting themselves
    if (currentUser.id === id) {
      throw new ValidationError('You cannot delete your own account');
    }

    // Delete user
    await UserService.deleteUser(id);

    // Clean up any cached data for this user
    const userCacheKeys = await keys(`user:${id}:*`);
    if (userCacheKeys.length > 0) {
      await del(...userCacheKeys);
    }

    res.json({
      status: 200,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/{id}/toggle-admin:
 *   patch:
 *     summary: Toggle user admin status (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: Admin status toggled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User not found
 */
router.patch('/:id/toggle-admin', authenticate, requireAdmin, validate(commonSchemas.idParam), async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Prevent admin from removing their own admin status
    if (currentUser.id === id) {
      throw new ValidationError('You cannot modify your own admin status');
    }

    // Find user
    const user = await UserService.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Toggle admin status
    const updatedUser = await UserService.updateUser(id, { isAdmin: !user.isAdmin });

    res.json({
      status: 200,
      message: `User ${updatedUser.isAdmin ? 'promoted to' : 'demoted from'} admin successfully`,
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Get user statistics (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/stats', authenticate, requireAdmin, async (req, res, next) => {
  try {
    // Check cache first
    const cacheKey = 'user:stats';
    const cachedStats = await get(cacheKey);
    
    if (cachedStats) {
      return res.json({
        status: 200,
        message: 'User statistics retrieved successfully',
        data: JSON.parse(cachedStats)
      });
    }

    // Get statistics from service
    const stats = await UserService.getUserStats();

    // Cache for 5 minutes
    await setEx(cacheKey, 300, JSON.stringify(stats));

    res.json({
      status: 200,
      message: 'User statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

export default router;