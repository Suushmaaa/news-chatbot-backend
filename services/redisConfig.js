

const Redis = require('ioredis');

class UpstashRedisManager {
  constructor() {
    this.redis = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      console.log('🔧 Initializing Upstash Redis...');
      
      // Upstash Redis connection
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.redis = new Redis(redisUrl, {
        // Upstash-specific settings
        enableReadyCheck: false,
        enableOfflineQueue: false,
        connectTimeout: 10000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        
        // TLS settings for Upstash
        tls: redisUrl.startsWith('rediss://') ? {
          rejectUnauthorized: false
        } : undefined,
      });

      // Event handlers
      this.redis.on('connect', () => {
        console.log('✅ Upstash Redis connected successfully');
        this.isConnected = true;
      });

      this.redis.on('ready', () => {
        console.log('✅ Upstash Redis is ready');
        this.isConnected = true;
      });

      this.redis.on('error', (err) => {
        console.warn('⚠️ Upstash Redis error:', err.message);
        this.isConnected = false;
        
        // Don't throw error, just log and continue
        if (err.code === 'ECONNREFUSED') {
          console.log('📝 Continuing without Redis persistence...');
        }
      });

      this.redis.on('close', () => {
        console.warn('⚠️ Upstash Redis connection closed');
        this.isConnected = false;
      });

      this.redis.on('reconnecting', (delay) => {
        console.log(`🔄 Upstash Redis reconnecting in ${delay}ms...`);
      });

      // Test connection with timeout
      const testConnection = async () => {
        try {
          const result = await Promise.race([
            this.redis.ping(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Connection timeout')), 8000)
            )
          ]);
          
          if (result === 'PONG') {
            console.log('✅ Upstash Redis connection test successful');
            this.isConnected = true;
            return true;
          }
        } catch (error) {
          console.warn('⚠️ Upstash Redis test failed:', error.message);
          this.isConnected = false;
          return false;
        }
      };

      await testConnection();
      return this.redis;

    } catch (error) {
      console.error('❌ Upstash Redis initialization failed:', error.message);
      console.log('📝 Continuing without Redis persistence...');
      this.redis = null;
      this.isConnected = false;
      return null;
    }
  }

  getRedis() {
    return this.isConnected ? this.redis : null;
  }

  async safeOperation(operation) {
    if (!this.redis || !this.isConnected) {
      return null;
    }

    try {
      return await operation(this.redis);
    } catch (error) {
      console.warn('Redis operation failed:', error.message);
      this.isConnected = false;
      return null;
    }
  }

  async cleanup() {
    if (this.redis) {
      try {
        await this.redis.quit();
        console.log('✅ Upstash Redis connection closed gracefully');
      } catch (error) {
        console.warn('⚠️ Error closing Upstash Redis connection:', error.message);
      }
    }
  }
}

// Enhanced SessionManager with Upstash support
class SessionManager {
  constructor() {
    this.redisManager = new UpstashRedisManager();
    this.redis = null;
    this.memoryStore = new Map(); // Fallback storage
    this.sessionTTL = 24 * 60 * 60; // 24 hours in seconds
  }

  async initialize() {
    console.log('🔧 Initializing SessionManager...');
    this.redis = await this.redisManager.initialize();
    
    if (!this.redis) {
      console.log('📝 Using in-memory session storage (sessions will not persist across restarts)');
    }
  }

  async testConnection() {
    return await this.redisManager.safeOperation(async (redis) => {
      const result = await redis.ping();
      return result === 'PONG';
    }) || false;
  }

  async createSession(sessionId = null) {
    const id = sessionId || require('uuid').v4();
    const sessionKey = `session:${id}`;
    
    const sessionData = {
      id,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messages: []
    };

    // Try Redis first
    const redisResult = await this.redisManager.safeOperation(async (redis) => {
      await redis.setex(sessionKey, this.sessionTTL, JSON.stringify(sessionData));
      return true;
    });

    // Fallback to memory store
    if (!redisResult) {
      this.memoryStore.set(sessionKey, sessionData);
      
      // Auto-cleanup memory sessions after TTL
      setTimeout(() => {
        this.memoryStore.delete(sessionKey);
      }, this.sessionTTL * 1000);
    }

    console.log(`✅ Session created: ${id} (${redisResult ? 'Redis' : 'Memory'})`);
    return id;
  }

  async addMessage(sessionId, message) {
    const sessionKey = `session:${sessionId}`;
    
    // Try Redis first
    const redisResult = await this.redisManager.safeOperation(async (redis) => {
      const sessionData = await redis.get(sessionKey);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        session.messages.push(message);
        session.lastActivity = new Date().toISOString();
        
        await redis.setex(sessionKey, this.sessionTTL, JSON.stringify(session));
        return true;
      }
      return false;
    });

    // Fallback to memory store
    if (!redisResult) {
      const session = this.memoryStore.get(sessionKey);
      if (session) {
        session.messages.push(message);
        session.lastActivity = new Date().toISOString();
        this.memoryStore.set(sessionKey, session);
      } else {
        // Create new session if it doesn't exist
        await this.createSession(sessionId);
        const newSession = this.memoryStore.get(sessionKey);
        if (newSession) {
          newSession.messages.push(message);
          this.memoryStore.set(sessionKey, newSession);
        }
      }
    }

    return true;
  }

  async getMessageHistory(sessionId, limit = 50) {
    const sessionKey = `session:${sessionId}`;
    
    // Try Redis first
    const redisResult = await this.redisManager.safeOperation(async (redis) => {
      const sessionData = await redis.get(sessionKey);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        return session.messages.slice(-limit);
      }
      return null;
    });

    if (redisResult !== null) {
      return redisResult;
    }

    // Fallback to memory store
    const session = this.memoryStore.get(sessionKey);
    return session ? session.messages.slice(-limit) : [];
  }

  async clearSession(sessionId) {
    const sessionKey = `session:${sessionId}`;
    
    // Try Redis first
    const redisResult = await this.redisManager.safeOperation(async (redis) => {
      const result = await redis.del(sessionKey);
      return result > 0;
    });

    // Also clear from memory store
    const memoryResult = this.memoryStore.delete(sessionKey);
    
    return redisResult || memoryResult;
  }

  async extendSession(sessionId) {
    const sessionKey = `session:${sessionId}`;
    
    await this.redisManager.safeOperation(async (redis) => {
      await redis.expire(sessionKey, this.sessionTTL);
      return true;
    });
  }

  async getActiveSessions() {
    // Try Redis first
    const redisResult = await this.redisManager.safeOperation(async (redis) => {
      const keys = await redis.keys('session:*');
      return keys.map(key => key.replace('session:', ''));
    });

    if (redisResult) {
      return redisResult;
    }

    // Fallback to memory store
    const memoryKeys = Array.from(this.memoryStore.keys())
      .filter(key => key.startsWith('session:'))
      .map(key => key.replace('session:', ''));
    
    return memoryKeys;
  }

  async cleanup() {
    await this.redisManager.cleanup();
    this.memoryStore.clear();
  }
}

module.exports = SessionManager;