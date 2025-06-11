#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

try {
  const dbPath = path.join(__dirname, 'database', 'factory_board.db');
  const db = new Database(dbPath, { readonly: true });
  
  console.log('🔍 Checking users in database...\n');
  
  const users = db.prepare('SELECT id, username, email, role FROM users').all();
  
  console.log('📋 All users:');
  users.forEach(user => {
    console.log(`  - ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Role: ${user.role}`);
  });
  
  console.log('\n📋 Admin users:');
  const adminUsers = users.filter(u => u.role === 'admin');
  if (adminUsers.length === 0) {
    console.log('  ❌ No admin users found!');
  } else {
    adminUsers.forEach(user => {
      console.log(`  - ${user.username} (${user.email})`);
    });
  }
  
  db.close();
} catch (error) {
  console.error('❌ Error checking users:', error.message);
}