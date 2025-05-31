const io = require('socket.io-client');

// Simple WebSocket connection test
console.log('Testing basic WebSocket events...');

const adminToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsInVzZXJuYW1lIjoiYWRtaW51c2VyIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQ4NjE2MTQ1LCJleHAiOjE3NDg3MDI1NDV9.H4jNcS4_AIDRjhlTEoxB1TDWszCxSdZ20cLVfl9G450";

const socket = io('http://localhost:3001', {
  auth: { token: adminToken }
});

socket.on('connect', () => {
  console.log('✅ WebSocket connected successfully!');
  console.log('Socket ID:', socket.id);
  
  // Test different event names that might be implemented
  console.log('\n🧪 Testing various WebSocket events...');
  
  // Try join room
  socket.emit('join-room', 'planning-board');
  socket.emit('join', 'planning-board');
  socket.emit('subscribe', 'planning-board');
  
  // Try drag events
  setTimeout(() => {
    socket.emit('startDrag', { orderId: 1, userId: 5 });
    socket.emit('start-drag', { orderId: 1, userId: 5 });
    socket.emit('drag_start', { orderId: 1, userId: 5 });
  }, 500);
  
  setTimeout(() => {
    socket.emit('endDrag', { orderId: 1, userId: 5 });
    socket.emit('end-drag', { orderId: 1, userId: 5 });
    socket.emit('drag_end', { orderId: 1, userId: 5 });
  }, 1000);
  
  // Try ping/pong
  setTimeout(() => {
    socket.emit('ping', 'test');
  }, 1500);
  
  setTimeout(() => {
    console.log('🔌 Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 3000);
});

// Listen for any events from server
socket.onAny((eventName, ...args) => {
  console.log(`📨 Received event '${eventName}':`, args);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

console.log('🚀 Simple WebSocket test started...');