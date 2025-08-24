import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

class TokenService {
  /**
   * Generate a secure random token
   * @param {number} length - Token length in bytes (default: 32)
   * @returns {string} - Generated token
   */
  static generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Create email verification token
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Created token
   */
  static async createEmailVerificationToken(userId) {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Delete any existing email verification tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        userId,
        type: 'EMAIL_VERIFICATION'
      }
    });

    // Create new token
    const verificationToken = await prisma.verificationToken.create({
      data: {
        userId,
        token,
        type: 'EMAIL_VERIFICATION',
        expiresAt
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return verificationToken;
  }

  /**
   * Create password reset token
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Created token
   */
  static async createPasswordResetToken(userId) {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing password reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId
      }
    });

    // Create new token
    const resetToken = await prisma.passwordResetToken.create({
      data: {
        userId,
        token,
        expiresAt
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return resetToken;
  }

  /**
   * Verify and use email verification token
   * @param {string} token - Token string
   * @returns {Promise<Object|null>} - User if token is valid, null otherwise
   */
  static async verifyEmailVerificationToken(token) {
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token,
        type: 'EMAIL_VERIFICATION',
        usedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    if (!verificationToken) {
      return null;
    }

    // Mark token as used
    await prisma.verificationToken.update({
      where: {
        id: verificationToken.id
      },
      data: {
        usedAt: new Date()
      }
    });

    return verificationToken.user;
  }

  /**
   * Verify and use password reset token
   * @param {string} token - Token string
   * @returns {Promise<Object|null>} - User if token is valid, null otherwise
   */
  static async verifyPasswordResetToken(token) {
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        usedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    if (!resetToken) {
      return null;
    }

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: {
        id: resetToken.id
      },
      data: {
        usedAt: new Date()
      }
    });

    return resetToken.user;
  }

  /**
   * Find verification token by token string
   * @param {string} token - Token string
   * @param {string} type - Token type (EMAIL_VERIFICATION or PASSWORD_RESET)
   * @returns {Promise<Object|null>} - Token or null
   */
  static async findVerificationToken(token, type) {
    return await prisma.verificationToken.findFirst({
      where: {
        token,
        type
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  /**
   * Find password reset token by token string
   * @param {string} token - Token string
   * @returns {Promise<Object|null>} - Token or null
   */
  static async findPasswordResetToken(token) {
    return await prisma.passwordResetToken.findFirst({
      where: {
        token
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  /**
   * Check if token is expired
   * @param {Object} token - Token object
   * @returns {boolean} - True if expired
   */
  static isTokenExpired(token) {
    return new Date() > new Date(token.expiresAt);
  }

  /**
   * Check if token is used
   * @param {Object} token - Token object
   * @returns {boolean} - True if used
   */
  static isTokenUsed(token) {
    return token.usedAt !== null;
  }

  /**
   * Check if token is valid (not expired and not used)
   * @param {Object} token - Token object
   * @returns {boolean} - True if valid
   */
  static isTokenValid(token) {
    return !this.isTokenExpired(token) && !this.isTokenUsed(token);
  }

  /**
   * Clean up expired tokens
   * @returns {Promise<Object>} - Cleanup results
   */
  static async cleanupExpiredTokens() {
    const now = new Date();

    const [deletedVerificationTokens, deletedPasswordResetTokens] = await Promise.all([
      prisma.verificationToken.deleteMany({
        where: {
          expiresAt: {
            lt: now
          }
        }
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          expiresAt: {
            lt: now
          }
        }
      })
    ]);

    return {
      deletedVerificationTokens: deletedVerificationTokens.count,
      deletedPasswordResetTokens: deletedPasswordResetTokens.count,
      totalDeleted: deletedVerificationTokens.count + deletedPasswordResetTokens.count
    };
  }

  /**
   * Get token statistics
   * @returns {Promise<Object>} - Token statistics
   */
  static async getTokenStats() {
    const [activeVerificationTokens, activePasswordResetTokens, expiredTokens, usedTokens] = await Promise.all([
      prisma.verificationToken.count({
        where: {
          usedAt: null,
          expiresAt: {
            gt: new Date()
          }
        }
      }),
      prisma.passwordResetToken.count({
        where: {
          usedAt: null,
          expiresAt: {
            gt: new Date()
          }
        }
      }),
      prisma.verificationToken.count({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      }) + await prisma.passwordResetToken.count({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      }),
      prisma.verificationToken.count({
        where: {
          usedAt: {
            not: null
          }
        }
      }) + await prisma.passwordResetToken.count({
        where: {
          usedAt: {
            not: null
          }
        }
      })
    ]);

    return {
      activeVerificationTokens,
      activePasswordResetTokens,
      totalActiveTokens: activeVerificationTokens + activePasswordResetTokens,
      expiredTokens,
      usedTokens
    };
  }

  /**
   * Revoke all tokens for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Revocation results
   */
  static async revokeAllUserTokens(userId) {
    const now = new Date();

    const [revokedVerificationTokens, revokedPasswordResetTokens] = await Promise.all([
      prisma.verificationToken.updateMany({
        where: {
          userId,
          usedAt: null
        },
        data: {
          usedAt: now
        }
      }),
      prisma.passwordResetToken.updateMany({
        where: {
          userId,
          usedAt: null
        },
        data: {
          usedAt: now
        }
      })
    ]);

    return {
      revokedVerificationTokens: revokedVerificationTokens.count,
      revokedPasswordResetTokens: revokedPasswordResetTokens.count,
      totalRevoked: revokedVerificationTokens.count + revokedPasswordResetTokens.count
    };
  }
}

export default TokenService;