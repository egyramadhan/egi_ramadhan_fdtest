import nodemailer from 'nodemailer';
import { ValidationError } from '../middleware/errorHandler.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    const emailConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    };

    // Only add auth if credentials are provided (MailHog doesn't need auth)
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      emailConfig.auth = {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      };
    }

    // For development, use ethereal email if no config provided
    if (!process.env.SMTP_HOST && process.env.NODE_ENV === 'development') {
      console.log('No email configuration found. Using console logging for development.');
      this.transporter = {
        sendMail: async (mailOptions) => {
          console.log('📧 Email would be sent:');
          console.log('To:', mailOptions.to);
          console.log('Subject:', mailOptions.subject);
          console.log('Content:', mailOptions.html || mailOptions.text);
          return { messageId: 'dev-' + Date.now() };
        }
      };
      return;
    }

    this.transporter = nodemailer.createTransport(emailConfig);
  }

  /**
   * Verify email configuration
   * @returns {Promise<boolean>} - True if configuration is valid
   */
  async verifyConnection() {
    try {
      if (this.transporter.sendMail.toString().includes('console.log')) {
        return true; // Development mode
      }
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email configuration error:', error.message);
      return false;
    }
  }

  /**
   * Send email verification email
   * @param {Object} user - User object
   * @param {string} token - Verification token
   * @returns {Promise<Object>} - Send result
   */
  async sendVerificationEmail(user, token) {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Egi Ramadhan FD Test'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Verify Your Email Address',
      html: this.getVerificationEmailTemplate(user.name, verificationUrl),
      text: `Hi ${user.name},\n\nPlease verify your email address by clicking the following link:\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account, please ignore this email.\n\nBest regards,\n${process.env.APP_NAME || 'Egi Ramadhan FD Test'} Team`
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Verification email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new ValidationError('Failed to send verification email');
    }
  }

  /**
   * Send password reset email
   * @param {Object} user - User object
   * @param {string} token - Reset token
   * @returns {Promise<Object>} - Send result
   */
  async sendPasswordResetEmail(user, token) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Egi Ramadhan FD Test'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Reset Your Password',
      html: this.getPasswordResetEmailTemplate(user.name, resetUrl),
      text: `Hi ${user.name},\n\nYou requested to reset your password. Click the following link to reset it:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email and your password will remain unchanged.\n\nBest regards,\n${process.env.APP_NAME || 'Egi Ramadhan FD Test'} Team`
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Password reset email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new ValidationError('Failed to send password reset email');
    }
  }

  /**
   * Send welcome email
   * @param {Object} user - User object
   * @returns {Promise<Object>} - Send result
   */
  async sendWelcomeEmail(user) {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
    
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Egi Ramadhan FD Test'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Welcome to Our Platform!',
      html: this.getWelcomeEmailTemplate(user.name, loginUrl),
      text: `Hi ${user.name},\n\nWelcome to ${process.env.APP_NAME || 'Egi Ramadhan FD Test'}!\n\nYour email has been verified and your account is now active. You can start exploring our book collection and features.\n\nLogin here: ${loginUrl}\n\nBest regards,\n${process.env.APP_NAME || 'Egi Ramadhan FD Test'} Team`
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Welcome email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't throw error for welcome email as it's not critical
      return null;
    }
  }

  /**
   * Get verification email HTML template
   * @param {string} name - User name
   * @param {string} verificationUrl - Verification URL
   * @returns {string} - HTML template
   */
  getVerificationEmailTemplate(name, verificationUrl) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>${process.env.APP_NAME || 'Egi Ramadhan FD Test'}</h1>
        </div>
        <div class="content">
            <h2>Hi ${name}!</h2>
            <p>Thank you for signing up! Please verify your email address to complete your registration.</p>
            <p>Click the button below to verify your email:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #4f46e5;">${verificationUrl}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br>${process.env.APP_NAME || 'Egi Ramadhan FD Test'} Team</p>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Get password reset email HTML template
   * @param {string} name - User name
   * @param {string} resetUrl - Reset URL
   * @returns {string} - HTML template
   */
  getPasswordResetEmailTemplate(name, resetUrl) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>${process.env.APP_NAME || 'Egi Ramadhan FD Test'}</h1>
        </div>
        <div class="content">
            <h2>Hi ${name}!</h2>
            <p>You requested to reset your password. Click the button below to create a new password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #dc2626;">${resetUrl}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br>${process.env.APP_NAME || 'Egi Ramadhan FD Test'} Team</p>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Get welcome email HTML template
   * @param {string} name - User name
   * @param {string} loginUrl - Login URL
   * @returns {string} - HTML template
   */
  getWelcomeEmailTemplate(name, loginUrl) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome!</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Welcome to ${process.env.APP_NAME || 'Egi Ramadhan FD Test'}!</h1>
        </div>
        <div class="content">
            <h2>Hi ${name}!</h2>
            <p>Welcome to our platform! Your email has been verified and your account is now active.</p>
            <p>You can now:</p>
            <ul>
                <li>Browse our extensive book collection</li>
                <li>Rate and review books</li>
                <li>Manage your reading list</li>
                <li>Connect with other book lovers</li>
            </ul>
            <p>Ready to get started?</p>
            <a href="${loginUrl}" class="button">Login to Your Account</a>
            <p>Thank you for joining us!</p>
        </div>
        <div class="footer">
            <p>Best regards,<br>${process.env.APP_NAME || 'Egi Ramadhan FD Test'} Team</p>
        </div>
    </body>
    </html>
    `;
  }
}

// Create singleton instance
const emailService = new EmailService();

export default emailService;