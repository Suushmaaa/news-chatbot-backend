require('dotenv').config();
const DocumentProcessor = require('./services/documentProcessor');

async function testPipeline() {
  const processor = new DocumentProcessor();
  
  try {
    // Process articles and store in vector database
    const result = await processor.processArticles();
    
    console.log('📊 Processing Results:');
    console.log('- Articles processed:', result.totalArticles);
    console.log('- Chunks created:', result.totalChunks);
    console.log('- Collection points:', result.collectionInfo.points_count);
    
    // Test search
    console.log('\n🔍 Testing search...');
    const searchResults = await processor.searchSimilarChunks('technology news', 3);
    
    console.log('Search results:');
    searchResults.forEach((result, i) => {
      console.log(`${i + 1}. Score: ${result.score.toFixed(3)}`);
      console.log(`   Title: ${result.metadata.article_title}`);
      console.log(`   Content: ${result.metadata.content.substring(0, 100)}...`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Pipeline test failed:', error);
  }
}

testPipeline();