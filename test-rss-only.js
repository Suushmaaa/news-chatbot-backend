// Simple RSS test
require('dotenv').config();

const NewsIngestion = require('./services/newsIngestion');

async function testRSS() {
  console.log('🧪 Testing RSS ingestion only...');
  
  const newsIngestion = new NewsIngestion();
  
  // Test single feed first
  console.log('\n1️⃣ Testing single RSS feed...');
  try {
    const testResult = await newsIngestion.testSingleFeed();
    console.log('Single feed test result:', testResult);
  } catch (error) {
    console.error('Single feed test failed:', error.message);
  }
  
  // Test full ingestion
  console.log('\n2️⃣ Testing full RSS ingestion...');
  try {
    const articles = await newsIngestion.ingestNews();
    console.log(`✅ RSS test complete: ${articles.length} articles`);
    
    if (articles.length > 0) {
      console.log('\nSample article:');
      console.log('Title:', articles[0].title);
      console.log('Content length:', articles[0].content.length);
      console.log('URL:', articles[0].url);
    }
    
  } catch (error) {
    console.error('Full ingestion test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testRSS();