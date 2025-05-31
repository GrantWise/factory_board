const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, schemas } = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// GET /api/analytics/dashboard
router.get('/dashboard', 
  requirePermission('analytics:read'),
  AnalyticsController.getDashboardMetrics
);

// GET /api/analytics/cycle-times
router.get('/cycle-times', 
  requirePermission('analytics:read'),
  AnalyticsController.getCycleTimes
);

// GET /api/analytics/work-centre-performance
router.get('/work-centre-performance', 
  requirePermission('analytics:read'),
  AnalyticsController.getWorkCentrePerformance
);

// GET /api/analytics/order-flow
router.get('/order-flow', 
  requirePermission('analytics:read'),
  AnalyticsController.getOrderFlow
);

// GET /api/analytics/audit
router.get('/audit', 
  requirePermission('audit:read'),
  validate(schemas.query.auditFilters, 'query'),
  AnalyticsController.getAuditAnalytics
);

// GET /api/analytics/production-summary
router.get('/production-summary', 
  requirePermission('analytics:read'),
  AnalyticsController.getProductionSummary
);

module.exports = router;