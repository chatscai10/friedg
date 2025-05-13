/**
 * 庫存管理模組的Redis緩存實現
 * 
 * 提供分布式緩存能力，主要用於生產環境
 * 注意：此實現需要在初始化時提供Redis客戶端
 */
import { promisify } from 'util';

/**
 * Redis緩存介面
 */
export interface RedisClient {
  set: (key: string, value: string, mode?: string, duration?: number) => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<unknown>;
  keys: (pattern: string) => Promise<string[]>;
  flushall: () => Promise<unknown>;
  ttl: (key: string) => Promise<number>;
}

/**
 * Redis緩存配置選項
 */
export interface RedisCacheOptions {
  keyPrefix?: string;
  defaultTTL?: number;
}

/**
 * Redis緩存實現
 */
export class RedisCache<T> {
  private readonly keyPrefix: string;
  private readonly defaultTTL: number;
  private readonly client: RedisClient;
  
  /**
   * 建立Redis緩存
   * @param client Redis客戶端
   * @param options 配置選項
   */
  constructor(client: any, options: RedisCacheOptions = {}) {
    // 確保Redis客戶端已初始化
    if (!client) {
      throw new Error('Redis客戶端必須提供');
    }
    
    // 如果客戶端方法不是Promise，則將其包裝為Promise
    this.client = this.wrapClientIfNeeded(client);
    
    this.keyPrefix = options.keyPrefix || 'inv:';
    this.defaultTTL = options.defaultTTL || 300; // 預設5分鐘
  }
  
  /**
   * 設置緩存
   * @param key 緩存鍵
   * @param data 緩存數據
   * @param ttlSeconds 過期時間(秒)
   */
  async set(key: string, data: T, ttlSeconds?: number): Promise<void> {
    // 序列化數據
    const serialized = JSON.stringify(data);
    const ttl = ttlSeconds || this.defaultTTL;
    
    try {
      // 使用帶有過期時間的設置
      await this.client.set(this.getFullKey(key), serialized, 'EX', ttl);
    } catch (error) {
      console.error(`[RedisCache] 設置緩存失敗: ${key}`, error);
      // 在緩存錯誤時繼續運行，不中斷業務流程
    }
  }
  
  /**
   * 獲取緩存
   * @param key 緩存鍵
   * @returns 緩存數據，不存在則返回null
   */
  async get(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(this.getFullKey(key));
      
      if (!data) {
        return null;
      }
      
      // 反序列化數據
      return JSON.parse(data) as T;
    } catch (error) {
      console.error(`[RedisCache] 獲取緩存失敗: ${key}`, error);
      return null;
    }
  }
  
  /**
   * 檢查緩存是否存在
   * @param key 緩存鍵
   * @returns 是否存在
   */
  async has(key: string): Promise<boolean> {
    try {
      const ttl = await this.client.ttl(this.getFullKey(key));
      return ttl > 0 || ttl === -1; // -1表示永久鍵, -2表示不存在
    } catch (error) {
      console.error(`[RedisCache] 檢查緩存失敗: ${key}`, error);
      return false;
    }
  }
  
  /**
   * 刪除緩存
   * @param key 緩存鍵
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(this.getFullKey(key));
    } catch (error) {
      console.error(`[RedisCache] 刪除緩存失敗: ${key}`, error);
    }
  }
  
  /**
   * 清空特定前綴的緩存
   * @param prefix 緩存鍵前綴
   */
  async invalidateByPrefix(prefix: string): Promise<void> {
    try {
      const pattern = this.getFullKey(`${prefix}*`);
      const keys = await this.client.keys(pattern);
      
      // 如果有匹配的鍵，批量刪除
      if (keys.length > 0) {
        await Promise.all(keys.map(key => this.client.del(key)));
      }
    } catch (error) {
      console.error(`[RedisCache] 清空前綴緩存失敗: ${prefix}`, error);
    }
  }
  
  /**
   * 清空所有緩存
   */
  async clear(): Promise<void> {
    try {
      const pattern = this.getFullKey('*');
      const keys = await this.client.keys(pattern);
      
      // 如果有匹配的鍵，批量刪除
      if (keys.length > 0) {
        await Promise.all(keys.map(key => this.client.del(key)));
      }
    } catch (error) {
      console.error('[RedisCache] 清空所有緩存失敗', error);
    }
  }
  
  /**
   * 獲取完整緩存鍵
   * @param key 緩存鍵
   * @returns 帶前綴的完整緩存鍵
   */
  private getFullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
  
  /**
   * 如果需要，將Redis客戶端的方法包裝為Promise
   * @param client Redis客戶端
   * @returns 包裝後的客戶端
   */
  private wrapClientIfNeeded(client: any): RedisClient {
    // 檢查方法是否已經返回Promise
    const isPromise = (fn: any) => {
      try {
        return Promise.resolve(fn()) === fn();
      } catch {
        return false;
      }
    };
    
    // 確保所有必需的方法都返回Promise
    return {
      set: isPromise(client.set) ? client.set.bind(client) : promisify(client.set).bind(client),
      get: isPromise(client.get) ? client.get.bind(client) : promisify(client.get).bind(client),
      del: isPromise(client.del) ? client.del.bind(client) : promisify(client.del).bind(client),
      keys: isPromise(client.keys) ? client.keys.bind(client) : promisify(client.keys).bind(client),
      flushall: isPromise(client.flushall) ? client.flushall.bind(client) : promisify(client.flushall).bind(client),
      ttl: isPromise(client.ttl) ? client.ttl.bind(client) : promisify(client.ttl).bind(client),
    };
  }
} 