const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

class SessionManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.sessionPrefix = 'chat_session:';
    this.defaultTTL = 3600; // 1 hour in seconds
  }

  async testConnection() {
    try {
      await this.redis.ping();
      console.log('✅ Connected to Redis');
      return true;
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      throw error;
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

      await this.redis.setex(sessionKey, this.defaultTTL, JSON.stringify(sessionData));
      
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
      const sessionData = await this.redis.get(sessionKey);
      
      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData);
    } catch (error) {
      console.error('❌ Error getting session:', error);
      return null;
    }
  }

  async addMessage(sessionId, message) {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        // Create new session if it doesn't exist
        await this.createSession(sessionId);
        return await this.addMessage(sessionId, message);
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
      await this.redis.setex(sessionKey, this.defaultTTL, JSON.stringify(session));

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
      const result = await this.redis.del(sessionKey);
      
      console.log(`✅ Cleared session: ${sessionId}`);
      return result === 1;
    } catch (error) {
      console.error('❌ Error clearing session:', error);
      throw error;
    }
  }

  async extendSession(sessionId) {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      await this.redis.expire(sessionKey, this.defaultTTL);
      return true;
    } catch (error) {
      console.error('❌ Error extending session:', error);
      return false;
    }
  }

  async getActiveSessions() {
    try {
      const keys = await this.redis.keys(`${this.sessionPrefix}*`);
      return keys.map(key => key.replace(this.sessionPrefix, ''));
    } catch (error) {
      console.error('❌ Error getting active sessions:', error);
      return [];
    }
  }
}

module.exports = SessionManager;