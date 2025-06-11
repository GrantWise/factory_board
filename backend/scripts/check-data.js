const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'manufacturing.db');
const db = new Database(dbPath);

console.log('=== TABLE STRUCTURE ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

console.log('\n=== MANUFACTURING_ORDERS COLUMNS ===');
const orderColumns = db.prepare("PRAGMA table_info(manufacturing_orders)").all();
console.log(orderColumns.map(c => `${c.name} (${c.type})`));

console.log('\n=== ORDERS ===');
const orders = db.prepare('SELECT id, order_number FROM manufacturing_orders LIMIT 3').all();
orders.forEach(order => {
  console.log(`Order: ${order.order_number} (ID: ${order.id})`);
});

console.log('\n=== JOB_CHARACTERISTICS TABLE ===');
try {
  const characteristics = db.prepare('SELECT * FROM job_characteristics LIMIT 5').all();
  console.log(JSON.stringify(characteristics, null, 2));
} catch (error) {
  console.log('Job characteristics table error:', error.message);
}

console.log('\n=== USER_SETTINGS TABLE STRUCTURE ===');
try {
  const userSettingsColumns = db.prepare("PRAGMA table_info(user_settings)").all();
  console.log('User settings columns:', userSettingsColumns.map(c => `${c.name} (${c.type})`));
  
  const settings = db.prepare('SELECT * FROM user_settings LIMIT 5').all();
  console.log('Sample user settings:', JSON.stringify(settings, null, 2));
} catch (error) {
  console.log('User settings error:', error.message);
}

console.log('\n=== ORDERS WITH CHARACTERISTICS (JOIN) ===');
try {
  const ordersWithChars = db.prepare(`
    SELECT 
      o.id, o.order_number,
      jc.type, jc.value, jc.color, jc.display_name
    FROM manufacturing_orders o
    LEFT JOIN job_characteristics jc ON o.id = jc.order_id
    WHERE jc.id IS NOT NULL
    LIMIT 10
  `).all();
  console.log('Orders with characteristics:', JSON.stringify(ordersWithChars, null, 2));
} catch (error) {
  console.log('Join error:', error.message);
}

console.log('\n=== CHECK WORK CENTRES ===');
const workCentres = db.prepare('SELECT id, name FROM work_centres WHERE is_active = 1 LIMIT 3').all();
console.log('Available work centres:', workCentres);

console.log('\n=== CHECK USERS ===');
const users = db.prepare('SELECT id, username, email, role FROM users LIMIT 5').all();
console.log('Available users:', users);

console.log('\n=== CREATE A TEST ORDER WITH CUSTOMER_ORDER CHARACTERISTIC ===');
try {
  // Create one test order with customer_order characteristic so we can see visual grouping
  const testOrderExists = db.prepare('SELECT id FROM manufacturing_orders WHERE order_number = ?').get('TEST-VISUAL-001');
  
  if (!testOrderExists && workCentres.length > 0) {
    console.log('Creating test order with customer PO...');
    const insertOrder = db.prepare(`
      INSERT INTO manufacturing_orders (
        order_number, stock_code, description, quantity_to_make, quantity_completed,
        current_operation, current_work_centre_id, status, priority, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    const result = insertOrder.run(
      'TEST-VISUAL-001', 'WIDGET-VISUAL', 'Test order for visual grouping', 
      100, 0, 'Assembly', workCentres[0].id, 'not_started', 'medium', 9
    );
    
    const orderId = result.lastInsertRowid;
    console.log('Created test order with ID:', orderId);
    
    // Add customer_order characteristic
    const insertChar = db.prepare(`
      INSERT INTO job_characteristics (
        order_id, type, value, color, display_name, is_system_generated, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    
    insertChar.run(orderId, 'customer_order', 'PO-VISUAL-TEST', '#3B82F6', 'Customer Order: PO-VISUAL-TEST', 1);
    console.log('Added customer_order characteristic');
    
    // Add another characteristic
    insertChar.run(orderId, 'priority', 'high', '#EF4444', 'High Priority', 1);
    console.log('Added priority characteristic');
    
  } else if (testOrderExists) {
    console.log('Test order already exists');
  } else {
    console.log('No work centres available to assign order to');
  }
  
} catch (error) {
  console.log('Test order creation error:', error.message);
}

db.close();