const { v4: uuidv4 } = require('uuid');

class SessionManager {
  constructor() {
    this.redis = this.createRedisClient();
    this.sessionPrefix = 'chat_session:';
    this.defaultTTL = 3600; // 1 hour in seconds
  }

  createRedisClient() {
    try {
      const Redis = require('ioredis');
      
      // For Upstash Redis with password
      const redisOptions = {
        host: 'singular-sailfish-64005.upstash.io',
        port: 6379,
        password: process.env.REDIS_PASSWORD || 'AfoFAAIncDFiMGQ2OGE5NzY1YmQ0ZmQwOGE5YjEyM2JiMzUzOGFjYnAxNjQwMDU',
        tls: {}, // Enable TLS for Upstash
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      };

      return new Redis(redisOptions);
    } catch (error) {
      console.error('❌ Failed to create Redis client:', error);
      return null;
    }
  }

  async testConnection() {
    try {
      if (!this.redis) {
        throw new Error('Redis client not initialized');
      }
      
      await this.redis.ping();
      console.log('✅ Connected to Redis (Upstash)');
      return true;
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      
      // Fallback to in-memory storage
      console.log('🔄 Falling back to in-memory session storage');
      this.useMemoryStorage = true;
      this.sessions = new Map();
      return true;
    }
  }

  generateSessionId() {
    return uuidv4();
  }

  getSessionKey(sessionId) {
    return `${this.sessionPrefix}${sessionId}`;
  }

  async createSession(sessionId = null) {
    try {
      const id = sessionId || this.generateSessionId();
      const sessionKey = this.getSessionKey(id);
      
      const sessionData = {
        sessionId: id,
        messages: [],
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };

      if (!this.useMemoryStorage && this.redis) {
        await this.redis.setex(sessionKey, this.defaultTTL, JSON.stringify(sessionData));
      } else {
        // In-memory storage
        this.sessions.set(sessionKey, sessionData);
        // Set timeout to clear session after TTL
        setTimeout(() => {
          this.sessions.delete(sessionKey);
        }, this.defaultTTL * 1000);
      }
      
      console.log(`✅ Created session: ${id}`);
      return id;
    } catch (error) {
      console.error('❌ Error creating session:', error);
      throw error;
    }
  }

  async getSession(sessionId) {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      
      if (!this.useMemoryStorage && this.redis) {
        const sessionData = await this.redis.get(sessionKey);
        return sessionData ? JSON.parse(sessionData) : null;
      } else {
        // In-memory storage
        return this.sessions.get(sessionKey) || null;
      }
    } catch (error) {
      console.error('❌ Error getting session:', error);
      return null;
    }
  }

  async addMessage(sessionId, message) {
    try {
      let session = await this.getSession(sessionId);
      
      if (!session) {
        // Create new session if it doesn't exist
        await this.createSession(sessionId);
        session = await this.getSession(sessionId);
      }

      // Add message with timestamp
      const messageWithTimestamp = {
        ...message,
        timestamp: new Date().toISOString(),
        id: uuidv4()
      };

      session.messages.push(messageWithTimestamp);
      session.lastActivity = new Date().toISOString();

      // Keep only last 50 messages to prevent memory issues
      if (session.messages.length > 50) {
        session.messages = session.messages.slice(-50);
      }

      const sessionKey = this.getSessionKey(sessionId);
      
      if (!this.useMemoryStorage && this.redis) {
        await this.redis.setex(sessionKey, this.defaultTTL, JSON.stringify(session));
      } else {
        // In-memory storage
        this.sessions.set(sessionKey, session);
      }

      return messageWithTimestamp;
    } catch (error) {
      console.error('❌ Error adding message:', error);
      throw error;
    }
  }

  async getMessageHistory(sessionId, limit = 20) {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return [];
      }

      // Return last N messages
      return session.messages.slice(-limit);
    } catch (error) {
      console.error('❌ Error getting message history:', error);
      return [];
    }
  }

  async clearSession(sessionId) {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      
      if (!this.useMemoryStorage && this.redis) {
        const result = await this.redis.del(sessionKey);
        return result === 1;
      } else {
        // In-memory storage
        return this.sessions.delete(sessionKey);
      }
    } catch (error) {
      console.error('❌ Error clearing session:', error);
      throw error;
    }
  }

  async extendSession(sessionId) {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      
      if (!this.useMemoryStorage && this.redis) {
        await this.redis.expire(sessionKey, this.defaultTTL);
      }
      // For in-memory, TTL is handled by setTimeout
      return true;
    } catch (error) {
      console.error('❌ Error extending session:', error);
      return false;
    }
  }

  async getActiveSessions() {
    try {
      if (!this.useMemoryStorage && this.redis) {
        const keys = await this.redis.keys(`${this.sessionPrefix}*`);
        return keys.map(key => key.replace(this.sessionPrefix, ''));
      } else {
        // In-memory storage
        return Array.from(this.sessions.keys()).map(key => 
          key.replace(this.sessionPrefix, '')
        );
      }
    } catch (error) {
      console.error('❌ Error getting active sessions:', error);
      return [];
    }
  }

  async cleanup() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

module.exports = SessionManager;