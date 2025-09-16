require('dotenv').config();
const GeminiService = require('./services/geminiService');

async function testGemini() {
  const gemini = new GeminiService();
  
  try {
    const response = await gemini.testConnection();
    console.log('✅ Gemini Response:', response);
  } catch (error) {
    console.error('❌ Gemini test failed:', error.message);
    console.log('Make sure you have a valid GEMINI_API_KEY in your .env file');
  }
}

testGemini();