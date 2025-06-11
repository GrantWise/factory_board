/*
Analytics Routes Module
======================

This module defines the analytics-related API endpoints for the factory_board backend.
All routes are prefixed with /api/analytics and require authentication.

Routes provide access to various analytics and reporting features, such as dashboard metrics,
cycle times, work centre performance, order flow, audit analytics, and production summary.

Each route is protected by role-based permissions to ensure only authorized users can access analytics data.

Example usage:
    GET /api/analytics/dashboard
    GET /api/analytics/cycle-times
    ...
*/

const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, schemas } = require('../middleware/validation');

// All routes require authentication to ensure only logged-in users can access analytics data
router.use(authenticateToken);

/**
 * GET /api/analytics/dashboard
 * Returns key dashboard metrics for the manufacturing process.
 * Requires 'analytics:read' permission.
 */
router.get('/dashboard',
  requirePermission('analytics:read'),
  AnalyticsController.getDashboardMetrics
);

/**
 * GET /api/analytics/cycle-times
 * Returns cycle time analytics for orders and steps.
 * Requires 'analytics:read' permission.
 */
router.get('/cycle-times',
  requirePermission('analytics:read'),
  AnalyticsController.getCycleTimes
);

/**
 * GET /api/analytics/work-centre-performance
 * Returns performance metrics for each work centre.
 * Requires 'analytics:read' permission.
 */
router.get('/work-centre-performance',
  requirePermission('analytics:read'),
  AnalyticsController.getWorkCentrePerformance
);

/**
 * GET /api/analytics/order-flow
 * Returns analytics on the flow of orders through the system.
 * Requires 'analytics:read' permission.
 */
router.get('/order-flow',
  requirePermission('analytics:read'),
  AnalyticsController.getOrderFlow
);

/**
 * GET /api/analytics/audit
 * Returns audit analytics, filtered by query parameters.
 * Requires 'audit:read' permission.
 * Validates query parameters using Joi schema.
 */
router.get('/audit',
  requirePermission('audit:read'),
  validate(schemas.query.auditFilters, 'query'),
  AnalyticsController.getAuditAnalytics
);

/**
 * GET /api/analytics/production-summary
 * Returns a summary of production analytics.
 * Requires 'analytics:read' permission.
 */
router.get('/production-summary',
  requirePermission('analytics:read'),
  AnalyticsController.getProductionSummary
);

// Export the router to be used in the main app
module.exports = router;