import * as admin from 'firebase-admin';

/**
 * 簡單的記憶體緩存實現
 */
export class MemoryCache<T> {
  private cache: Map<string, { data: T, expiry: number }> = new Map();
  private readonly defaultTTL: number;
  
  constructor(defaultTTLSeconds: number = 300) { // 預設5分鐘
    this.defaultTTL = defaultTTLSeconds * 1000;
  }
  
  /**
   * 設置緩存
   */
  set(key: string, data: T, ttlSeconds?: number): void {
    const ttl = (ttlSeconds || this.defaultTTL) * 1000;
    const expiry = Date.now() + ttl;
    this.cache.set(key, { data, expiry });
  }
  
  /**
   * 獲取緩存
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // 檢查是否過期
    if (item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  /**
   * 刪除緩存
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * 清空特定前綴的緩存
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * 清空所有緩存
   */
  clear(): void {
    this.cache.clear();
  }
} 