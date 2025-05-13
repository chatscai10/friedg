/**
 * 庫存管理模組的記憶體緩存實現
 */
import { ICache } from './cache.interface';

/**
 * 簡單的記憶體緩存實現
 */
export class MemoryCache<T> implements ICache<T> {
  private cache: Map<string, { data: T, expiry: number }> = new Map();
  private readonly defaultTTL: number;
  
  /**
   * 建立記憶體緩存
   * @param defaultTTLSeconds 預設過期時間(秒)
   */
  constructor(defaultTTLSeconds: number = 300) { // 預設5分鐘
    this.defaultTTL = defaultTTLSeconds * 1000;
  }
  
  /**
   * 設置緩存
   * @param key 緩存鍵
   * @param data 緩存數據
   * @param ttlSeconds 過期時間(秒)
   */
  set(key: string, data: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
    const expiry = Date.now() + ttl;
    this.cache.set(key, { data, expiry });
  }
  
  /**
   * 獲取緩存
   * @param key 緩存鍵
   * @returns 緩存數據，不存在或已過期則返回null
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
   * 檢查緩存是否存在
   * @param key 緩存鍵
   * @returns 是否存在且未過期
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  /**
   * 刪除緩存
   * @param key 緩存鍵
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * 清空特定前綴的緩存
   * @param prefix 緩存鍵前綴
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
  
  /**
   * 獲取緩存大小
   * @returns 緩存項目數量
   */
  size(): number {
    return this.cache.size;
  }
  
  /**
   * 執行緩存維護（刪除過期項目）
   * @returns 刪除的項目數量
   */
  maintenance(): number {
    const now = Date.now();
    let count = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expiry < now) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }
} 