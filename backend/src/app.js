/*
App Entry Point
===============

This file initializes the Express application, configures middleware, sets up routes, and handles errors.
- Security, CORS, and rate limiting middleware are applied for safety and performance.
- All API routes are registered under the /api/ prefix.
- A centralized error handler is used to standardize error responses and log server errors.
- Graceful shutdown is handled for SIGTERM and SIGINT signals.

Error Handling:
- All errors are passed to the centralized errorHandler middleware (see src/middleware/errorHandler.js).
- The error handler standardizes error responses and logs server errors for debugging.
*/

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const config = require('./config/database');
const { runMigrations } = require('../database/migrate');
const errorHandler = require('./middleware/errorHandler');

// Initialize database (skip migrations in test environment as they're handled in database.js)
if (process.env.NODE_ENV !== 'test') {
  try {
    runMigrations();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\''],
      scriptSrc: ['\'self\''],
      imgSrc: ['\'self\'', 'data:', 'https:']
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors(config.server.cors));

// Security Service - Centralized security policy enforcement
const SecurityService = require('./services/securityService');

// Apply hierarchical rate limiting using security service
// This addresses root cause: Security-by-middleware anti-pattern
app.use('/api/auth', SecurityService.createPolicyMiddleware('auth'));
app.use('/api/admin', SecurityService.createPolicyMiddleware('admin'));
app.use('/api/external', SecurityService.createPolicyMiddleware('api-key'));
app.use('/api', SecurityService.createPolicyMiddleware('global'));

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

// Swagger documentation setup
const { specs, swaggerUi, swaggerOptions } = require('./config/swagger');

// Serve Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));

// API documentation endpoint (JSON)
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

// API Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const workCentreRoutes = require('./routes/workCentres');
const orderRoutes = require('./routes/orders');
const analyticsRoutes = require('./routes/analytics');
const apiKeyRoutes = require('./routes/apiKeys');
const externalRoutes = require('./routes/external');
const characteristicsRoutes = require('./routes/characteristics');
const userSettingsRoutes = require('./routes/userSettings');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/work-centres', workCentreRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin/api-keys', apiKeyRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/characteristics', characteristicsRoutes);
app.use('/api/settings', userSettingsRoutes);

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

// Centralized error handler (must be last middleware)
app.use(errorHandler);

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