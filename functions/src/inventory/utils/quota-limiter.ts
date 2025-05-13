/**
 * 庫存管理模組的配額和資源限制機制
 * 
 * 提供對各種操作的限流和配額控制
 */
import * as admin from 'firebase-admin';
import { QuotaExceededError } from './errors';
import { cacheManager, CacheLevel } from '../cache/cache-manager';

/**
 * 配額類型
 */
export enum QuotaType {
  ITEMS_PER_TENANT = 'items_per_tenant',
  ITEMS_PER_STORE = 'items_per_store',
  STOCK_ADJUSTMENTS_PER_DAY = 'stock_adjustments_per_day',
  OPERATIONS_PER_MINUTE = 'operations_per_minute',
  API_CALLS_PER_MINUTE = 'api_calls_per_minute',
  STORAGE_PER_TENANT = 'storage_per_tenant',
  BATCH_SIZE = 'batch_size',
  CONCURRENT_TRANSACTIONS = 'concurrent_transactions'
}

/**
 * 基本配額限制
 */
export const DEFAULT_QUOTA_LIMITS: Record<QuotaType, number> = {
  [QuotaType.ITEMS_PER_TENANT]: 10000,
  [QuotaType.ITEMS_PER_STORE]: 2000,
  [QuotaType.STOCK_ADJUSTMENTS_PER_DAY]: 5000,
  [QuotaType.OPERATIONS_PER_MINUTE]: 1000,
  [QuotaType.API_CALLS_PER_MINUTE]: 600,
  [QuotaType.STORAGE_PER_TENANT]: 1024 * 1024 * 100, // 100MB
  [QuotaType.BATCH_SIZE]: 500,
  [QuotaType.CONCURRENT_TRANSACTIONS]: 10
};

/**
 * 配額檢查結果
 */
export interface QuotaCheckResult {
  /** 配額檢查是否通過 */
  allowed: boolean;
  /** 當前用量 */
  currentUsage: number;
  /** 最大限制 */
  limit: number;
  /** 剩餘配額 */
  remaining: number;
  /** 重置時間 (如適用) */
  resetTime?: Date;
}

/**
 * 配額檢查選項
 */
export interface QuotaCheckOptions {
  /** 跳過緩存 */
  skipCache?: boolean;
  /** 自定義配額限制 */
  customLimit?: number;
  /** 增量值 (默認為1) */
  increment?: number;
}

/**
 * 資源限制管理器
 */
export class QuotaLimiter {
  private static instance: QuotaLimiter;
  private db: admin.firestore.Firestore;
  private customQuotas: Map<string, number> = new Map();
  private activeTransactions: Map<string, number> = new Map();
  
  /**
   * 私有構造函數，實現單例模式
   */
  private constructor() {
    this.db = admin.firestore();
    this.loadCustomQuotas();
  }
  
  /**
   * 獲取單例實例
   */
  public static getInstance(): QuotaLimiter {
    if (!QuotaLimiter.instance) {
      QuotaLimiter.instance = new QuotaLimiter();
    }
    return QuotaLimiter.instance;
  }
  
  /**
   * 加載自定義配額設置
   * @private
   */
  private async loadCustomQuotas() {
    try {
      const quotaSnapshot = await this.db.collection('quotaSettings').get();
      
      quotaSnapshot.forEach(doc => {
        const data = doc.data();
        Object.keys(data).forEach(key => {
          if (Object.values(QuotaType).includes(key as QuotaType)) {
            this.customQuotas.set(key, data[key]);
          }
        });
      });
    } catch (error) {
      console.error('無法載入配額設置:', error);
    }
  }
  
  /**
   * 獲取特定配額類型的限制
   * @param quotaType 配額類型
   * @param customLimit 自定義限制
   * @returns 配額限制數值
   */
  private getLimit(quotaType: QuotaType, customLimit?: number): number {
    if (customLimit !== undefined) {
      return customLimit;
    }
    
    const customQuota = this.customQuotas.get(quotaType);
    if (customQuota !== undefined) {
      return customQuota;
    }
    
    return DEFAULT_QUOTA_LIMITS[quotaType];
  }
  
  /**
   * 構建配額鍵名
   * @param quotaType 配額類型
   * @param entityId 實體ID
   * @returns 完整配額鍵名
   */
  private getQuotaKey(quotaType: QuotaType, entityId: string): string {
    return `quota:${quotaType}:${entityId}`;
  }
  
  /**
   * 檢查並增加配額計數
   * @param quotaType 配額類型
   * @param entityId 實體ID
   * @param options 配額檢查選項
   * @returns 配額檢查結果
   */
  public async checkAndIncrement(
    quotaType: QuotaType,
    entityId: string,
    options: QuotaCheckOptions = {}
  ): Promise<QuotaCheckResult> {
    const { skipCache = false, customLimit, increment = 1 } = options;
    const quotaKey = this.getQuotaKey(quotaType, entityId);
    const limit = this.getLimit(quotaType, customLimit);
    
    // 檢查緩存
    if (!skipCache) {
      const cachedUsage = cacheManager.get<{ usage: number; resetTime?: number }>(quotaKey);
      if (cachedUsage) {
        const currentUsage = cachedUsage.usage;
        const resetTime = cachedUsage.resetTime ? new Date(cachedUsage.resetTime) : undefined;
        
        // 檢查是否超過限制
        if (currentUsage + increment > limit) {
          return {
            allowed: false,
            currentUsage,
            limit,
            remaining: Math.max(0, limit - currentUsage),
            resetTime
          };
        }
      }
    }
    
    // 獲取當前用量和更新計數
    const result = await this.updateQuotaCounter(quotaType, entityId, increment, limit);
    
    // 更新緩存
    cacheManager.set(
      quotaKey,
      {
        usage: result.currentUsage,
        resetTime: result.resetTime?.getTime()
      },
      CacheLevel.LEVEL2
    );
    
    return result;
  }
  
  /**
   * 更新配額計數器
   * @private
   */
  private async updateQuotaCounter(
    quotaType: QuotaType,
    entityId: string,
    increment: number,
    limit: number
  ): Promise<QuotaCheckResult> {
    const quotaRef = this.db.collection('quotaUsage').doc(`${quotaType}_${entityId}`);
    
    // 根據配額類型確定重置時間
    const now = new Date();
    let resetTime: Date | undefined;
    
    switch (quotaType) {
      case QuotaType.OPERATIONS_PER_MINUTE:
      case QuotaType.API_CALLS_PER_MINUTE:
        // 下一分鐘重置
        resetTime = new Date(now);
        resetTime.setMinutes(resetTime.getMinutes() + 1, 0, 0);
        break;
        
      case QuotaType.STOCK_ADJUSTMENTS_PER_DAY:
        // 明天零點重置
        resetTime = new Date(now);
        resetTime.setDate(resetTime.getDate() + 1);
        resetTime.setHours(0, 0, 0, 0);
        break;
        
      // 其他配額類型不自動重置
    }
    
    let currentUsage = 0;
    let allowed = true;
    
    // 使用事務來確保原子性操作
    await this.db.runTransaction(async transaction => {
      const doc = await transaction.get(quotaRef);
      const quotaData = doc.exists ? doc.data() : { count: 0, lastReset: null };
      
      // 檢查是否應該重置計數器
      if (resetTime && quotaData.lastReset) {
        const lastResetDate = quotaData.lastReset.toDate();
        
        // 根據配額類型決定是否重置
        if (
          (quotaType === QuotaType.OPERATIONS_PER_MINUTE || quotaType === QuotaType.API_CALLS_PER_MINUTE) &&
          lastResetDate.getMinutes() !== now.getMinutes()
        ) {
          quotaData.count = 0;
        } else if (
          quotaType === QuotaType.STOCK_ADJUSTMENTS_PER_DAY &&
          lastResetDate.getDate() !== now.getDate()
        ) {
          quotaData.count = 0;
        }
      }
      
      // 檢查配額
      currentUsage = quotaData.count;
      
      if (currentUsage + increment > limit) {
        allowed = false;
        return;
      }
      
      // 更新配額使用量
      transaction.set(quotaRef, {
        count: admin.firestore.FieldValue.increment(increment),
        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
        lastReset: quotaData.lastReset || admin.firestore.FieldValue.serverTimestamp(),
        type: quotaType,
        entityId,
        limit
      }, { merge: true });
      
      currentUsage += increment;
    });
    
    return {
      allowed,
      currentUsage,
      limit,
      remaining: Math.max(0, limit - currentUsage),
      resetTime
    };
  }
  
  /**
   * 強制檢查配額
   * @param quotaType 配額類型
   * @param entityId 實體ID
   * @param errorMessage 自定義錯誤訊息
   * @param options 配額檢查選項
   */
  public async enforceQuota(
    quotaType: QuotaType,
    entityId: string,
    errorMessage?: string,
    options: QuotaCheckOptions = {}
  ): Promise<void> {
    const result = await this.checkAndIncrement(quotaType, entityId, options);
    
    if (!result.allowed) {
      throw new QuotaExceededError(
        quotaType,
        result.currentUsage,
        result.limit,
        errorMessage
      );
    }
  }
  
  /**
   * 重置特定實體的配額計數
   * @param quotaType 配額類型
   * @param entityId 實體ID
   */
  public async resetQuotaCounter(quotaType: QuotaType, entityId: string): Promise<void> {
    const quotaRef = this.db.collection('quotaUsage').doc(`${quotaType}_${entityId}`);
    
    await quotaRef.set({
      count: 0,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
      lastReset: admin.firestore.FieldValue.serverTimestamp(),
      type: quotaType,
      entityId
    }, { merge: true });
    
    // 清除緩存
    const quotaKey = this.getQuotaKey(quotaType, entityId);
    cacheManager.delete(quotaKey);
  }
  
  /**
   * 登記並檢查並發事務數量
   * @param transactionId 事務ID
   * @param tenantId 租戶ID
   * @returns 是否允許該事務執行
   */
  public checkConcurrentTransaction(transactionId: string, tenantId: string): boolean {
    const key = `transaction:${tenantId}`;
    const currentCount = this.activeTransactions.get(key) || 0;
    const limit = this.getLimit(QuotaType.CONCURRENT_TRANSACTIONS);
    
    if (currentCount >= limit) {
      return false;
    }
    
    this.activeTransactions.set(key, currentCount + 1);
    return true;
  }
  
  /**
   * 釋放事務計數
   * @param tenantId 租戶ID
   */
  public releaseTransaction(tenantId: string): void {
    const key = `transaction:${tenantId}`;
    const currentCount = this.activeTransactions.get(key) || 0;
    
    if (currentCount > 0) {
      this.activeTransactions.set(key, currentCount - 1);
    }
  }
  
  /**
   * 檢查批次大小是否超過限制
   * @param size 批次大小
   * @param tenantId 租戶ID
   * @param customLimit 自定義限制
   * @returns 是否允許該批次大小
   */
  public checkBatchSize(size: number, tenantId: string, customLimit?: number): boolean {
    const limit = this.getLimit(QuotaType.BATCH_SIZE, customLimit);
    return size <= limit;
  }
  
  /**
   * 強制檢查批次大小
   * @param size 批次大小
   * @param tenantId 租戶ID
   * @param customLimit 自定義限制
   */
  public enforceBatchSize(size: number, tenantId: string, customLimit?: number): void {
    const limit = this.getLimit(QuotaType.BATCH_SIZE, customLimit);
    
    if (size > limit) {
      throw new QuotaExceededError(
        QuotaType.BATCH_SIZE,
        size,
        limit,
        `批次大小 ${size} 超過限制 ${limit}`
      );
    }
  }
}

// 導出單例實例
export const quotaLimiter = QuotaLimiter.getInstance(); 