// Role-based permissions
const ROLES = {
  ADMIN: {
    name: 'admin',
    permissions: [
      'users:read', 'users:write', 'users:delete',
      'work_centres:read', 'work_centres:write', 'work_centres:delete',
      'orders:read', 'orders:write', 'orders:delete', 'orders:move',
      'analytics:read', 'settings:write', 'audit:read'
    ]
  },
  SCHEDULER: {
    name: 'scheduler',
    permissions: [
      'work_centres:read',
      'orders:read', 'orders:write', 'orders:move',
      'analytics:read'
    ]
  },
  VIEWER: {
    name: 'viewer',
    permissions: [
      'work_centres:read',
      'orders:read',
      'analytics:read'
    ]
  }
};

// Get permissions for a role
function getPermissionsForRole(role) {
  const roleObj = Object.values(ROLES).find(r => r.name === role);
  return roleObj ? roleObj.permissions : [];
}

// Check if user has permission
function hasPermission(userRole, permission) {
  const permissions = getPermissionsForRole(userRole);
  return permissions.includes(permission);
}

// Middleware to require specific permission
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (!hasPermission(req.user.role, permission)) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      code: 'INSUFFICIENT_PERMISSIONS',
      required: permission,
      user_role: req.user.role
    });
  }

  next();
};

// Middleware to require specific role
const requireRole = (requiredRole) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.role !== requiredRole) {
    return res.status(403).json({
      error: 'Insufficient role privileges',
      code: 'INSUFFICIENT_ROLE',
      required: requiredRole,
      user_role: req.user.role
    });
  }

  next();
};

// Middleware to require one of multiple roles
const requireAnyRole = (allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Insufficient role privileges',
      code: 'INSUFFICIENT_ROLE',
      required: allowedRoles,
      user_role: req.user.role
    });
  }

  next();
};

module.exports = {
  ROLES,
  getPermissionsForRole,
  hasPermission,
  requirePermission,
  requireRole,
  requireAnyRole
};