const { getDatabase, closeDatabase } = require('./src/utils/database');
const ApiKey = require('./src/models/apiKey');

async function createTestKey() {
  console.log('Checking existing API keys...');
  const existingKeys = ApiKey.findAll();
  console.log('Existing API keys:', existingKeys.length);

  // Delete existing test system keys first
  existingKeys.forEach(key => {
    if (key.system_id === 'test_erp_system') {
      console.log(`Removing existing test key: ${key.id}`);
      ApiKey.delete(key.id);
    }
  });

  console.log('Creating new test API key...');
  const newKey = await ApiKey.generateKey(
    'Test ERP System v2',
    'test_erp_system_v2',
    null, // created_by user ID (system-generated)
    {
      rateLimit: 1000,
      ipWhitelist: ['127.0.0.1', '::1', '::ffff:127.0.0.1']
    }
  );

  console.log('✅ Created API key:');
  console.log(`   System ID: ${newKey.system_id}`);
  console.log(`   API Key: ${newKey.plainKey}`);
  console.log(`   Rate Limit: ${newKey.rate_limit}`);

  // Close database connection
  closeDatabase();
}

createTestKey().catch(console.error);