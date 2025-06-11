const Database = require('better-sqlite3');
const path = require('path');

let db = null;

function getDatabase() {
  if (!db) {
    // Use in-memory database for tests
    if (process.env.NODE_ENV === 'test') {
      db = new Database(':memory:');
      db.pragma('foreign_keys = ON');

      // Run migration for test database
      const fs = require('fs');
      const migrationPath = path.resolve(__dirname, '../../database/migrations/001_create_tables.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      // Split and execute statements
      const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          db.exec(statement);
        }
      }

      console.log('Test database connected: in-memory');
    } else {
      const dbPath = process.env.DATABASE_PATH || './database/manufacturing.db';
      const fullPath = path.resolve(dbPath);

      db = new Database(fullPath);

      // Enable foreign keys
      db.pragma('foreign_keys = ON');

      // Set journal mode to WAL for better performance
      db.pragma('journal_mode = WAL');

      console.log(`Database connected: ${fullPath}`);
    }
  }

  return db;
}


function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

module.exports = {
  getDatabase,
  closeDatabase
};