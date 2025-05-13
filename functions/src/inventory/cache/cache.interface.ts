/**
 * 庫存管理模組的緩存接口
 * 
 * 定義緩存操作的通用接口，以便支持不同的緩存實現
 */

/**
 * 通用緩存接口
 */
export interface ICache<T> {
  /**
   * 設置緩存
   * @param key 緩存鍵
   * @param data 緩存數據
   * @param ttlSeconds 過期時間(秒)
   */
  set(key: string, data: T, ttlSeconds?: number): Promise<void> | void;
  
  /**
   * 獲取緩存
   * @param key 緩存鍵
   * @returns 緩存數據，不存在則返回null
   */
  get(key: string): Promise<T | null> | (T | null);
  
  /**
   * 檢查緩存是否存在
   * @param key 緩存鍵
   * @returns 是否存在
   */
  has(key: string): Promise<boolean> | boolean;
  
  /**
   * 刪除緩存
   * @param key 緩存鍵
   */
  delete(key: string): Promise<void> | void;
  
  /**
   * 清空特定前綴的緩存
   * @param prefix 緩存鍵前綴
   */
  invalidateByPrefix(prefix: string): Promise<void> | void;
  
  /**
   * 清空所有緩存
   */
  clear(): Promise<void> | void;
}

/**
 * 緩存類型
 */
export enum CacheType {
  MEMORY = 'memory',
  REDIS = 'redis',
  NONE = 'none'
}

/**
 * 緩存配置
 */
export interface CacheConfig {
  type: CacheType;
  ttl?: number;
  keyPrefix?: string;
  redisClient?: any;
}

/**
 * 空緩存實現，用於測試或禁用緩存
 */
export class NoOpCache<T> implements ICache<T> {
  async set(key: string, data: T, ttlSeconds?: number): Promise<void> {}
  async get(key: string): Promise<T | null> { return null; }
  async has(key: string): Promise<boolean> { return false; }
  async delete(key: string): Promise<void> {}
  async invalidateByPrefix(prefix: string): Promise<void> {}
  async clear(): Promise<void> {}
}

/**
 * 緩存接口轉換器
 * 
 * 將同步緩存操作轉換為異步接口
 */
export function toAsyncCache<T>(cache: ICache<T>): ICache<T> {
  return {
    set: async (key: string, data: T, ttlSeconds?: number) => {
      return Promise.resolve(cache.set(key, data, ttlSeconds));
    },
    get: async (key: string) => {
      return Promise.resolve(cache.get(key));
    },
    has: async (key: string) => {
      return Promise.resolve(cache.has(key));
    },
    delete: async (key: string) => {
      return Promise.resolve(cache.delete(key));
    },
    invalidateByPrefix: async (prefix: string) => {
      return Promise.resolve(cache.invalidateByPrefix(prefix));
    },
    clear: async () => {
      return Promise.resolve(cache.clear());
    }
  };
}

/**
 * 緩存工廠類
 * 
 * 根據配置創建不同類型的緩存實例
 */
export class CacheFactory {
  /**
   * 創建緩存實例
   * @param config 緩存配置
   * @returns 緩存實例
   */
  static createCache<T>(config: CacheConfig): ICache<T> {
    switch (config.type) {
      case CacheType.MEMORY:
        // 動態導入MemoryCache
        const { MemoryCache } = require('./memory-cache');
        return toAsyncCache(new MemoryCache<T>(config.ttl || 300));
        
      case CacheType.REDIS:
        if (!config.redisClient) {
          throw new Error('Redis緩存需要提供Redis客戶端');
        }
        // 動態導入RedisCache
        const { RedisCache } = require('./redis-cache');
        return new RedisCache<T>(config.redisClient, {
          keyPrefix: config.keyPrefix,
          defaultTTL: config.ttl
        });
        
      case CacheType.NONE:
      default:
        return new NoOpCache<T>();
    }
  }
} 