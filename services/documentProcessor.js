const NewsIngestion = require('./newsIngestion');
const JinaEmbeddings = require('./jinaEmbeddings');
const VectorStore = require('./vectorStore');
const { v4: uuidv4 } = require('uuid');

class DocumentProcessor {
  constructor() {
    console.log('🔧 Initializing DocumentProcessor...');
    this.newsIngestion = new NewsIngestion();
    this.embeddings = new JinaEmbeddings();
    this.vectorStore = new VectorStore();
    console.log('✅ DocumentProcessor initialized');
  }

  chunkText(text, maxLength = 500, overlap = 50) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + maxLength, text.length);
      
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastExclamation = text.lastIndexOf('!', end);
        const lastQuestion = text.lastIndexOf('?', end);
        
        const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
        
        if (lastSentenceEnd > start + 100) {
          end = lastSentenceEnd + 1;
        }
      }
      
      const chunk = text.substring(start, end).trim();
      if (chunk.length > 50) {
        chunks.push(chunk);
      }
      
      start = end - overlap;
    }

    return chunks;
  }

  async processArticles() {
    try {
      console.log('🚀 Starting real news processing pipeline...');
      
      // Step 1: Test embeddings first
      console.log('🔧 Testing embeddings connection...');
      await this.embeddings.testConnection();
      console.log('✅ Embeddings connection tested');
      
      // Step 2: Initialize vector store
      console.log('🔧 Initializing vector store...');
      await this.vectorStore.initializeCollection();
      console.log('✅ Vector store initialized');
      
      // Step 3: Ingest real news articles from RSS
      console.log('📰 Ingesting real news articles from RSS feeds...');
      const articles = await this.newsIngestion.ingestNews();
      console.log(`✅ Ingested ${articles.length} real news articles`);
      
      if (articles.length === 0) {
        throw new Error('No articles were ingested from RSS feeds');
      }
      
      console.log(`📚 Processing ${articles.length} articles...`);
      
      const processedDocs = [];
      
      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        console.log(`\n📄 Processing article ${i + 1}/${articles.length}:`);
        console.log(`   Title: ${article.title.substring(0, 50)}...`);
        console.log(`   URL: ${article.url}`);
        
        const fullText = `${article.title}\n\n${article.content}`;
        console.log(`   Full text length: ${fullText.length} characters`);
        
        const chunks = this.chunkText(fullText);
        console.log(`   Created ${chunks.length} chunks`);
        
        for (let j = 0; j < chunks.length; j++) {
          const chunkId = `${article.id}_chunk_${j}`;
          console.log(`\n  🔧 Processing chunk ${j + 1}/${chunks.length} (${chunkId})`);
          console.log(`     Chunk length: ${chunks[j].length} characters`);
          
          try {
            console.log(`     🔧 Creating embedding...`);
            const startTime = Date.now();
            
            const embedding = await this.embeddings.createSingleEmbedding(chunks[j]);
            
            const endTime = Date.now();
            console.log(`     ✅ Embedding created in ${endTime - startTime}ms`);
            
            processedDocs.push({
              id: chunkId,
              embedding: embedding,
              metadata: {
                article_id: article.id,
                article_title: article.title,
                article_url: article.url,
                chunk_index: j,
                total_chunks: chunks.length,
                content: chunks[j],
                publish_date: article.publishDate,
                source: 'reuters_rss'
              }
            });
            
            console.log(`     ✅ Chunk processed successfully`);
            
            // Small delay to prevent overwhelming APIs
            await new Promise(resolve => setTimeout(resolve, 300));
            
          } catch (error) {
            console.error(`     ❌ Error processing chunk ${chunkId}:`, error.message);
            // Continue processing other chunks
          }
        }
        
        console.log(`✅ Article ${i + 1} completed. Total processed docs: ${processedDocs.length}`);
        
        // Save progress every 10 articles
        if ((i + 1) % 10 === 0 && processedDocs.length > 0) {
          console.log(`💾 Saving progress: ${processedDocs.length} chunks...`);
          await this.vectorStore.addDocuments(processedDocs.splice(0));
          console.log(`✅ Progress saved`);
        }
      }
      
      // Save any remaining documents
      if (processedDocs.length > 0) {
        console.log(`💾 Storing final ${processedDocs.length} chunks in vector database...`);
        const storeStartTime = Date.now();
        
        await this.vectorStore.addDocuments(processedDocs);
        
        const storeEndTime = Date.now();
        console.log(`✅ Documents stored in ${storeEndTime - storeStartTime}ms`);
      }
      
      console.log('🔧 Getting collection info...');
      const collectionInfo = await this.vectorStore.getCollectionInfo();
      console.log('✅ Collection info retrieved');
      
      console.log('🎉 Real news processing completed successfully!');
      
      return {
        totalArticles: articles.length,
        totalChunks: processedDocs.length,
        collectionInfo: collectionInfo
      };
      
    } catch (error) {
      console.error('❌ FATAL ERROR in document processing:');
      console.error('📍 Error message:', error.message);
      console.error('📍 Stack trace:', error.stack);
      throw error;
    }
  }

  async searchSimilarChunks(query, topK = 5) {
    try {
      console.log(`🔍 Searching for: "${query.substring(0, 50)}..."`);
      const queryEmbedding = await this.embeddings.createSingleEmbedding(query);
      console.log('✅ Query embedding created');
      
      const results = await this.vectorStore.search(queryEmbedding, topK);
      console.log(`✅ Found ${results.length} similar chunks`);
      
      return results;
    } catch (error) {
      console.error('❌ Error searching chunks:', error);
      throw error;
    }
  }

  // Method to check if we have real news data
  async hasRealNewsData() {
    try {
      const info = await this.vectorStore.getCollectionInfo();
      return info.vectors_count > 1; // More than just test data
    } catch (error) {
      return false;
    }
  }

  // Method to refresh news data
  async refreshNewsData() {
    console.log('🔄 Refreshing news data...');
    
    // Clear existing collection
    try {
      await this.vectorStore.deleteCollection();
      console.log('🗑️ Cleared old data');
    } catch (error) {
      console.log('ℹ️ No old data to clear');
    }
    
    // Process new articles
    return await this.processArticles();
  }
}

module.exports = DocumentProcessor;