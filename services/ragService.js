const DocumentProcessor = require('./documentProcessor');
const GeminiService = require('./geminiService');

class RAGService {
  constructor() {
    this.documentProcessor = new DocumentProcessor();
    this.geminiService = new GeminiService();
    this.minRelevanceScore = 0.3; // Threshold for news relevance
  }

  async initialize() {
    console.log('🔧 Initializing RAG system...');
    
    try {
      const testResponse = await this.geminiService.testConnection();
      console.log('✅ Gemini API:', testResponse);
      
      const collectionInfo = await this.documentProcessor.vectorStore.getCollectionInfo();
      console.log(`✅ Vector store has ${collectionInfo.points_count} documents`);
      
      if (collectionInfo.points_count === 0) {
        console.log('📚 No documents found, processing articles...');
        await this.documentProcessor.processArticles();
      }
      
      console.log('✅ RAG system initialized successfully!');
      
    } catch (error) {
      console.error('❌ RAG initialization failed:', error);
      throw error;
    }
  }
  async addDocument(content, metadata = {}) {
    try {
      console.log(`📄 Adding document: ${metadata.filename || 'untitled'}`);
      
      // Create embedding for the content
      const embedding = await this.documentProcessor.jinaEmbeddings.createEmbedding(content);
      
      // Generate unique ID
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store in vector database
      await this.documentProcessor.vectorStore.upsert([{
        id: docId,
        vector: embedding,
        metadata: {
          ...metadata,
          content: content,
          uploadedAt: new Date().toISOString()
        }
      }]);
      
      console.log(`✅ Document added with ID: ${docId}`);
      return docId;
      
    } catch (error) {
      console.error('❌ Error adding document:', error);
      throw error;
    }
  }

  async query(userQuery, topK = 5) {
    try {
      console.log(`🔍 Processing query: "${userQuery}"`);
      
      // Step 1: Retrieve relevant documents
      const relevantDocs = await this.documentProcessor.searchSimilarChunks(userQuery, topK);
      
      // Step 2: Filter by relevance threshold
      const highRelevanceDocs = relevantDocs.filter(doc => doc.score > this.minRelevanceScore);
      
      console.log(`📊 Found ${relevantDocs.length} total docs, ${highRelevanceDocs.length} highly relevant (score > ${this.minRelevanceScore})`);
      
      // Step 3: Check if query is news-related
      if (highRelevanceDocs.length === 0) {
        return this.getNonNewsResponse(userQuery);
      }
      
      // Step 4: Generate news-based answer
      console.log(`📄 Using ${highRelevanceDocs.length} relevant documents for answer`);
      
      const answer = await this.geminiService.generateResponse(userQuery, highRelevanceDocs);
      
      const sources = highRelevanceDocs.map(doc => ({
        title: doc.metadata.article_title,
        url: doc.metadata.article_url,
        snippet: doc.metadata.content.substring(0, 150) + '...',
        score: doc.score,
        publishDate: doc.metadata.publish_date
      }));
      
      return {
        answer: answer,
        sources: sources,
        query: userQuery,
        retrievedDocs: highRelevanceDocs.length,
        isNewsQuery: true
      };
      
    } catch (error) {
      console.error('❌ RAG query failed:', error);
      return {
        answer: "I encountered an error while processing your question. Please try again.",
        sources: [],
        query: userQuery,
        error: error.message,
        isNewsQuery: false
      };
    }
  }

  getNonNewsResponse(userQuery) {
    // Categorize the type of non-news query for better responses
    const lowerQuery = userQuery.toLowerCase();
    
    let response = "I'm a news chatbot designed to answer questions about current news articles. ";
    
    if (this.isGreeting(lowerQuery)) {
      response += "Hello! I can help you find information about recent news. Try asking me about topics like:\n\n";
    } else if (this.isPersonalQuestion(lowerQuery)) {
      response += "I don't have personal experiences, but I can help you with news information. Try asking about:\n\n";
    } else {
      response += "I couldn't find relevant news articles for your query. Please ask me about current events like:\n\n";
    }
    
    response += "• Technology and AI developments\n";
    response += "• Climate and environmental news\n";
    response += "• Business and economic updates\n";
    response += "• Scientific breakthroughs\n";
    response += "• Global events and politics";
    
    return {
      answer: response,
      sources: [],
      query: userQuery,
      isNewsQuery: false,
      suggestion: "Try asking: 'What's new in technology?' or 'Tell me about climate news'"
    };
  }

  isGreeting(query) {
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good evening', 'how are you'];
    return greetings.some(greeting => query.includes(greeting));
  }

  isPersonalQuestion(query) {
    const personalKeywords = ['who are you', 'what are you', 'your name', 'about yourself', 'tell me about you'];
    return personalKeywords.some(keyword => query.includes(keyword));
  }

  // Method to get available news topics
  async getAvailableTopics() {
    try {
      const collectionInfo = await this.documentProcessor.vectorStore.getCollectionInfo();
      
      // Get a sample of documents to show what topics are available
      const sampleResults = await this.documentProcessor.vectorStore.search(
        new Array(768).fill(0), // Zero vector to get random results
        10
      );
      
      const topics = sampleResults.map(doc => doc.metadata.article_title);
      
      return {
        totalArticles: collectionInfo.points_count,
        sampleTopics: topics.slice(0, 5)
      };
    } catch (error) {
      console.error('Error getting topics:', error);
      return { totalArticles: 0, sampleTopics: [] };
    }
  }
}
                 

module.exports = RAGService;