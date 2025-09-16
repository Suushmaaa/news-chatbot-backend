// Save this as: backend/load-news.js

require('dotenv').config();
const DocumentProcessor = require('./services/documentProcessor');

async function loadNewsArticles() {
  console.log('🚀 Starting news loading process...');
  
  try {
    // Initialize document processor
    const docProcessor = new DocumentProcessor();
    
    // Check current status
    console.log('📊 Checking current vector store status...');
    const currentInfo = await docProcessor.vectorStore.getCollectionInfo();
    console.log(`Current documents in vector store: ${currentInfo.points_count}`);
    
    if (currentInfo.points_count > 0) {
      console.log('⚠️  Vector store already has documents.');
      console.log('Do you want to:');
      console.log('1. Add more documents (keep existing)');
      console.log('2. Replace all documents (clear and reload)');
      
      // For now, let's just add more
      console.log('📚 Adding more news articles...');
    } else {
      console.log('📚 Vector store is empty. Loading fresh news articles...');
    }
    
    // Process articles from RSS feeds
    console.log('🔄 Processing real news articles...');
    const result = await docProcessor.processArticles();
    
    console.log('🎉 News loading completed successfully!');
    console.log(`📊 Results:`);
    console.log(`   - Articles processed: ${result.totalArticles}`);
    console.log(`   - Text chunks created: ${result.totalChunks}`);
    console.log(`   - Total documents in vector store: ${result.collectionInfo.points_count}`);
    
    // Test search functionality
    console.log('\n🔍 Testing search functionality...');
    const testResults = await docProcessor.searchSimilarChunks('climate change news', 3);
    console.log(`Found ${testResults.length} relevant chunks for "climate change news"`);
    
    if (testResults.length > 0) {
      console.log('\nSample search results:');
      testResults.forEach((result, index) => {
        console.log(`${index + 1}. Score: ${result.score.toFixed(3)}`);
        console.log(`   Title: ${result.metadata.article_title}`);
        console.log(`   Content: ${result.metadata.content.substring(0, 100)}...`);
        console.log('');
      });
    }
    
    console.log('✅ Your news chatbot is now ready to use!');
    console.log('💡 Try asking: "What\'s the latest news?" or "Tell me about recent developments"');
    
    return result;
    
  } catch (error) {
    console.error('❌ Error loading news articles:', error);
    console.error('Stack trace:', error.stack);
    
    // Provide helpful debugging info
    console.log('\n🔧 Debugging information:');
    console.log('Environment variables check:');
    console.log(`- JINA_API_KEY: ${process.env.JINA_API_KEY ? 'Set' : 'Missing'}`);
    console.log(`- QDRANT_URL: ${process.env.QDRANT_URL ? 'Set' : 'Missing'}`);
    console.log(`- QDRANT_API_KEY: ${process.env.QDRANT_API_KEY ? 'Set' : 'Missing'}`);
    
    throw error;
  }
}

// Add a simple test function
async function testRSSFeeds() {
  console.log('🧪 Testing RSS feed connectivity...');
  
  try {
    const NewsIngestion = require('./services/newsIngestion');
    const newsIngestion = new NewsIngestion();
    
    const result = await newsIngestion.testSingleFeed();
    if (result) {
      console.log('✅ RSS feeds are working!');
      return true;
    } else {
      console.log('❌ RSS feeds failed');
      return false;
    }
  } catch (error) {
    console.error('❌ RSS test error:', error);
    return false;
  }
}

// Main execution
if (require.main === module) {
  async function main() {
    console.log('🌟 News Chatbot Setup Script');
    console.log('============================\n');
    
    // Test RSS first
    const rssWorking = await testRSSFeeds();
    if (!rssWorking) {
      console.log('❌ RSS feeds not working. Check your internet connection.');
      process.exit(1);
    }
    
    // Load news articles
    try {
      await loadNewsArticles();
      console.log('\n🎉 Setup completed successfully!');
      console.log('Your news chatbot should now work properly.');
    } catch (error) {
      console.log('\n❌ Setup failed. Please check the error messages above.');
      process.exit(1);
    }
  }
  
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { loadNewsArticles, testRSSFeeds };