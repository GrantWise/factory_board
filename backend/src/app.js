require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config/database');
const { runMigrations } = require('../database/migrate');

// Initialize database
try {
  runMigrations();
  console.log('Database initialized successfully');
} catch (error) {
  console.error('Database initialization failed:', error);
  process.exit(1);
}

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors(config.server.cors));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to auth endpoints (more lenient in development)
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // More attempts in development
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
}));

app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const workCentreRoutes = require('./routes/workCentres');
const orderRoutes = require('./routes/orders');
const analyticsRoutes = require('./routes/analytics');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/work-centres', workCentreRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/analytics', analyticsRoutes);

// Planning board endpoint (aggregated data)
app.get('/api/planning-board', require('./controllers/planningController').getPlanningBoardData);
app.put('/api/planning-board/move', require('./controllers/planningController').moveOrder);
app.get('/api/planning-board/stats', require('./controllers/planningController').getPlanningBoardStats);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    code: 'NOT_FOUND',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Database errors
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({
      error: 'Duplicate entry detected',
      code: 'DUPLICATE_ENTRY',
      details: err.message
    });
  }
  
  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.details
    });
  }
  
  // Default error response
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  const { closeDatabase } = require('./utils/database');
  closeDatabase();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  const { closeDatabase } = require('./utils/database');
  closeDatabase();
  process.exit(0);
});

const PORT = config.server.port;

const server = app.listen(PORT, () => {
  console.log(`Manufacturing Planning Board API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS enabled for: ${config.server.cors.origin}`);
});

// Initialize WebSocket
const webSocketService = require('./services/websocketService');
webSocketService.initialize(server);
console.log('WebSocket server initialized');

// Export for testing
module.exports = { app, server };