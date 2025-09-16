require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Import services
const RAGService = require('./services/ragService');
const SessionManager = require('./services/sessionManager');
const GeminiService = require('./services/geminiService');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
let ragService;
let sessionManager;
let geminiService;

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Initialize services on startup
async function initializeServices() {
  try {
    console.log('🚀 Initializing services...');
    
    // Initialize RAG Service
    ragService = new RAGService();
    await ragService.initialize();
    console.log('✅ RAG service initialized');
    
    // Initialize Session Manager
    sessionManager = new SessionManager();
    await sessionManager.testConnection();
    console.log('✅ Session manager initialized');
    
    // Initialize Gemini Service
    geminiService = new GeminiService();
    console.log('✅ Gemini service initialized');
    
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    // Don't exit immediately, let the server start but show warning
  }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      rag: !!ragService,
      session: !!sessionManager,
      gemini: !!geminiService
    }
  });
});

// Alternative health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Test Gemini connection
app.get('/test-gemini', async (req, res) => {
  try {
    if (!geminiService) {
      return res.status(503).json({ success: false, error: 'Gemini service not initialized' });
    }
    const response = await geminiService.testConnection();
    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new session
app.post('/api/session', async (req, res) => {
  try {
    if (!sessionManager) {
      return res.status(503).json({ success: false, error: 'Session manager not initialized' });
    }
    const sessionId = await sessionManager.createSession();
    res.json({ 
      success: true, 
      sessionId,
      message: 'Session created successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    if (!sessionManager) {
      return res.status(503).json({ success: false, error: 'Session manager not initialized' });
    }
    const sessionId = uuidv4();
    await sessionManager.createSession(sessionId);
    res.json({ sessionId });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get session history
app.get('/api/session/:sessionId/history', async (req, res) => {
  try {
    if (!sessionManager) {
      return res.status(503).json({ success: false, error: 'Session manager not initialized' });
    }
    const { sessionId } = req.params;
    const { limit = 20 } = req.query;
    
    const history = await sessionManager.getMessageHistory(sessionId, parseInt(limit));
    
    res.json({ 
      success: true, 
      sessionId,
      messages: history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/sessions/:sessionId/history', async (req, res) => {
  try {
    if (!sessionManager) {
      return res.status(503).json({ success: false, error: 'Session manager not initialized' });
    }
    const { sessionId } = req.params;
    const history = await sessionManager.getMessageHistory(sessionId);
    
    res.json({ 
      messages: history || []
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Clear session
app.delete('/api/session/:sessionId', async (req, res) => {
  try {
    if (!sessionManager) {
      return res.status(503).json({ success: false, error: 'Session manager not initialized' });
    }
    const { sessionId } = req.params;
    const success = await sessionManager.clearSession(sessionId);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Session cleared successfully' 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    if (!sessionManager) {
      return res.status(503).json({ success: false, error: 'Session manager not initialized' });
    }
    const { sessionId } = req.params;
    const success = await sessionManager.clearSession(sessionId);
    res.json({ success: true, message: 'Session cleared' });
  } catch (error) {
    console.error('Error clearing session:', error);
    res.status(500).json({ error: 'Failed to clear session' });
  }
});

// MAIN CHAT ENDPOINT - FIXED VERSION
app.post('/api/chat', async (req, res) => {
  try {
    console.log('📨 /api/chat endpoint hit!');
    console.log('Request body:', req.body);
    
    if (!ragService || !sessionManager || !geminiService) {
      return res.status(503).json({ 
        success: false, 
        error: 'Services not initialized yet. Please try again in a moment.' 
      });
    }

    const { message, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Session ID is required' 
      });
    }

    console.log(`💬 Processing chat message for session: ${sessionId}`);
    
    // Add user message to session
    const userMessage = {
      type: 'user',
      content: message,
      role: 'user',
      timestamp: new Date().toISOString()
    };
    
    await sessionManager.addMessage(sessionId, userMessage);
    
    // Get AI response using RAG service
    let ragResponse;
    try {
      ragResponse = await ragService.query(message);
    } catch (ragError) {
      console.warn('RAG service failed, falling back to Gemini only:', ragError.message);
      // Fallback to direct Gemini service
      const geminiResponse = await geminiService.generateResponse(message);
      ragResponse = {
        answer: geminiResponse,
        sources: [],
        isNewsQuery: false,
        retrievedDocs: 0
      };
    }
    
    // Add AI response to session
    const aiMessage = {
      type: 'assistant',
      content: ragResponse.answer,
      role: 'assistant',
      sources: ragResponse.sources || [],
      isNewsQuery: ragResponse.isNewsQuery || false,
      retrievedDocs: ragResponse.retrievedDocs || 0,
      timestamp: new Date().toISOString()
    };
    
    await sessionManager.addMessage(sessionId, aiMessage);
    
    // Extend session TTL if method exists
    if (sessionManager.extendSession) {
      await sessionManager.extendSession(sessionId);
    }
    
    res.json({
      success: true,
      response: ragResponse.answer,
      sources: ragResponse.sources || [],
      isNewsQuery: ragResponse.isNewsQuery || false,
      sessionId: sessionId,
      metadata: {
        retrievedDocs: ragResponse.retrievedDocs || 0,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'An error occurred while processing your message',
      details: error.message
    });
  }
});

// Get active sessions (for debugging)
app.get('/api/sessions', async (req, res) => {
  try {
    if (!sessionManager) {
      return res.status(503).json({ success: false, error: 'Session manager not initialized' });
    }
    const sessions = await sessionManager.getActiveSessions();
    res.json({ 
      success: true, 
      sessions,
      count: sessions.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Upload document for RAG indexing
app.post('/api/documents', async (req, res) => {
  try {
    if (!ragService) {
      return res.status(503).json({ success: false, error: 'RAG service not initialized' });
    }
    const { content, filename, metadata = {} } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Document content is required'
      });
    }

    const documentId = await ragService.addDocument(content, {
      filename: filename || 'untitled',
      ...metadata,
      uploadedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      documentId,
      message: 'Document indexed successfully'
    });

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get document list
app.get('/api/documents', async (req, res) => {
  try {
    if (!ragService) {
      return res.status(503).json({ success: false, error: 'RAG service not initialized' });
    }
    const { limit = 50, offset = 0 } = req.query;
    const documents = await ragService.getDocuments(parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      documents,
      count: documents.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete document
app.delete('/api/documents/:documentId', async (req, res) => {
  try {
    if (!ragService) {
      return res.status(503).json({ success: false, error: 'RAG service not initialized' });
    }
    const { documentId } = req.params;
    const success = await ragService.deleteDocument(documentId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Search documents
app.post('/api/search', async (req, res) => {
  try {
    if (!ragService) {
      return res.status(503).json({ success: false, error: 'RAG service not initialized' });
    }
    const { query, limit = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const results = await ragService.searchDocuments(query, parseInt(limit));
    
    res.json({
      success: true,
      query,
      results,
      count: results.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to list all routes
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  res.json({ routes });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use( (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    if (ragService && ragService.cleanup) {
      await ragService.cleanup();
    }
    if (sessionManager && sessionManager.cleanup) {
      await sessionManager.cleanup();
    }
    console.log('✅ Services cleaned up successfully');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function startServer() {
  try {
    await initializeServices();
    
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`📍 API endpoints:`);
      console.log(`   - GET  /api/health (health check)`);
      console.log(`   - GET  /health (alternative health check)`);
      console.log(`   - GET  /test-gemini (test Gemini connection)`);
      console.log(`   - POST /api/session (create session)`);
      console.log(`   - POST /api/sessions (alternative create session)`);
      console.log(`   - POST /api/chat (send message)`);
      console.log(`   - GET  /api/session/:id/history (get history)`);
      console.log(`   - GET  /api/sessions/:id/history (alternative get history)`);
      console.log(`   - DELETE /api/session/:id (clear session)`);
      console.log(`   - DELETE /api/sessions/:id (alternative clear session)`);
      console.log(`   - GET  /api/sessions (get active sessions)`);
      console.log(`   - POST /api/documents (upload document)`);
      console.log(`   - GET  /api/documents (list documents)`);
      console.log(`   - DELETE /api/documents/:id (delete document)`);
      console.log(`   - POST /api/search (search documents)`);
      console.log(`   - GET  /api/debug/routes (debug routes)`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Export app for testing
module.exports = app;

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}