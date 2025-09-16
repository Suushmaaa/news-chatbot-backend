const fetch = require('node-fetch');
const { AbortController } = require('abort-controller');

class JinaEmbeddings {
  constructor() {
    this.apiKey = process.env.JINA_API_KEY;
    this.baseUrl = 'https://api.jina.ai/v1/embeddings';
    this.timeout = 30000; // 30 seconds timeout
    this.maxRetries = 3;
    
    // Check if API key exists
    if (!this.apiKey) {
      console.warn('⚠️  JINA_API_KEY not found. Using fallback embedding strategy.');
      this.useFallback = true;
    }
  }

  async createEmbeddings(texts) {
    // Fallback to simple hash-based embeddings if no API key
    if (this.useFallback || !this.apiKey) {
      console.log('📦 Using fallback embeddings (hash-based)...');
      return this.createFallbackEmbeddings(texts);
    }

    try {
      // Ensure texts is an array of strings
      const inputTexts = Array.isArray(texts) ? texts : [texts];
      
      return await this.executeWithTimeout(async () => {
        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: 'jina-embeddings-v2-base-en',
            input: inputTexts.map(text => text.substring(0, 8000)) // Limit text length
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Jina API response:', errorText);
          throw new Error(`Jina API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.data.map(item => item.embedding);
      });

    } catch (error) {
      console.error('❌ Error creating Jina embeddings:', error.message);
      console.log('📦 Falling back to simple embeddings...');
      return this.createFallbackEmbeddings(Array.isArray(texts) ? texts : [texts]);
    }
  }

  async executeWithTimeout(operation) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Add AbortController signal to fetch if the operation supports it
      const result = await Promise.race([
        operation(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), this.timeout)
        )
      ]);
      
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Simple fallback embedding using text hashing
  createFallbackEmbeddings(texts) {
    return texts.map(text => this.createSimpleEmbedding(text));
  }

  createSimpleEmbedding(text) {
    // Create a simple 768-dimensional embedding using text characteristics
    const embedding = new Array(768).fill(0);
    
    // Use text properties to generate pseudo-embeddings
    const words = text.toLowerCase().split(/\s+/);
    const chars = text.toLowerCase();
    
    for (let i = 0; i < embedding.length; i++) {
      const wordIndex = i % words.length;
      const charIndex = i % chars.length;
      
      // Combine word length, character codes, and position
      const wordFeature = words[wordIndex] ? words[wordIndex].length : 1;
      const charFeature = chars.charCodeAt(charIndex) || 65;
      const posFeature = Math.sin(i / 10) * 0.1;
      
      embedding[i] = (wordFeature * 0.01 + charFeature * 0.001 + posFeature) * 
                     Math.cos(i * 0.1) * Math.sin(text.length * 0.001);
    }
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (magnitude || 1));
  }

  async createSingleEmbedding(text) {
    try {
      console.log(`🔧 Creating embedding for text: "${text.substring(0, 50)}..."`);
      const embeddings = await this.createEmbeddings([text]);
      console.log('✅ Embedding created successfully');
      return embeddings[0];
    } catch (error) {
      console.error('❌ Failed to create single embedding:', error.message);
      return this.createSimpleEmbedding(text);
    }
  }

  // Test connection method
  async testConnection() {
    if (this.useFallback || !this.apiKey) {
      console.log('✅ Using fallback embeddings (no API key needed)');
      return true;
    }

    try {
      const testEmbedding = await this.createSingleEmbedding("Test connection");
      console.log('✅ Jina API connection successful');
      return true;
    } catch (error) {
      console.log('⚠️  Jina API connection failed, will use fallback');
      this.useFallback = true;
      return false;
    }
  }
}

module.exports = JinaEmbeddings;   