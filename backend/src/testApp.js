require('dotenv').config({ path: '.env.test' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config/database');

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

// Rate limiting (disabled in test environment)
if (process.env.NODE_ENV !== 'test') {
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

  // Apply rate limiting to auth endpoints
  app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs for auth
    message: {
      error: 'Too many authentication attempts',
      code: 'AUTH_RATE_LIMIT_EXCEEDED'
    }
  }));

  app.use('/api', limiter);
}

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
    environment: process.env.NODE_ENV || 'test'
  });
});

// API Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const workCentreRoutes = require('./routes/workCentres');
const orderRoutes = require('./routes/orders');
const analyticsRoutes = require('./routes/analytics');
const externalRoutes = require('./routes/external');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/work-centres', workCentreRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/external', externalRoutes);

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

// Use centralized error handler (must be last middleware)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

module.exports = { app };