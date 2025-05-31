// Test global setup
const { setupTestDatabase } = require('./helpers/testUtils');

// Global test database
let globalTestDatabase = null;

async function getTestDatabase() {
  if (!globalTestDatabase) {
    globalTestDatabase = await setupTestDatabase();
  }
  return globalTestDatabase;
}

function setTestDatabase(db) {
  globalTestDatabase = db;
}

module.exports = {
  getTestDatabase,
  setTestDatabase
};