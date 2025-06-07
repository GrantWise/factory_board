const ApiKey = require('./src/models/apiKey');
const User = require('./src/models/User');
const { getDatabase } = require('./src/utils/database');

async function testApiKeyCreation() {
  console.log('Testing API Key Creation...');
  
  try {
    // First, ensure we have a user for the foreign key constraint
    let testUser;
    try {
      testUser = User.findById(1);
      if (!testUser) {
        console.log('📝 Creating test user...');
        testUser = User.create({
          username: 'test_admin',
          email: 'test@example.com',
          password_hash: 'dummy_hash',
          role: 'admin',
          first_name: 'Test',
          last_name: 'Admin'
        });
        console.log('✅ Test user created');
      } else {
        console.log('✅ Test user already exists');
      }
    } catch (error) {
      console.log('📝 Creating test user...');
      testUser = User.create({
        username: 'test_admin',
        email: 'test@example.com', 
        password_hash: 'dummy_hash',
        role: 'admin',
        first_name: 'Test',
        last_name: 'Admin'
      });
      console.log('✅ Test user created');
    }
    
    // Generate a test API key
    const result = await ApiKey.generateKey(
      'Test ERP Integration', 
      'test_erp_system', 
      testUser.id, 
      {
        rateLimit: 1000,
        ipWhitelist: ['127.0.0.1', '::1'],
        metadata: { source: 'test_script', purpose: 'integration_testing' }
      }
    );
    
    console.log('✅ API Key created successfully!');
    console.log('📋 Details:');
    console.log(`   - ID: ${result.id}`);
    console.log(`   - Name: ${result.name}`);
    console.log(`   - System ID: ${result.system_id}`);
    console.log(`   - Rate Limit: ${result.rate_limit} requests/15min`);
    console.log(`   - IP Whitelist: ${JSON.stringify(result.ip_whitelist)}`);
    console.log(`   - Is Active: ${result.is_active}`);
    console.log('');
    console.log('🔑 API Key (save this - only shown once):');
    console.log(`   ${result.plainKey}`);
    console.log('');
    console.log('🔬 Test Commands:');
    console.log('1. Test external orders import:');
    console.log(`curl -X POST http://127.0.0.1:3001/api/external/orders \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${result.plainKey}" \\
  -H "X-System-ID: test_erp_system" \\
  -d '{"orders": [{"order_number": "TEST-001", "stock_code": "PART-001", "description": "Test Order", "quantity_to_make": 10}]}'`);
    
    console.log('');
    console.log('2. Test work centres list:');
    console.log(`curl -H "X-API-Key: ${result.plainKey}" -H "X-System-ID: test_erp_system" http://127.0.0.1:3001/api/external/work-centres`);
    
    console.log('');
    console.log('3. View Swagger Documentation:');
    console.log('   http://127.0.0.1:3001/api/docs');
    
    // Test the verification process
    console.log('');
    console.log('🧪 Testing API key verification...');
    const isValid = await ApiKey.verifyKey(result.plainKey, 'test_erp_system');
    console.log(`   Verification result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    
    // Show all API keys
    console.log('');
    console.log('📊 All API Keys in database:');
    const allKeys = ApiKey.findAll();
    allKeys.forEach(key => {
      console.log(`   - ${key.name} (${key.system_id}) - ${key.is_active ? 'Active' : 'Inactive'}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating API key:', error.message);
    console.error(error);
  }
}

// Run the test
testApiKeyCreation();