const io = require('socket.io-client');

// Test WebSocket connection with authentication
console.log('Testing WebSocket connection to http://localhost:3001...');

// Use the admin token from our previous manual test
const adminToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsInVzZXJuYW1lIjoiYWRtaW51c2VyIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQ4NjE2MTQ1LCJleHAiOjE3NDg3MDI1NDV9.H4jNcS4_AIDRjhlTEoxB1TDWszCxSdZ20cLVfl9G450";

const socket = io('http://localhost:3001', {
  autoConnect: true,
  timeout: 5000,
  auth: {
    token: adminToken
  }
});

socket.on('connect', () => {
  console.log('✅ WebSocket connected successfully!');
  console.log('Socket ID:', socket.id);
  
  // Test joining planning board room
  socket.emit('join-planning-board', { userId: 'test-user-123' });
  console.log('📡 Emitted join-planning-board event');
  
  // Test drag start event
  setTimeout(() => {
    const dragStartData = {
      orderId: 'TEST-ORDER-001',
      orderNumber: 'MO-2024-TEST',
      fromWorkCentreId: 1,
      userId: 'test-user-123',
      userName: 'Test User'
    };
    
    socket.emit('drag-start', dragStartData);
    console.log('🎯 Emitted drag-start event:', dragStartData);
  }, 1000);
  
  // Test drag end event
  setTimeout(() => {
    const dragEndData = {
      orderId: 'TEST-ORDER-001',
      completed: false
    };
    
    socket.emit('drag-end', dragEndData);
    console.log('🏁 Emitted drag-end event:', dragEndData);
  }, 3000);
  
  // Disconnect after testing
  setTimeout(() => {
    console.log('🔌 Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 5000);
});

socket.on('connect_error', (error) => {
  console.error('❌ WebSocket connection failed:', error.message);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 WebSocket disconnected:', reason);
});

// Listen for drag events from server
socket.on('order-locked', (data) => {
  console.log('🔒 Received order-locked event:', data);
});

socket.on('order-unlocked', (data) => {
  console.log('🔓 Received order-unlocked event:', data);
});

socket.on('order-moved', (data) => {
  console.log('📦 Received order-moved event:', data);
});

socket.on('drag-conflict', (data) => {
  console.log('⚠️ Received drag-conflict event:', data);
});

// Handle any errors
socket.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

console.log('🚀 WebSocket test client started...');