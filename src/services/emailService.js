const nodemailer = require('nodemailer');
const config = require('../config/config');

class EmailService {
   constructor() {
    console.log('📧 Initializing email service with config:', {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      user: process.env.SMTP_USER ? '***configured***' : 'NOT_SET',
      pass: process.env.SMTP_PASS ? '***configured***' : 'NOT_SET'
    });

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      },
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000,    // 30 seconds
      socketTimeout: 60000       // 60 seconds
    });

    // Test connection on startup
    this.testConnection();

    // For development, use ethereal email for testing
    // if (config.NODE_ENV === 'development' && !process.env.SMTP_USER) {
    //   this.setupTestAccount();
    // }
  }

  async testConnection() {
    try {
      console.log('🔍 Testing email connection...');
      await this.transporter.verify();
      console.log('✅ Email service connection successful');
    } catch (error) {
      console.error('❌ Email service connection failed:', error.message);
      console.error('📧 Email configuration issues detected. Please check your SMTP settings.');
    }
  }
 

  async setupTestAccount() {
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log('📧 Using Ethereal Email for testing');
      console.log('📧 Test account:', testAccount.user);
    } catch (error) {
      console.error('Failed to create test email account:', error);
    }
  }

  async sendOTPEmail(email, otp, firstName = '') {
    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@simpleblog.com',
        to: email,
        subject: 'Email Verification - Your OTP Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verification</h2>
            <p>Hello${firstName ? ' ' + firstName : ''},</p>
            <p>Thank you for registering with Simple Blog. Please use the following OTP to verify your email address:</p>
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 8px;">${otp}</h1>
            </div>
            <p>This OTP will expire in 5 minutes.</p>
            <p>If you didn't request this verification, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated email, please do not reply.</p>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      // For development with ethereal email
      if (config.NODE_ENV === 'development' && !process.env.SMTP_USER) {
        console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Email sending failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendWelcomeEmail(email, firstName = '') {
    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@simpleblog.com',
        to: email,
        subject: 'Welcome to Simple Blog!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to Simple Blog!</h2>
            <p>Hello${firstName ? ' ' + firstName : ''},</p>
            <p>Your email has been successfully verified! Welcome to our community.</p>
            <p>You can now start creating and sharing your blog posts.</p>
            <p>Happy blogging!</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated email, please do not reply.</p>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      if (config.NODE_ENV === 'development' && !process.env.SMTP_USER) {
        console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Email sending failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new EmailService();
