const socketHandler = require('../websocket/socketHandler');

class WebSocketService {
  constructor() {
    this.socketHandler = socketHandler;
  }

  // Initialize WebSocket with HTTP server
  initialize(server) {
    return this.socketHandler.initialize(server);
  }

  // Broadcast order moved event
  broadcastOrderMoved(order, fromWorkCentreId, toWorkCentreId, movedByUsername) {
    this.socketHandler.broadcastOrderMoved(
      order,
      fromWorkCentreId,
      toWorkCentreId,
      movedByUsername
    );
  }

  // Broadcast order status change
  broadcastOrderStatusChanged(order, oldStatus, newStatus, changedByUsername) {
    this.socketHandler.broadcastOrderStatusChanged(
      order,
      oldStatus,
      newStatus,
      changedByUsername
    );
  }

  // Broadcast work centre update
  broadcastWorkCentreUpdated(workCentre, updateType, updatedByUsername) {
    this.socketHandler.broadcastWorkCentreUpdated(
      workCentre,
      updateType,
      updatedByUsername
    );
  }

  // Get connection statistics
  getConnectionStats() {
    return this.socketHandler.getConnectionStats();
  }

  // Get connected users in planning board
  getPlanningBoardUsers() {
    return this.socketHandler.getPlanningBoardUsers();
  }

  // Get all connected users
  getConnectedUsers() {
    return this.socketHandler.getConnectedUsersList();
  }

  // Check if WebSocket is initialized
  isInitialized() {
    return this.socketHandler.io !== null;
  }

  // Send notification to specific user(s)
  sendNotificationToUser(userId, notification) {
    if (this.socketHandler.io && this.socketHandler.userSockets.has(userId)) {
      const userSocketIds = this.socketHandler.userSockets.get(userId);
      userSocketIds.forEach(socketId => {
        this.socketHandler.io.to(socketId).emit('notification', {
          ...notification,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  // Send notification to all users in planning board
  sendNotificationToPlanningBoard(notification) {
    if (this.socketHandler.io) {
      this.socketHandler.io.to('planning_board').emit('notification', {
        ...notification,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Send notification to all connected users
  sendGlobalNotification(notification) {
    if (this.socketHandler.io) {
      this.socketHandler.io.emit('notification', {
        ...notification,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Broadcast system maintenance message
  broadcastMaintenanceMessage(message, scheduledTime) {
    if (this.socketHandler.io) {
      this.socketHandler.io.emit('system_maintenance', {
        message: message,
        scheduledTime: scheduledTime,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Broadcast real-time analytics update
  broadcastAnalyticsUpdate(analyticsData) {
    if (this.socketHandler.io) {
      this.socketHandler.io.to('planning_board').emit('analytics_update', {
        data: analyticsData,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Force disconnect user (admin action)
  forceDisconnectUser(userId, reason = 'Admin action') {
    if (this.socketHandler.io && this.socketHandler.userSockets.has(userId)) {
      const userSocketIds = this.socketHandler.userSockets.get(userId);
      userSocketIds.forEach(socketId => {
        const socket = this.socketHandler.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('forced_disconnect', {
            reason: reason,
            timestamp: new Date().toISOString()
          });
          socket.disconnect(true);
        }
      });
    }
  }

  // Get real-time planning board status
  getPlanningBoardStatus() {
    const stats = this.getConnectionStats();
    const users = this.getPlanningBoardUsers();

    return {
      isActive: stats.planningBoardUsers > 0,
      activeUsers: users,
      totalConnections: stats.totalConnections,
      activeDragOperations: stats.activeLocks,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new WebSocketService();