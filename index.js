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
app.use(cors({
     origin: [
       'http://localhost:3000',
       'https://new-chatbot-frontend.vercel.app',
       'https://new-chatbot-frontend-git-main-suushmaaas-projects.vercel.app',
      'https://new-chatbot-frontend-p8tr2ovhv-suushmaaas-projects.vercel.app'

     ],
     credentials: true
   }));
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

// Initialize services on startup with better error handling
async function initializeServices() {
  try {
    console.log('🚀 Initializing services...');
    
    // Initialize RAG Service
    try {
      ragService = new RAGService();
      await ragService.initialize();
      console.log('✅ RAG service initialized');
    } catch (error) {
      console.error('❌ RAG service failed to initialize:', error.message);
      ragService = null;
    }
    
    // Initialize Session Manager with error handling
    try {
      sessionManager = new SessionManager();
      await sessionManager.testConnection();
      console.log('✅ Session manager initialized');
    } catch (error) {
      console.error('❌ Session manager failed to initialize:', error.message);
      console.log('📝 Continuing without persistent sessions...');
      sessionManager = null;
    }
    
    // Initialize Gemini Service
    try {
      geminiService = new GeminiService();
      console.log('✅ Gemini service initialized');
    } catch (error) {
      console.error('❌ Gemini service failed to initialize:', error.message);
      geminiService = null;
    }
    
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    // Don't exit immediately, let the server start but show warning
  }
}

// ROOT ROUTE - Fixed the main issue
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'RAG API Server is running',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      rag: !!ragService,
      session: !!sessionManager,
      gemini: !!geminiService
    },
    endpoints: {
      health: '/api/health',
      chat: '/api/chat',
      sessions: '/api/sessions',
      documents: '/api/documents'
    }
  });
});

// API base route
app.get('/api', (req, res) => {
  res.json({ 
    success: true,
    message: 'RAG API Base',
    version: '1.0.0',
    services: {
      rag: !!ragService,
      session: !!sessionManager,
      gemini: !!geminiService
    },
    endpoints: [
      'GET /api/health - Health check',
      'POST /api/sessions - Create session', 
      'POST /api/chat - Send message',
      'GET /api/sessions/:id/history - Get chat history',
      'POST /api/documents - Upload document',
      'GET /api/documents - List documents',
      'POST /api/search - Search documents'
    ]
  });
});

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
    timestamp: new Date().toISOString(),
    services: {
      rag: !!ragService,
      session: !!sessionManager,
      gemini: !!geminiService
    }
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

// Create new session - with fallback for no session manager
app.post('/api/session', async (req, res) => {
  try {
    if (!sessionManager) {
      // Create in-memory session if no session manager
      const sessionId = uuidv4();
      return res.json({ 
        success: true, 
        sessionId,
        message: 'Session created successfully (in-memory)',
        warning: 'Session persistence not available'
      });
    }
    const sessionId = await sessionManager.createSession();
    res.json({ 
      success: true, 
      sessionId,
      message: 'Session created successfully'
    });
  } catch (error) {
    // Fallback to in-memory session
    const sessionId = uuidv4();
    res.json({ 
      success: true, 
      sessionId,
      message: 'Session created successfully (fallback)',
      warning: 'Session persistence failed: ' + error.message
    });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const sessionId = uuidv4();
    if (sessionManager) {
      try {
        await sessionManager.createSession(sessionId);
      } catch (error) {
        console.warn('Session manager failed, using in-memory session:', error.message);
      }
    }
    res.json({ sessionId });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get session history - with fallback
app.get('/api/session/:sessionId/history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 20 } = req.query;
    
    if (!sessionManager) {
      return res.json({ 
        success: true, 
        sessionId,
        messages: [],
        count: 0,
        warning: 'Session persistence not available'
      });
    }
    
    const history = await sessionManager.getMessageHistory(sessionId, parseInt(limit));
    
    res.json({ 
      success: true, 
      sessionId,
      messages: history,
      count: history.length
    });
  } catch (error) {
    res.json({ 
      success: true, 
      sessionId: req.params.sessionId,
      messages: [],
      count: 0,
      warning: 'Failed to fetch history: ' + error.message
    });
  }
});

app.get('/api/sessions/:sessionId/history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionManager) {
      return res.json({ messages: [] });
    }
    
    const history = await sessionManager.getMessageHistory(sessionId);
    res.json({ messages: history || [] });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.json({ messages: [] }); // Return empty array instead of error
  }
});

// Clear session - with fallback
app.delete('/api/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionManager) {
      return res.json({ 
        success: true, 
        message: 'Session cleared (in-memory sessions not persistent)' 
      });
    }
    
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
    res.json({ 
      success: true, 
      message: 'Session cleared (fallback)', 
      warning: error.message 
    });
  }
});

app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (sessionManager) {
      try {
        await sessionManager.clearSession(sessionId);
      } catch (error) {
        console.warn('Session manager failed to clear session:', error.message);
      }
    }
    
    res.json({ success: true, message: 'Session cleared' });
  } catch (error) {
    console.error('Error clearing session:', error);
    res.json({ success: true, message: 'Session cleared (fallback)' });
  }
});

// MAIN CHAT ENDPOINT - Enhanced with better fallback handling
app.post('/api/chat', async (req, res) => {
  try {
    console.log('📨 /api/chat endpoint hit!');
    console.log('Request body:', req.body);
    
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
    
    // Create user message
    const userMessage = {
      type: 'user',
      content: message,
      role: 'user',
      timestamp: new Date().toISOString()
    };
    
    // Try to add to session if available
    if (sessionManager) {
      try {
        await sessionManager.addMessage(sessionId, userMessage);
      } catch (error) {
        console.warn('Failed to save user message:', error.message);
      }
    }
    
    // Get AI response using available services
    let ragResponse;
    
    try {
      // Try RAG service first
      if (ragService) {
        ragResponse = await ragService.query(message);
      } else {
        throw new Error('RAG service not available');
      }
    } catch (ragError) {
      console.warn('RAG service failed, trying Gemini only:', ragError.message);
      
      // Fallback to direct Gemini service
      try {
        if (geminiService) {
          const geminiResponse = await geminiService.generateResponse(message);
          ragResponse = {
            answer: geminiResponse,
            sources: [],
            isNewsQuery: false,
            retrievedDocs: 0
          };
        } else {
          throw new Error('No AI services available');
        }
      } catch (geminiError) {
        console.error('All AI services failed:', geminiError.message);
        return res.status(503).json({
          success: false,
          error: 'AI services are currently unavailable. Please try again later.',
          details: 'Both RAG and Gemini services failed to respond'
        });
      }
    }
    
    // Create AI message
    const aiMessage = {
      type: 'assistant',
      content: ragResponse.answer,
      role: 'assistant',
      sources: ragResponse.sources || [],
      isNewsQuery: ragResponse.isNewsQuery || false,
      retrievedDocs: ragResponse.retrievedDocs || 0,
      timestamp: new Date().toISOString()
    };
    
    // Try to add AI response to session if available
    if (sessionManager) {
      try {
        await sessionManager.addMessage(sessionId, aiMessage);
        
        // Extend session TTL if method exists
        if (sessionManager.extendSession) {
          await sessionManager.extendSession(sessionId);
        }
      } catch (error) {
        console.warn('Failed to save AI message:', error.message);
      }
    }
    
    res.json({
      success: true,
      response: ragResponse.answer,
      sources: ragResponse.sources || [],
      isNewsQuery: ragResponse.isNewsQuery || false,
      sessionId: sessionId,
      metadata: {
        retrievedDocs: ragResponse.retrievedDocs || 0,
        timestamp: new Date().toISOString(),
        sessionPersistent: !!sessionManager
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

// Get active sessions (for debugging) - with fallback
app.get('/api/sessions', async (req, res) => {
  try {
    if (!sessionManager) {
      return res.json({ 
        success: true, 
        sessions: [],
        count: 0,
        warning: 'Session manager not available'
      });
    }
    
    const sessions = await sessionManager.getActiveSessions();
    res.json({ 
      success: true, 
      sessions,
      count: sessions.length
    });
  } catch (error) {
    res.json({ 
      success: true, 
      sessions: [],
      count: 0,
      warning: 'Failed to fetch sessions: ' + error.message
    });
  }
});

// Upload document for RAG indexing - with fallback
app.post('/api/documents', async (req, res) => {
  try {
    if (!ragService) {
      return res.status(503).json({ 
        success: false, 
        error: 'RAG service not available. Document indexing is currently disabled.' 
      });
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

// Get document list - with fallback
app.get('/api/documents', async (req, res) => {
  try {
    if (!ragService) {
      return res.json({
        success: true,
        documents: [],
        count: 0,
        warning: 'RAG service not available'
      });
    }
    
    const { limit = 50, offset = 0 } = req.query;
    const documents = await ragService.getDocuments(parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      documents,
      count: documents.length
    });
  } catch (error) {
    res.json({
      success: true,
      documents: [],
      count: 0,
      warning: 'Failed to fetch documents: ' + error.message
    });
  }
});

// Delete document - with fallback
app.delete('/api/documents/:documentId', async (req, res) => {
  try {
    if (!ragService) {
      return res.status(503).json({
        success: false,
        error: 'RAG service not available'
      });
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

// Search documents - with fallback
app.post('/api/search', async (req, res) => {
  try {
    if (!ragService) {
      return res.json({
        success: true,
        query: req.body.query || '',
        results: [],
        count: 0,
        warning: 'RAG service not available'
      });
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
    res.json({
      success: true,
      query: req.body.query || '',
      results: [],
      count: 0,
      warning: 'Search failed: ' + error.message
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
  res.json({ 
    success: true,
    routes,
    count: routes.length,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler - improved
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /api',
      'GET /api/health',
      'POST /api/sessions',
      'POST /api/chat',
      'GET /api/sessions/:id/history',
      'POST /api/documents',
      'GET /api/documents',
      'POST /api/search'
    ],
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown - enhanced
const gracefulShutdown = async (signal) => {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    if (ragService && ragService.cleanup) {
      console.log('🧹 Cleaning up RAG service...');
      await ragService.cleanup();
    }
    if (sessionManager && sessionManager.cleanup) {
      console.log('🧹 Cleaning up session manager...');
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

// Start server - enhanced
async function startServer() {
  try {
    await initializeServices();
    
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`🌐 Server URL: http://localhost:${port}`);
      console.log(`📍 API endpoints:`);
      console.log(`   - GET  / (root/welcome)`);
      console.log(`   - GET  /api (API info)`);
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
      
      console.log(`📊 Service status:`);
      console.log(`   - RAG Service: ${ragService ? '✅ Active' : '❌ Unavailable'}`);
      console.log(`   - Session Manager: ${sessionManager ? '✅ Active' : '❌ Unavailable (fallback mode)'}`);
      console.log(`   - Gemini Service: ${geminiService ? '✅ Active' : '❌ Unavailable'}`);
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