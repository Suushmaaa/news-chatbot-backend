require('dotenv').config();
const RAGService = require('./services/ragService');

async function testNewsFocus() {
  const rag = new RAGService();
  
  try {
    await rag.initialize();
    
    const testQueries = [
      // Should get news responses
      "What's new in AI technology?",
      "Tell me about climate change developments",
      "Any quantum computing news?",
      
      // Should get "news only" responses  
      "Hi there",
      "What is your name?",
      "How do I code in Python?",
      "What's 2 + 2?",
      "Tell me about my code"
    ];
    
    console.log('\n🧪 Testing News-Focused Chatbot...\n');
    
    for (const query of testQueries) {
      console.log(`\n📝 Query: "${query}"`);
      console.log('─'.repeat(60));
      
      const result = await rag.query(query);
      
      console.log(`📋 Response Type: ${result.isNewsQuery ? 'NEWS' : 'NON-NEWS'}`);
      console.log(`📄 Answer: ${result.answer.substring(0, 200)}...`);
      
      if (result.sources && result.sources.length > 0) {
        console.log(`📚 Sources: ${result.sources.length} articles`);
      }
      
      console.log('═'.repeat(80));
      
      // Small delay between queries
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testNewsFocus();