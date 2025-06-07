const ApiKey = require('./src/models/apiKey');

async function updateApiKeyWhitelist() {
  console.log('Updating API key IP whitelist...');
  
  try {
    // Find the test API key
    const apiKey = ApiKey.findBySystemId('test_erp_system');
    if (!apiKey) {
      console.log('❌ API key not found');
      return;
    }
    
    console.log('📋 Current IP whitelist:', apiKey.ip_whitelist);
    
    // Update with both IPv4 and IPv6 localhost formats
    const updatedKey = ApiKey.update(apiKey.id, {
      ip_whitelist: ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']
    });
    
    console.log('✅ Updated IP whitelist:', updatedKey.ip_whitelist);
    console.log('🔬 Try the test command again!');
    
  } catch (error) {
    console.error('❌ Error updating API key:', error.message);
  }
}

updateApiKeyWhitelist();