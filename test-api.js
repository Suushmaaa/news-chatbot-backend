require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testAPI() {
  try {
    console.log('🧪 Testing Backend API...\n');
    
    // Test 1: Health check
    console.log('1. Testing health check...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health:', health.data.status);
    
    // Test 2: Create session
    console.log('\n2. Creating new session...');
    const sessionResponse = await axios.post(`${BASE_URL}/session`);
    const sessionId = sessionResponse.data.sessionId;
    console.log('✅ Session created:', sessionId);
    
    // Test 3: Send chat messages
    const testMessages = [
      'Hello, what can you tell me?',
      'What\'s new in AI technology?',
      'Tell me about climate change news'
    ];
    
    for (let i = 0; i < testMessages.length; i++) {
      console.log(`\n${i + 3}. Sending message: "${testMessages[i]}"`);
      
      const chatResponse = await axios.post(`${BASE_URL}/chat`, {
        message: testMessages[i],
        sessionId: sessionId
      });
      
      console.log(`✅ Response: ${chatResponse.data.response.substring(0, 100)}...`);
      console.log(`📊 Sources: ${chatResponse.data.sources.length}`);
      console.log(`📰 Is News Query: ${chatResponse.data.isNewsQuery}`);
    }
    
    // Test 4: Get session history
    console.log('\n6. Getting session history...');
    const historyResponse = await axios.get(`${BASE_URL}/session/${sessionId}/history`);
    console.log(`✅ History: ${historyResponse.data.count} messages`);
    
    // Test 5: Clear session
    console.log('\n7. Clearing session...');
    const clearResponse = await axios.delete(`${BASE_URL}/session/${sessionId}`);
    console.log('✅ Session cleared:', clearResponse.data.success);
    
    console.log('\n🎉 All API tests passed!');
    
  } catch (error) {
    console.error('❌ API test failed:', error.response?.data || error.message);
  }
}

// Run tests
testAPI();