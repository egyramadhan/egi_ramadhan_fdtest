import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import UserService from '../services/userService.js';
import TokenService from '../services/tokenService.js';
import { authenticate, generateTokens, verifyRefreshToken, blacklistToken } from '../middleware/auth.js';
import { validate, authSchemas } from '../middleware/validation.js';
import { ValidationError, AuthenticationError, NotFoundError } from '../middleware/errorHandler.js';
import emailService from '../services/emailService.js';
import { redisClient } from '../config/redis.js';

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or user already exists
 */
router.post('/register', validate(authSchemas.register), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await UserService.findByEmail(email);
    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }

    // Create user
    const user = await UserService.createUser({
      name,
      email,
      password
    });

    // Generate email verification token
    const verificationToken = await TokenService.createEmailVerificationToken(user.id);

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user, verificationToken.token);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email sending fails
    }

    // Generate tokens
    const tokens = generateTokens(user.id);

    res.status(201).json({
      status: 201,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerifiedAt: user.emailVerifiedAt,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt
        },
        tokens
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', validate(authSchemas.login), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await UserService.findByEmail(email);
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await UserService.validatePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Update last login (optional)
    await UserService.updateLastLogin(user.id);

    res.json({
      status: 200,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerifiedAt: user.emailVerifiedAt,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt
        },
        tokens
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Valid refresh token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', validate(authSchemas.refresh), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Check if refresh token is blacklisted
    const isBlacklisted = await redis.exists(`blacklist:${refreshToken}`);
    if (isBlacklisted) {
      throw new AuthenticationError('Refresh token has been revoked');
    }

    // Find user
    const user = await UserService.findById(decoded.userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Blacklist old refresh token
    await blacklistToken(refreshToken, 'refresh');

    // Generate new tokens
    const tokens = generateTokens(user.id);

    res.json({
      status: 200,
      message: 'Token refreshed successfully',
      data: {
        tokens
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', authenticate, validate(authSchemas.logout), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    // Blacklist access token
    if (accessToken) {
      await blacklistToken(accessToken, 'access');
    }

    // Blacklist refresh token if provided
    if (refreshToken) {
      await blacklistToken(refreshToken, 'refresh');
    }

    res.json({
      status: 200,
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       404:
 *         description: User not found
 */
router.post('/forgot-password', validate(authSchemas.forgotPassword), async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await UserService.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.'
      });
    }

    // Generate password reset token
    const resetToken = await TokenService.createPasswordResetToken(user.id);

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(user, resetToken.token);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      throw new ValidationError('Failed to send password reset email');
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password', validate(authSchemas.resetPassword), async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Verify and use reset token
    const user = await TokenService.verifyPasswordResetToken(token);
    if (!user) {
      throw new ValidationError('Invalid or expired reset token');
    }

    // Update user password
    await UserService.updatePassword(user.id, password);

    // Blacklist all existing tokens for this user
    const tokenPattern = `auth_token:${user.id}:*`;
    const existingTokens = await redisClient.keys(tokenPattern);
    if (existingTokens.length > 0) {
      await redisClient.del(existingTokens);
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change password (authenticated)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password
 *       401:
 *         description: Unauthorized
 */
router.post('/change-password', authenticate, validate(authSchemas.changePassword), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Verify current password
    const isValidPassword = await UserService.validatePassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new ValidationError('Current password is incorrect');
    }

    // Update password
    await UserService.updatePassword(user.id, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verify email address
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/verify-email', validate(authSchemas.verifyEmail), async (req, res, next) => {
  try {
    const { token } = req.body;

    // Verify and use email verification token
    const user = await TokenService.verifyEmailVerificationToken(token);
    if (!user) {
      throw new ValidationError('Invalid or expired verification token');
    }

    // Mark email as verified
    const updatedUser = await UserService.markEmailAsVerified(user.id);

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(updatedUser);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Continue even if welcome email fails
    }

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          emailVerifiedAt: updatedUser.emailVerifiedAt,
          isAdmin: updatedUser.isAdmin
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend email verification
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 *       400:
 *         description: Email already verified
 *       401:
 *         description: Unauthorized
 */
router.post('/resend-verification', authenticate, async (req, res, next) => {
  try {
    const user = req.user;

    // Check if email is already verified
    if (user.emailVerifiedAt) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = await TokenService.createEmailVerificationToken(user.id);

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user, verificationToken.token);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      throw new ValidationError('Failed to send verification email');
    }

    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = req.user;

    res.json({
      status: 200,
      message: 'User profile retrieved successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerifiedAt: user.emailVerifiedAt,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;