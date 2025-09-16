

const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

async function testAPI() {
  console.log('🧪 Testing Backend API...');
  console.log(`🔗 Base URL: ${BASE_URL}`);
  
  try {
    // 1. Test health check
    console.log('\n1. Testing health check...');
    const healthResponse = await axios.get(`${BASE_URL}/api/health`, {
      timeout: 5000
    });
    console.log('✅ Health check passed:', healthResponse.data);

    // 2. Test alternative health endpoint
    console.log('\n2. Testing alternative health endpoint...');
    const altHealthResponse = await axios.get(`${BASE_URL}/health`, {
      timeout: 5000
    });
    console.log('✅ Alternative health check passed:', altHealthResponse.data);

    // 3. Test session creation
    console.log('\n3. Testing session creation...');
    const sessionResponse = await axios.post(`${BASE_URL}/api/session`, {}, {
      timeout: 5000
    });
    console.log('✅ Session created:', sessionResponse.data);
    const sessionId = sessionResponse.data.sessionId;

    // 4. Test Gemini connection (if available)
    console.log('\n4. Testing Gemini connection...');
    try {
      const geminiResponse = await axios.get(`${BASE_URL}/test-gemini`, {
        timeout: 10000
      });
      console.log('✅ Gemini test passed:', geminiResponse.data);
    } catch (geminiError) {
      console.log('⚠️  Gemini test skipped (service may not be configured):', geminiError.response?.data?.error || geminiError.message);
    }

    // 5. Test chat endpoint
    console.log('\n5. Testing chat endpoint...');
    const chatResponse = await axios.post(`${BASE_URL}/api/chat`, {
      message: 'Hello, this is a test message',
      sessionId: sessionId
    }, {
      timeout: 15000
    });
    console.log('✅ Chat test passed:', chatResponse.data);

    // 6. Test session history
    console.log('\n6. Testing session history...');
    const historyResponse = await axios.get(`${BASE_URL}/api/session/${sessionId}/history`, {
      timeout: 5000
    });
    console.log('✅ History test passed:', historyResponse.data);

    // 7. Test active sessions
    console.log('\n7. Testing active sessions...');
    const sessionsResponse = await axios.get(`${BASE_URL}/api/sessions`, {
      timeout: 5000
    });
    console.log('✅ Active sessions test passed:', sessionsResponse.data);

    // 8. Test document endpoints (if RAG service supports it)
    console.log('\n8. Testing document endpoints...');
    try {
      const documentsResponse = await axios.get(`${BASE_URL}/api/documents`, {
        timeout: 5000
      });
      console.log('✅ Documents list test passed:', documentsResponse.data);
    } catch (docError) {
      console.log('⚠️  Documents test skipped (may not be implemented):', docError.response?.data?.error || docError.message);
    }

    // 9. Clean up - clear session
    console.log('\n9. Cleaning up - clearing session...');
    const clearResponse = await axios.delete(`${BASE_URL}/api/session/${sessionId}`, {
      timeout: 5000
    });
    console.log('✅ Session cleared:', clearResponse.data);

    console.log('\n🎉 All tests passed successfully!');

  } catch (error) {
    console.error('\n❌ API test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Make sure the server is running on the correct port');
      console.error(`   Try: node server.js`);
    } else if (error.response) {
      console.error('📄 Response data:', error.response.data);
      console.error('📊 Status:', error.response.status);
    } else if (error.request) {
      console.error('🌐 No response received from server');
      console.error('   Check if server is running and accessible');
    }
    
    process.exit(1);
  }
}

// Function to test specific endpoint
async function testEndpoint(method, endpoint, data = null) {
  try {
    console.log(`\n🔍 Testing ${method.toUpperCase()} ${endpoint}`);
    
    let response;
    const config = { timeout: 5000 };
    
    switch (method.toLowerCase()) {
      case 'get':
        response = await axios.get(`${BASE_URL}${endpoint}`, config);
        break;
      case 'post':
        response = await axios.post(`${BASE_URL}${endpoint}`, data, config);
        break;
      case 'delete':
        response = await axios.delete(`${BASE_URL}${endpoint}`, config);
        break;
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
    
    console.log('✅ Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed:', error.response?.data || error.message);
    throw error;
  }
}

// Check if we're running this script directly
if (require.main === module) {
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    const command = args[0];
    
    switch (command) {
      case 'health':
        testEndpoint('GET', '/api/health').catch(() => process.exit(1));
        break;
      case 'session':
        testEndpoint('POST', '/api/session').catch(() => process.exit(1));
        break;
      case 'gemini':
        testEndpoint('GET', '/test-gemini').catch(() => process.exit(1));
        break;
      default:
        console.log('Available commands: health, session, gemini');
        console.log('Or run without arguments to test all endpoints');
        process.exit(1);
    }
  } else {
    testAPI();
  }
}

module.exports = { testAPI, testEndpoint };