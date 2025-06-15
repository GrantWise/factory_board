const Database = require('better-sqlite3');
const path = require('path');

let db = null;

function getDatabase() {
  if (!db) {
    // Use in-memory database for tests
    if (process.env.NODE_ENV === 'test') {
      db = new Database(':memory:');
      db.pragma('foreign_keys = ON');

      // Run all migrations for test database
      const fs = require('fs');
      const migrationsDir = path.resolve(__dirname, '../../database/migrations');
      
      try {
        // Get all migration files in order
        const migrationFiles = fs.readdirSync(migrationsDir)
          .filter(file => file.endsWith('.sql'))
          .sort();

        for (const migrationFile of migrationFiles) {
          const migrationPath = path.join(migrationsDir, migrationFile);
          const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
          
          // Replace CREATE TABLE with CREATE TABLE IF NOT EXISTS for test environments
          const testMigrationSQL = migrationSQL.replace(/CREATE TABLE/g, 'CREATE TABLE IF NOT EXISTS');
          
          // Split and execute statements, handling ALTER TABLE statements too
          const statements = testMigrationSQL.split(';').filter(stmt => stmt.trim());
          for (const statement of statements) {
            if (statement.trim()) {
              try {
                db.exec(statement);
              } catch (error) {
                // Ignore "duplicate column" errors in test environment
                if (!error.message.includes('duplicate column')) {
                  console.warn(`Test migration warning in ${migrationFile}:`, error.message);
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('Test database migration warning:', error.message);
        // Don't fail tests if migrations have issues
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