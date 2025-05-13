/**
 * 庫存管理模組的緩存管理服務
 * 
 * 提供高效的緩存策略和管理功能
 */
import { MemoryCache } from './memory-cache';

/**
 * 緩存層級
 */
export enum CacheLevel {
  LEVEL1 = 'L1', // 短期緩存 (30秒)
  LEVEL2 = 'L2', // 中期緩存 (5分鐘)
  LEVEL3 = 'L3'  // 長期緩存 (30分鐘)
}

/**
 * 緩存鍵前綴
 */
export enum CachePrefix {
  INVENTORY_ITEM = 'item_',
  STOCK_LEVEL = 'level_',
  STOCK_ADJUSTMENT = 'adj_',
  CATEGORY = 'cat_',
  SUPPLIER = 'sup_',
  LIST = 'list_',
  STATS = 'stats_'
}

/**
 * 緩存統計信息
 */
interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  lastReset: Date;
}

/**
 * 緩存管理器類
 */
export class CacheManager {
  private static instance: CacheManager;
  
  private readonly l1Cache: MemoryCache<any>; // 短期緩存
  private readonly l2Cache: MemoryCache<any>; // 中期緩存
  private readonly l3Cache: MemoryCache<any>; // 長期緩存
  
  private readonly stats: Map<string, CacheStats> = new Map();
  private readonly DEBUG: boolean = false;
  
  /**
   * 建立緩存管理器
   */
  private constructor() {
    this.l1Cache = new MemoryCache<any>(30);       // 30秒
    this.l2Cache = new MemoryCache<any>(5 * 60);   // 5分鐘
    this.l3Cache = new MemoryCache<any>(30 * 60);  // 30分鐘
    
    // 初始化統計
    this.resetStats();
  }
  
  /**
   * 獲取單例實例
   */
  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }
  
  /**
   * 設置緩存
   * @param key 緩存鍵
   * @param data 緩存數據
   * @param level 緩存層級
   * @param ttlSeconds 自定義過期時間(秒)
   */
  set(key: string, data: any, level: CacheLevel = CacheLevel.LEVEL2, ttlSeconds?: number): void {
    if (data === undefined || data === null) {
      return;
    }
    
    // 更新統計
    const category = this.getCategoryFromKey(key);
    const stats = this.stats.get(category);
    if (stats) {
      stats.sets++;
    }
    
    // 根據層級選擇緩存
    switch (level) {
      case CacheLevel.LEVEL1:
        this.l1Cache.set(key, data, ttlSeconds);
        break;
      case CacheLevel.LEVEL2:
        this.l2Cache.set(key, data, ttlSeconds);
        // 同時設置L1緩存
        this.l1Cache.set(key, data, ttlSeconds);
        break;
      case CacheLevel.LEVEL3:
        this.l3Cache.set(key, data, ttlSeconds);
        // 同時設置L1和L2緩存
        this.l2Cache.set(key, data, ttlSeconds);
        this.l1Cache.set(key, data, ttlSeconds);
        break;
    }
    
    if (this.DEBUG) {
      console.log(`[CacheManager] SET ${level} ${key}`);
    }
  }
  
  /**
   * 批量設置緩存
   * @param items 鍵值對數組
   * @param level 緩存層級
   */
  setBatch(items: { key: string, data: any }[], level: CacheLevel = CacheLevel.LEVEL2): void {
    for (const item of items) {
      this.set(item.key, item.data, level);
    }
  }
  
  /**
   * 獲取緩存
   * @param key 緩存鍵
   * @returns 緩存數據，不存在則返回null
   */
  get<T>(key: string): T | null {
    // 更新統計
    const category = this.getCategoryFromKey(key);
    
    // 按照L1 -> L2 -> L3順序嘗試獲取
    let data = this.l1Cache.get(key) as T;
    let hitLevel = 'L1';
    
    if (data === null) {
      data = this.l2Cache.get(key) as T;
      hitLevel = 'L2';
      
      if (data === null) {
        data = this.l3Cache.get(key) as T;
        hitLevel = 'L3';
      } else {
        // 提升到L1
        this.l1Cache.set(key, data);
      }
    }
    
    // 更新統計信息
    const stats = this.stats.get(category);
    if (stats) {
      if (data !== null) {
        stats.hits++;
        if (this.DEBUG) {
          console.log(`[CacheManager] HIT ${hitLevel} ${key}`);
        }
      } else {
        stats.misses++;
        if (this.DEBUG) {
          console.log(`[CacheManager] MISS ${key}`);
        }
      }
    }
    
    return data;
  }
  
  /**
   * 批量獲取緩存
   * @param keys 緩存鍵數組
   * @returns 鍵值對數組
   */
  getBatch<T>(keys: string[]): { key: string, data: T | null }[] {
    return keys.map(key => ({
      key,
      data: this.get<T>(key)
    }));
  }
  
  /**
   * 檢查緩存是否存在
   * @param key 緩存鍵
   * @returns 是否存在於任一緩存中
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  /**
   * 刪除緩存
   * @param key 緩存鍵
   */
  delete(key: string): void {
    this.l1Cache.delete(key);
    this.l2Cache.delete(key);
    this.l3Cache.delete(key);
    
    // 更新統計
    const category = this.getCategoryFromKey(key);
    const stats = this.stats.get(category);
    if (stats) {
      stats.deletes++;
    }
    
    if (this.DEBUG) {
      console.log(`[CacheManager] DELETE ${key}`);
    }
  }
  
  /**
   * 批量刪除緩存
   * @param keys 緩存鍵數組
   */
  deleteBatch(keys: string[]): void {
    for (const key of keys) {
      this.delete(key);
    }
  }
  
  /**
   * 按前綴清空緩存
   * @param prefix 緩存鍵前綴
   */
  invalidateByPrefix(prefix: string): void {
    this.l1Cache.invalidateByPrefix(prefix);
    this.l2Cache.invalidateByPrefix(prefix);
    this.l3Cache.invalidateByPrefix(prefix);
    
    if (this.DEBUG) {
      console.log(`[CacheManager] INVALIDATE PREFIX ${prefix}`);
    }
  }
  
  /**
   * 清空所有緩存
   */
  clear(): void {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.l3Cache.clear();
    this.resetStats();
    
    if (this.DEBUG) {
      console.log('[CacheManager] CLEAR ALL');
    }
  }
  
  /**
   * 獲取緩存統計信息
   * @returns 所有緩存類別的統計信息
   */
  getStats(): Record<string, CacheStats> {
    const result: Record<string, CacheStats> = {};
    for (const [category, stats] of this.stats.entries()) {
      result[category] = { ...stats };
    }
    return result;
  }
  
  /**
   * 重置統計信息
   */
  resetStats(): void {
    this.stats.clear();
    
    // 為各緩存類別初始化統計
    for (const prefix of Object.values(CachePrefix)) {
      this.stats.set(prefix, {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        lastReset: new Date()
      });
    }
  }
  
  /**
   * 從緩存鍵中提取類別前綴
   * @param key 緩存鍵
   * @returns 類別前綴
   */
  private getCategoryFromKey(key: string): string {
    for (const prefix of Object.values(CachePrefix)) {
      if (key.startsWith(prefix)) {
        return prefix;
      }
    }
    return CachePrefix.LIST; // 預設為列表類型
  }
  
  /**
   * 創建完整的緩存鍵
   * @param prefix 前綴
   * @param id 標識符
   * @returns 完整的緩存鍵
   */
  static createKey(prefix: CachePrefix, id: string): string {
    return `${prefix}${id}`;
  }
  
  /**
   * 創建列表緩存鍵
   * @param type 列表類型
   * @param tenantId 租戶ID
   * @param filterStr 過濾條件JSON字符串
   * @param page 頁碼
   * @param pageSize 頁大小
   * @returns 列表緩存鍵
   */
  static createListKey(
    type: string,
    tenantId: string,
    filterStr: string = '{}',
    page: number = 1,
    pageSize: number = 20
  ): string {
    return `${CachePrefix.LIST}${type}_${tenantId}_${filterStr}_p${page}_s${pageSize}`;
  }
}

// 導出單例實例
export const cacheManager = CacheManager.getInstance(); 