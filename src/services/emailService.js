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
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error.message);
      console.error('📧 Email configuration issues detected. Please check your SMTP settings.');
      
      
      return this.setupFallbackTransporter();
      
    }
  }

  async setupFallbackTransporter() {
    try {
      // Try with different port configurations for Render.com
      const fallbackConfigs = [
        { port: 465, secure: true },   // SSL
        { port: 2525, secure: false }, // Alternative port
        { port: 25, secure: false }    // Standard SMTP
      ];

      for (const config of fallbackConfigs) {
        try {
          console.log(`🔄 Trying port ${config.port} (secure: ${config.secure})`);
          
          this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: config.port,
            secure: config.secure,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            },
            tls: {
              rejectUnauthorized: false
            },
            connectionTimeout: 30000,
            greetingTimeout: 15000,
            socketTimeout: 30000
          });

          await this.transporter.verify();
          console.log(`✅ Fallback email service connected on port ${config.port}`);
          return true;
        } catch (err) {
          console.log(`❌ Port ${config.port} failed: ${err.message}`);
          continue;
        }
      }
      
      console.error('💥 All fallback email configurations failed');
      return false;
    } catch (error) {
      console.error('💥 Fallback email setup failed:', error.message);
      return false;
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
      console.log('📧 Attempting to send OTP email to:', email);
      
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
      console.log('✅ OTP email sent successfully to:', email, 'MessageID:', info.messageId);
      
      // For development with ethereal email
      if (config.NODE_ENV === 'development' && !process.env.SMTP_USER) {
        console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('💥 Email sending failed:', {
        error: error.message,
        code: error.code,
        command: error.command,
        email: email
      });
      
      // For development/testing, don't fail the registration process
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️ Development mode: Proceeding without email (OTP:', otp, ')');
        return {
          success: true,
          messageId: 'dev-mode-no-email',
          devMode: true,
          otp: otp // Include OTP for development
        };
      }
      
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
