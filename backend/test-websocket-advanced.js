const io = require('socket.io-client');

// Test WebSocket with real order drag & drop
console.log('Testing WebSocket drag & drop functionality...');

const adminToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsInVzZXJuYW1lIjoiYWRtaW51c2VyIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQ4NjE2MTQ1LCJleHAiOjE3NDg3MDI1NDV9.H4jNcS4_AIDRjhlTEoxB1TDWszCxSdZ20cLVfl9G450";

// Create two clients to test conflict detection
const client1 = io('http://localhost:3001', {
  auth: { token: adminToken }
});

const client2 = io('http://localhost:3001', {
  auth: { token: adminToken }
});

let connectCount = 0;

function onConnect(clientName) {
  connectCount++;
  console.log(`✅ ${clientName} connected`);
  
  if (connectCount === 2) {
    runDragDropTest();
  }
}

client1.on('connect', () => onConnect('Client 1'));
client2.on('connect', () => onConnect('Client 2'));

// Listen for events on both clients
[client1, client2].forEach((client, index) => {
  const clientName = `Client ${index + 1}`;
  
  client.on('order-locked', (data) => {
    console.log(`🔒 ${clientName} received order-locked:`, data);
  });
  
  client.on('order-unlocked', (data) => {
    console.log(`🔓 ${clientName} received order-unlocked:`, data);
  });
  
  client.on('drag-conflict', (data) => {
    console.log(`⚠️ ${clientName} received drag-conflict:`, data);
  });
  
  client.on('order-moved', (data) => {
    console.log(`📦 ${clientName} received order-moved:`, data);
  });
});

function runDragDropTest() {
  console.log('\n🧪 Starting drag & drop conflict test...');
  
  // Both clients join the planning board
  client1.emit('join-planning-board', { 
    userId: 'admin-user-1', 
    userName: 'Admin User 1' 
  });
  
  client2.emit('join-planning-board', { 
    userId: 'admin-user-2', 
    userName: 'Admin User 2' 
  });
  
  // Test 1: Client 1 starts dragging order 1
  setTimeout(() => {
    console.log('\n📌 Test 1: Client 1 starts dragging order 1');
    client1.emit('drag-start', {
      orderId: '1',
      orderNumber: 'MO-2024-001',
      fromWorkCentreId: 2,
      userId: 'admin-user-1',
      userName: 'Admin User 1'
    });
  }, 500);
  
  // Test 2: Client 2 tries to drag the same order (should get conflict)
  setTimeout(() => {
    console.log('\n📌 Test 2: Client 2 tries to drag same order (should conflict)');
    client2.emit('drag-start', {
      orderId: '1',
      orderNumber: 'MO-2024-001',
      fromWorkCentreId: 2,
      userId: 'admin-user-2',
      userName: 'Admin User 2'
    });
  }, 1000);
  
  // Test 3: Client 1 ends drag
  setTimeout(() => {
    console.log('\n📌 Test 3: Client 1 ends drag');
    client1.emit('drag-end', {
      orderId: '1',
      completed: true
    });
  }, 2000);
  
  // Test 4: Client 2 can now drag the order
  setTimeout(() => {
    console.log('\n📌 Test 4: Client 2 can now drag the order');
    client2.emit('drag-start', {
      orderId: '1',
      orderNumber: 'MO-2024-001',
      fromWorkCentreId: 2,
      userId: 'admin-user-2',
      userName: 'Admin User 2'
    });
  }, 2500);
  
  // Test 5: Client 2 moves order to different work centre
  setTimeout(() => {
    console.log('\n📌 Test 5: Client 2 moves order to work centre 3');
    client2.emit('order-move', {
      orderId: '1',
      fromWorkCentreId: 2,
      toWorkCentreId: 3,
      userId: 'admin-user-2',
      userName: 'Admin User 2',
      reason: 'Test move via WebSocket'
    });
  }, 3000);
  
  // Clean up
  setTimeout(() => {
    console.log('\n🧹 Cleaning up and disconnecting...');
    client1.disconnect();
    client2.disconnect();
    process.exit(0);
  }, 4000);
}

client1.on('connect_error', (error) => {
  console.error('❌ Client 1 connection failed:', error.message);
});

client2.on('connect_error', (error) => {
  console.error('❌ Client 2 connection failed:', error.message);
});

console.log('🚀 Advanced WebSocket test started...');