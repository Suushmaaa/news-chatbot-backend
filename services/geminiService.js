const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Using gemini-1.5-flash with generation config for better reliability
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });
    
    // Retry configuration
    this.maxRetries = 5;
    this.baseDelay = 1000; // 1 second
  }

  async generateResponse(query, context) {
    return await this.executeWithRetry(async () => {
      const prompt = this.buildPrompt(query, context);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return response.text();
    });
  }

  async executeWithRetry(operation, attempt = 1) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Attempt ${attempt}/${this.maxRetries} failed:`, error.message);
      
      // Check if it's a retryable error (503, 429, network issues)
      const isRetryable = this.isRetryableError(error);
      
      if (attempt >= this.maxRetries || !isRetryable) {
        if (isRetryable) {
          // Return a fallback response for overload errors
          return this.getFallbackResponse();
        }
        throw error;
      }

      // Exponential backoff with jitter
      const delay = this.calculateDelay(attempt);
      console.log(`⚠️  Gemini API attempt ${attempt}/${this.maxRetries} failed. Retrying in ${delay/1000} seconds...`);
      
      await this.sleep(delay);
      return await this.executeWithRetry(operation, attempt + 1);
    }
  }

  isRetryableError(error) {
    if (!error.status) return false;
    
    // Retry on server errors and rate limiting
    return [503, 502, 504, 429, 500].includes(error.status) || 
           error.message.includes('overloaded') ||
           error.message.includes('rate limit') ||
           error.message.includes('network');
  }

  calculateDelay(attempt) {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s with jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getFallbackResponse() {
    return "I apologize, but I'm experiencing high traffic right now. Please try asking your question again in a moment. The news articles are available, but I need a moment to process your request.";
  }

  buildPrompt(query, context) {
    const contextText = context
      .map((item, index) => `[${index + 1}] ${item.metadata.content}`)
      .join('\n\n');

    return `You are a professional news chatbot that provides information based on current news articles. Answer the user's question using ONLY the provided news context.

CONTEXT (Current News Articles):
${contextText}

USER QUESTION: ${query}

INSTRUCTIONS:
- Answer based STRICTLY on the provided news articles
- Be informative and professional like a news reporter
- If the context doesn't fully answer the question, say so and suggest related topics from the articles
- Include specific details and facts from the news sources
- Maintain an objective, journalistic tone
- Do NOT make up information not present in the articles

NEWS RESPONSE:`;
  }

  async testConnection() {
    return await this.executeWithRetry(async () => {
      const result = await this.model.generateContent('Say "Hello, Gemini API is working!"');
      const response = await result.response;
      return response.text();
    });
  }
}

module.exports = GeminiService;