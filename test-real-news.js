require('dotenv').config();
delete require.cache[require.resolve('./services/newsIngestion')];
const DocumentProcessor = require('./services/documentProcessor');

async function testRealNews() {
  console.log('🚀 Testing Real News Ingestion...');
  
  const processor = new DocumentProcessor();
  
  try {
    const result = await processor.processArticles();
    console.log('✅ SUCCESS!');
    console.log('📊 Results:', result);
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

testRealNews();