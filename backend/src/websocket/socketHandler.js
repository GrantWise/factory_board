const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/database');
const User = require('../models/User');
const {
  createDragLock,
  releaseDragLock,
  getAllActiveLocks
} = require('../middleware/dragLocks');

class SocketHandler {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // socketId -> user info
    this.userSockets = new Map(); // userId -> Set of socket IDs
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Authentication middleware for WebSocket connections
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret);
        const user = User.findById(decoded.userId);

        if (!user || !user.is_active) {
          return next(new Error('Invalid user or account inactive'));
        }

        socket.userId = user.id;
        socket.username = user.username;
        socket.userRole = user.role;
        socket.userInfo = {
          id: user.id,
          username: user.username,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name
        };

        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('WebSocket server initialized');
    return this.io;
  }

  handleConnection(socket) {
    const userId = socket.userId;
    const username = socket.username;

    // Track connected users
    this.connectedUsers.set(socket.id, {
      socketId: socket.id,
      userId: userId,
      username: username,
      role: socket.userRole,
      connectedAt: new Date().toISOString(),
      currentRoom: null
    });

    // Track user's sockets (user can have multiple connections)
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);

    console.log(`User ${username} (${userId}) connected via socket ${socket.id}`);

    // Send current user info and active locks
    socket.emit('connection_established', {
      user: socket.userInfo,
      connectedUsers: this.getConnectedUsersList(),
      activeLocks: getAllActiveLocks()
    });

    // Handle planning board room joining
    socket.on('join_planning_board', (data) => {
      this.handleJoinPlanningBoard(socket, data);
    });

    socket.on('leave_planning_board', () => {
      this.handleLeavePlanningBoard(socket);
    });

    // Handle drag operations
    socket.on('start_drag', (data) => {
      this.handleStartDrag(socket, data);
    });

    socket.on('end_drag', (data) => {
      this.handleEndDrag(socket, data);
    });

    // Handle order updates
    socket.on('order_updated', (data) => {
      this.handleOrderUpdated(socket, data);
    });

    // Handle work centre updates
    socket.on('work_centre_updated', (data) => {
      this.handleWorkCentreUpdated(socket, data);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });
  }

  handleJoinPlanningBoard(socket, data) {
    const userId = socket.userId;
    const username = socket.username;

    // Leave any existing rooms
    if (socket.currentRoom) {
      socket.leave(socket.currentRoom);
    }

    // Join planning board room
    socket.join('planning_board');
    socket.currentRoom = 'planning_board';

    // Update user tracking
    if (this.connectedUsers.has(socket.id)) {
      this.connectedUsers.get(socket.id).currentRoom = 'planning_board';
    }

    // Notify other users in the planning board
    socket.to('planning_board').emit('user_joined', {
      userId: userId,
      username: username,
      role: socket.userRole,
      joinedAt: new Date().toISOString()
    });

    // Send updated user list to the new joiner
    socket.emit('planning_board_users', {
      users: this.getPlanningBoardUsers()
    });

    console.log(`User ${username} joined planning board`);
  }

  handleLeavePlanningBoard(socket) {
    const userId = socket.userId;
    const username = socket.username;

    if (socket.currentRoom === 'planning_board') {
      socket.leave('planning_board');
      socket.currentRoom = null;

      // Update user tracking
      if (this.connectedUsers.has(socket.id)) {
        this.connectedUsers.get(socket.id).currentRoom = null;
      }

      // Notify other users
      socket.to('planning_board').emit('user_left', {
        userId: userId,
        username: username,
        leftAt: new Date().toISOString()
      });

      console.log(`User ${username} left planning board`);
    }
  }

  handleStartDrag(socket, data) {
    const { orderId, orderNumber } = data;
    const userId = socket.userId;
    const username = socket.username;

    try {
      // Create drag lock
      const lock = createDragLock(orderId, userId, username, orderNumber);

      // Broadcast to all planning board users
      this.io.to('planning_board').emit('order_locked', {
        orderId: orderId,
        orderNumber: orderNumber,
        lockedBy: username,
        lockedByUserId: userId,
        lockStartTime: lock.startTime,
        lockExpiry: new Date(lock.startTime + 30000).toISOString()
      });

      console.log(`Drag started for order ${orderId} by ${username}`);
    } catch (error) {
      socket.emit('drag_error', {
        orderId: orderId,
        error: error.message
      });
    }
  }

  handleEndDrag(socket, data) {
    const { orderId, completed, toWorkCentreId } = data;
    const userId = socket.userId;
    const username = socket.username;

    try {
      // Release drag lock
      const released = releaseDragLock(orderId, userId);

      if (released) {
        // Broadcast to all planning board users
        this.io.to('planning_board').emit('order_unlocked', {
          orderId: orderId,
          unlockedBy: username,
          unlockedByUserId: userId,
          completed: completed,
          toWorkCentreId: toWorkCentreId,
          unlockedAt: new Date().toISOString()
        });

        console.log(`Drag ended for order ${orderId} by ${username} (completed: ${completed})`);
      }
    } catch (error) {
      socket.emit('drag_error', {
        orderId: orderId,
        error: error.message
      });
    }
  }

  handleOrderUpdated(socket, data) {
    const { order, updateType } = data;
    const username = socket.username;

    // Broadcast order update to all planning board users
    this.io.to('planning_board').emit('order_updated', {
      order: order,
      updateType: updateType || 'modified',
      updatedBy: username,
      updatedAt: new Date().toISOString()
    });

    console.log(`Order ${order.orderNumber} updated by ${username}`);
  }

  handleWorkCentreUpdated(socket, data) {
    const { workCentre, updateType } = data;
    const username = socket.username;

    // Broadcast work centre update to all users
    this.io.emit('work_centre_updated', {
      workCentre: workCentre,
      updateType: updateType || 'modified',
      updatedBy: username,
      updatedAt: new Date().toISOString()
    });

    console.log(`Work centre ${workCentre.name} updated by ${username}`);
  }

  handleDisconnection(socket, reason) {
    const userId = socket.userId;
    const username = socket.username;

    // Remove from connected users
    this.connectedUsers.delete(socket.id);

    // Remove socket from user's socket set
    if (this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(socket.id);
      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
      }
    }

    // Release any locks held by this user if they have no other connections
    if (!this.userSockets.has(userId)) {
      const activeLocks = getAllActiveLocks();
      for (const [orderId, lockInfo] of Object.entries(activeLocks)) {
        if (lockInfo.userId === userId) {
          releaseDragLock(orderId, userId);

          // Notify planning board users
          this.io.to('planning_board').emit('order_unlocked', {
            orderId: orderId,
            unlockedBy: username,
            unlockedByUserId: userId,
            completed: false,
            reason: 'user_disconnected',
            unlockedAt: new Date().toISOString()
          });
        }
      }
    }

    // Notify planning board users if they were in that room
    if (socket.currentRoom === 'planning_board') {
      socket.to('planning_board').emit('user_left', {
        userId: userId,
        username: username,
        reason: reason,
        leftAt: new Date().toISOString()
      });
    }

    console.log(`User ${username} (${userId}) disconnected from socket ${socket.id}. Reason: ${reason}`);
  }

  // Utility methods
  getConnectedUsersList() {
    const users = [];
    const seenUsers = new Set();

    for (const userInfo of this.connectedUsers.values()) {
      if (!seenUsers.has(userInfo.userId)) {
        users.push({
          userId: userInfo.userId,
          username: userInfo.username,
          role: userInfo.role,
          connectedAt: userInfo.connectedAt,
          isInPlanningBoard: userInfo.currentRoom === 'planning_board'
        });
        seenUsers.add(userInfo.userId);
      }
    }

    return users;
  }

  getPlanningBoardUsers() {
    const users = [];
    const seenUsers = new Set();

    for (const userInfo of this.connectedUsers.values()) {
      if (userInfo.currentRoom === 'planning_board' && !seenUsers.has(userInfo.userId)) {
        users.push({
          userId: userInfo.userId,
          username: userInfo.username,
          role: userInfo.role,
          joinedAt: userInfo.connectedAt
        });
        seenUsers.add(userInfo.userId);
      }
    }

    return users;
  }

  // Methods for external use (from REST API controllers)
  broadcastOrderMoved(order, fromWorkCentreId, toWorkCentreId, movedBy) {
    if (this.io) {
      this.io.to('planning_board').emit('order_moved', {
        order: order,
        fromWorkCentreId: fromWorkCentreId,
        toWorkCentreId: toWorkCentreId,
        movedBy: movedBy,
        movedAt: new Date().toISOString()
      });
    }
  }

  broadcastOrderStatusChanged(order, oldStatus, newStatus, changedBy) {
    if (this.io) {
      this.io.to('planning_board').emit('order_status_changed', {
        order: order,
        oldStatus: oldStatus,
        newStatus: newStatus,
        changedBy: changedBy,
        changedAt: new Date().toISOString()
      });
    }
  }

  broadcastWorkCentreUpdated(workCentre, updateType, updatedBy) {
    if (this.io) {
      this.io.emit('work_centre_updated', {
        workCentre: workCentre,
        updateType: updateType,
        updatedBy: updatedBy,
        updatedAt: new Date().toISOString()
      });
    }
  }

  getConnectionStats() {
    return {
      totalConnections: this.connectedUsers.size,
      uniqueUsers: this.userSockets.size,
      planningBoardUsers: this.getPlanningBoardUsers().length,
      activeLocks: Object.keys(getAllActiveLocks()).length
    };
  }
}

module.exports = new SocketHandler();