// In-memory drag lock management for conflict prevention
const activeDragOperations = new Map();

// Auto-cleanup interval (run every 30 seconds)
setInterval(() => {
  const now = Date.now();
  const LOCK_TIMEOUT = 30000; // 30 seconds

  for (const [orderId, lock] of activeDragOperations.entries()) {
    if (now - lock.startTime > LOCK_TIMEOUT) {
      console.log(`Auto-releasing expired drag lock for order ${orderId}`);
      activeDragOperations.delete(orderId);
    }
  }
}, 30000);

// Create a drag lock for an order
const createDragLock = (orderId, userId, userName, orderNumber) => {
  const lockData = {
    userId,
    userName,
    orderNumber,
    startTime: Date.now()
  };

  activeDragOperations.set(orderId.toString(), lockData);

  console.log(`Drag lock created for order ${orderId} by user ${userName}`);

  // Auto-expire after 30 seconds
  setTimeout(() => {
    if (activeDragOperations.has(orderId.toString())) {
      console.log(`Auto-expiring drag lock for order ${orderId}`);
      activeDragOperations.delete(orderId.toString());
    }
  }, 30000);

  return lockData;
};

// Release a drag lock
const releaseDragLock = (orderId, userId) => {
  const orderIdStr = orderId.toString();
  const lock = activeDragOperations.get(orderIdStr);

  if (!lock) {
    return false; // Lock doesn't exist
  }

  if (lock.userId !== userId) {
    return false; // User doesn't own the lock
  }

  activeDragOperations.delete(orderIdStr);
  console.log(`Drag lock released for order ${orderId} by user ${lock.userName}`);

  return true;
};

// Check if an order is locked
const isOrderLocked = (orderId) => activeDragOperations.has(orderId.toString());

// Get lock information for an order
const getLockInfo = (orderId) => activeDragOperations.get(orderId.toString()) || null;

// Get all active locks
const getAllActiveLocks = () => {
  const locks = {};
  for (const [orderId, lock] of activeDragOperations.entries()) {
    locks[orderId] = {
      userId: lock.userId,
      userName: lock.userName,
      orderNumber: lock.orderNumber,
      startTime: lock.startTime,
      timeRemaining: Math.max(0, 30000 - (Date.now() - lock.startTime))
    };
  }
  return locks;
};

// Middleware to check if order is locked by another user
const checkDragLock = (req, res, next) => {
  const orderId = req.params.id || req.body.orderId;

  if (!orderId) {
    return next(); // No order ID to check
  }

  const lock = getLockInfo(orderId);

  if (lock && lock.userId !== req.user.id) {
    return res.status(423).json({
      error: 'Order currently being moved by another user',
      code: 'ORDER_LOCKED',
      lockedBy: lock.userName,
      orderNumber: lock.orderNumber,
      lockStartTime: lock.startTime
    });
  }

  next();
};

// Middleware to automatically create lock when starting drag operation
const createLockForRequest = (req, res, next) => {
  const orderId = req.params.id;
  const orderNumber = req.body.orderNumber || req.params.id; // Fallback to ID if no order number

  if (!orderId) {
    return res.status(400).json({
      error: 'Order ID required',
      code: 'MISSING_ORDER_ID'
    });
  }

  // Check if already locked by another user
  const existingLock = getLockInfo(orderId);
  if (existingLock && existingLock.userId !== req.user.id) {
    return res.status(423).json({
      error: 'Order currently being moved by another user',
      code: 'ORDER_LOCKED',
      lockedBy: existingLock.userName,
      orderNumber: existingLock.orderNumber
    });
  }

  // Create or refresh lock for current user
  const lock = createDragLock(
    orderId,
    req.user.id,
    req.user.username,
    orderNumber
  );

  req.dragLock = lock;
  next();
};

module.exports = {
  createDragLock,
  releaseDragLock,
  isOrderLocked,
  getLockInfo,
  getAllActiveLocks,
  checkDragLock,
  createLockForRequest,
  // Export the Map for testing/debugging
  activeDragOperations
};