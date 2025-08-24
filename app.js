const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const https = require('https');

const { connectDatabase } = require('./src/config/database');
const config = require('./src/config/config');
const { generalRateLimit } = require('./src/middleware/ratelimit');
const authRoutes = require('./src/routes/auth');
const postRoutes = require('./src/routes/posts');

const app = express();

// Security middleware
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       // defaultSrc: ["'self'"],
//       styleSrc: ["'self'"],
//       scriptSrc: ["'self'"],
//       imgSrc: ["'self'", "data:", "https:"]
//     }
//   }
// }));

app.use(cors({
  origin: config.NODE_ENV === 'production' 
    ? ['https://cool-blog-app-gg.onrender.com'] 
    : '*',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV
  });
});

// Serve static files from React app build
app.use(express.static(path.join(__dirname, 'app/dist')));

// Serve React app for all non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.path === '/health') return next();
  if (req.method === 'GET') {
    return res.sendFile(path.join(__dirname, 'app/dist/index.html'));
  }
  next();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      message: `${field} already exists`
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(config.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler for API routes only
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found'
  });
});

// Start server with HTTPS
const startServer = async () => {
  try {
    await connectDatabase();

    // Load certs
    const options = {
      key: fs.readFileSync(path.join(__dirname, 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
    };

    https.createServer(options, app).listen(config.PORT || 443, () => {
      console.log(`🚀 HTTPS server running on port ${config.PORT || 443}`);
      console.log(`📊 Environment: ${config.NODE_ENV}`);
      console.log(`🔗 Health check: https://localhost:${config.PORT || 443}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
