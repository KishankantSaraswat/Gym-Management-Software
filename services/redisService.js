import Redis from 'ioredis';

class RedisCacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.memoryFallback = new Map(); // Resilient in-memory fallback cache

    const redisHost = process.env.REDIS_HOST || '127.0.0.1';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD || undefined;

    try {
      this.client = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn('⚠️ Redis connection attempts exceeded. Falling back to in-memory auth cache.');
            return null; // Stop retrying and use in-memory fallback
          }
          return Math.min(times * 100, 1000);
        },
        lazyConnect: true
      });

      this.client.connect().then(() => {
        this.isConnected = true;
        console.log('⚡ Redis Cluster/Standalone connected successfully.');
      }).catch((err) => {
        this.isConnected = false;
        console.warn('⚠️ Redis not available at startup. Running with high-performance in-memory fallback:', err.message);
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.isConnected = true;
      });
    } catch (e) {
      console.warn('⚠️ Redis initialization error, using in-memory store:', e.message);
      this.isConnected = false;
    }
  }

  // Key generator helper
  static authzKey(userId, gymId, branchId) {
    return `authz:u:${userId}:g:${gymId || 'none'}:b:${branchId || 'none'}`;
  }

  static sessionKey(sessionId) {
    return `sess:${sessionId}`;
  }

  async get(key) {
    if (this.isConnected && this.client) {
      try {
        const val = await this.client.get(key);
        return val ? JSON.parse(val) : null;
      } catch (err) {
        console.error('Redis GET error, falling back to memory:', err.message);
      }
    }
    const memItem = this.memoryFallback.get(key);
    if (!memItem) return null;
    if (memItem.expiry && Date.now() > memItem.expiry) {
      this.memoryFallback.delete(key);
      return null;
    }
    return memItem.value;
  }

  async set(key, value, ttlSeconds = 3600) {
    const serialized = JSON.stringify(value);
    if (this.isConnected && this.client) {
      try {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
        return true;
      } catch (err) {
        console.error('Redis SET error, saving to memory fallback:', err.message);
      }
    }
    this.memoryFallback.set(key, {
      value,
      expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
    });
    return true;
  }

  async del(key) {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch (err) {
        console.error('Redis DEL error:', err.message);
      }
    }
    this.memoryFallback.delete(key);
    return true;
  }

  async invalidatePattern(pattern) {
    if (this.isConnected && this.client) {
      try {
        const stream = this.client.scanStream({ match: pattern, count: 100 });
        stream.on('data', async (keys = []) => {
          if (keys.length) {
            const pipeline = this.client.pipeline();
            keys.forEach(k => pipeline.del(k));
            await pipeline.exec();
          }
        });
      } catch (err) {
        console.error('Redis invalidatePattern error:', err.message);
      }
    }
    // In-memory pattern invalidation
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    for (const key of this.memoryFallback.keys()) {
      if (regex.test(key)) {
        this.memoryFallback.delete(key);
      }
    }
    return true;
  }
}

export default new RedisCacheService();

