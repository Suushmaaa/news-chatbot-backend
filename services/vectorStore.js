const { QdrantClient } = require('@qdrant/js-client-rest');
const { v4: uuidv4 } = require('uuid');

class VectorStore {
  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY
    });
    this.collectionName = 'news_articles';
  }

  async initializeCollection() {
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        collection => collection.name === this.collectionName
      );

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 768, // Jina embeddings dimension
            distance: 'Cosine'
          }
        });
        console.log(`✅ Created collection: ${this.collectionName}`);
      } else {
        console.log(`✅ Collection already exists: ${this.collectionName}`);
      }
    } catch (error) {
      console.error('Error initializing collection:', error);
      throw error;
    }
  }

  async addDocument(id, embedding, metadata) {
    try {
      // Generate UUID for the point ID
      const pointId = uuidv4();
      
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [{
          id: pointId,
          vector: embedding,
          payload: {
            ...metadata,
            original_id: id // Keep original ID in metadata
          }
        }]
      });
      
      return pointId; // Return the UUID for reference
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  async addDocuments(documents) {
    try {
      const points = documents.map(doc => ({
        id: uuidv4(), // Generate UUID for each point
        vector: doc.embedding,
        payload: {
          ...doc.metadata,
          original_id: doc.id // Keep original ID in metadata
        }
      }));

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: points
      });

      console.log(`✅ Added ${points.length} documents to vector store`);
      return points.map(p => p.id); // Return UUIDs for reference
    } catch (error) {
      console.error('Error adding documents:', error);
      throw error;
    }
  }

  async search(queryVector, topK = 5) {
    try {
      const searchResult = await this.client.search(this.collectionName, {
        vector: queryVector,
        limit: topK,
        with_payload: true
      });

      return searchResult.map(result => ({
        id: result.payload.original_id || result.id, // Use original ID if available
        uuid: result.id, // Keep UUID for reference
        score: result.score,
        metadata: result.payload
      }));
    } catch (error) {
      console.error('Error searching:', error);
      throw error;
    }
  }

  async getCollectionInfo() {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        ...info,
        points_count: info.points_count || 0,
        vectors_count: info.vectors_count || 0
      };
    } catch (error) {
      console.error('Error getting collection info:', error);
      throw error;
    }
  }

  // Helper method to clear collection (useful for testing)
  async clearCollection() {
    try {
      await this.client.deleteCollection(this.collectionName);
      await this.initializeCollection();
      console.log('✅ Collection cleared and recreated');
    } catch (error) {
      console.error('Error clearing collection:', error);
      throw error;
    }
  }
}

module.exports = VectorStore;

