require('dotenv').config();
const RAGService = require('./services/ragService');

async function testFix() {
  try {
    console.log('🧪 Testing RAG service instantiation...');
    
    const ragService = new RAGService();
    console.log('✅ RAGService instantiated successfully');
    
    console.log('🔧 Initializing...');
    await ragService.initialize();
    console.log('✅ Initialization successful');
    
    console.log('Testing addDocument method...');
    const testDoc = {
      content: 'Test article about AI developments',
      metadata: {
        filename: 'test-article',
        article_title: 'Test AI Article',
        category: 'AI'
      }
    };
    
    const docId = await ragService.addDocument(testDoc.content, testDoc.metadata);
    console.log('✅ addDocument works! Document ID:', docId);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFix();