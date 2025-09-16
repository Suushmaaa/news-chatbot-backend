require('dotenv').config();
const RAGService = require('./services/ragService');

async function testRAG() {
  const rag = new RAGService();
  
  try {
    // Initialize RAG system
    await rag.initialize();
    
    // Test queries
    const testQueries = [
      "What's happening with AI technology?",
      "Tell me about climate change news",
      "Any updates on electric vehicles?",
      "What's new in quantum computing?"
    ];
    
    console.log('\n🧪 Testing RAG queries...\n');
    
    for (const query of testQueries) {
      console.log(`\n📝 Query: "${query}"`);
      console.log('─'.repeat(50));
      
      const result = await rag.query(query);
      
      console.log('📋 Answer:');
      console.log(result.answer);
      
      console.log('\n📚 Sources:');
      result.sources.forEach((source, i) => {
        console.log(`${i + 1}. ${source.title} (Score: ${source.score.toFixed(3)})`);
      });
      
      console.log('\n' + '='.repeat(80));
    }
    
  } catch (error) {
    console.error('❌ RAG test failed:', error);
  }
}

testRAG();