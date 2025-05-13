/**
 * 庫存批量操作服務
 * 
 * 提供高效的批量數據處理功能，專注於庫存相關操作的批量處理
 */
import * as admin from 'firebase-admin';
import { firestoreProvider } from '../db/database.provider';
import { quotaLimiter, QuotaType } from '../utils/quota-limiter';
import { BatchProcessOptions, processBatches } from '../utils/batch-processor';
import { withErrorHandling, ErrorContext } from '../utils/error-handler';
import { TransactionTooLargeError } from '../utils/errors';
import { cacheManager, CachePrefix } from '../cache/cache-manager';

/**
 * 批量操作結果接口
 */
export interface BatchOperationResult<T = any> {
  /** 操作是否全部成功 */
  success: boolean;
  /** 成功的項目數量 */
  successCount: number;
  /** 失敗的項目數量 */
  failureCount: number;
  /** 成功處理的項目 */
  processedItems?: T[];
  /** 處理失敗的項目 */
  failedItems?: T[];
  /** 錯誤訊息 */
  errors?: string[];
  /** 操作詳情 */
  details?: any;
}

/**
 * 批量操作服務類
 * 提供更高效的批量數據處理功能
 */
export class BatchOperationService {
  constructor() {}
  
  /**
   * 執行批量讀取操作
   * @param items 要處理的項目陣列
   * @param batchProcessor 處理單個批次的函數
   * @param options 批量處理選項
   */
  async executeBatchRead<T, R>(
    items: T[],
    batchProcessor: (batch: T[]) => Promise<R[]>,
    options: BatchProcessOptions & {
      tenantId: string;
      userId?: string;
      trackProgress?: boolean;
      operationName: string;
    }
  ): Promise<BatchOperationResult<R>> {
    const errorContext: ErrorContext = {
      component: 'BatchOperationService',
      operation: `批量讀取: ${options.operationName}`,
      identity: { 
        tenantId: options.tenantId,
        userId: options.userId
      }
    };
    
    return withErrorHandling(async () => {
      // 檢查配額
      if (items.length > 0) {
        await quotaLimiter.enforceQuota(
          QuotaType.OPERATIONS_PER_MINUTE, 
          options.tenantId,
          `批量讀取操作超出每分鐘限制`
        );
      }
      
      // 實際批次大小，不超過最大限制
      const batchSize = Math.min(
        options.batchSize || 20,
        quotaLimiter.getLimit(QuotaType.BATCH_SIZE)
      );
      
      // 處理批次
      const results = await this.processBatchesWithRetry(
        items,
        batchProcessor,
        batchSize,
        options
      );
      
      // 格式化並返回結果
      return this.formatBatchResults(results);
    }, errorContext);
  }
  
  /**
   * 執行批量寫入操作
   * @param items 要處理的項目陣列
   * @param batchProcessor 處理單個批次的函數
   * @param options 批量處理選項
   */
  async executeBatchWrite<T, R>(
    items: T[],
    batchProcessor: (batch: T[], transaction?: admin.firestore.Transaction) => Promise<R[]>,
    options: BatchProcessOptions & {
      tenantId: string;
      userId?: string;
      trackProgress?: boolean;
      useTransaction?: boolean;
      operationName: string;
      cacheInvalidation?: {
        prefixes: string[];
        itemIdField?: string;
        storeIdField?: string;
      };
    }
  ): Promise<BatchOperationResult<R>> {
    const errorContext: ErrorContext = {
      component: 'BatchOperationService',
      operation: `批量寫入: ${options.operationName}`,
      identity: { 
        tenantId: options.tenantId,
        userId: options.userId
      }
    };
    
    return withErrorHandling(async () => {
      // 檢查配額
      if (items.length > 0) {
        await quotaLimiter.enforceQuota(
          QuotaType.OPERATIONS_PER_MINUTE, 
          options.tenantId,
          `批量寫入操作超出每分鐘限制`
        );
      }
      
      // 檢查批次大小限制
      if (items.length > 500) {
        throw new TransactionTooLargeError();
      }
      
      // 實際批次大小，不超過最大限制
      const batchSize = Math.min(
        options.batchSize || 20,
        quotaLimiter.getLimit(QuotaType.BATCH_SIZE)
      );
      
      let result: BatchOperationResult<R>;
      
      // 根據選項決定是否使用交易
      if (options.useTransaction) {
        result = await this.executeBatchInTransaction(
          items,
          batchProcessor,
          options
        );
      } else {
        // 處理批次
        const results = await this.processBatchesWithRetry(
          items,
          batchProcessor,
          batchSize,
          options
        );
        
        // 格式化並返回結果
        result = this.formatBatchResults(results);
      }
      
      // 處理快取失效
      if (options.cacheInvalidation) {
        await this.invalidateRelatedCaches(
          items,
          options.tenantId,
          options.cacheInvalidation
        );
      }
      
      return result;
    }, errorContext);
  }
  
  /**
   * 在單一事務中執行批量操作
   * @private
   */
  private async executeBatchInTransaction<T, R>(
    items: T[],
    batchProcessor: (batch: T[], transaction?: admin.firestore.Transaction) => Promise<R[]>,
    options: BatchProcessOptions & {
      tenantId: string;
      operationName: string;
    }
  ): Promise<BatchOperationResult<R>> {
    return firestoreProvider.runTransaction(async (transaction) => {
      const processedItems: R[] = [];
      const failedItems: T[] = [];
      const errors: string[] = [];
      
      try {
        // 在單一交易中處理所有項目
        const results = await batchProcessor(items, transaction);
        processedItems.push(...results);
        
        return {
          success: true,
          successCount: results.length,
          failureCount: 0,
          processedItems,
          failedItems,
          errors
        };
      } catch (error: any) {
        // 記錄錯誤
        failedItems.push(...items);
        errors.push(error.message || '批量處理失敗');
        
        return {
          success: false,
          successCount: 0,
          failureCount: items.length,
          processedItems,
          failedItems,
          errors
        };
      }
    });
  }
  
  /**
   * 處理批次並自動重試較小批次
   * @private
   */
  private async processBatchesWithRetry<T, R>(
    items: T[],
    processor: (batch: T[], transaction?: admin.firestore.Transaction) => Promise<R[]>,
    batchSize: number,
    options: BatchProcessOptions & {
      trackProgress?: boolean;
    }
  ) {
    // 自定義批次處理函數
    const batchProcessor = async (batch: T[]) => {
      try {
        // 嘗試處理批次
        const results = await processor(batch);
        return {
          success: true,
          results,
          failedItems: [] as T[]
        };
      } catch (error: any) {
        // 處理TransactionTooLargeError的特殊情況
        if (error instanceof TransactionTooLargeError && batch.length > 1) {
          // 將批次分成更小的部分並返回重試
          return {
            shouldRetry: true,
            batchTooLarge: true,
            error
          };
        }
        
        // 其他錯誤，返回失敗信息
        return {
          success: false,
          failedItems: batch,
          error: error.message || '批次處理失敗'
        };
      }
    };
    
    // 使用批量處理工具處理
    return processBatches(
      items,
      batchProcessor,
      batchSize,
      {
        ...options,
        enableProgressCallback: options.trackProgress,
        abortOnError: false
      }
    );
  }
  
  /**
   * 格式化批量處理結果
   * @private
   */
  private formatBatchResults<R>(results: any): BatchOperationResult<R> {
    const processedItems: R[] = [];
    const failedItems: any[] = [];
    const errors: string[] = [];
    
    // 處理結果
    results.results.forEach((result: any) => {
      if (result.success) {
        processedItems.push(...(result.results || []));
      } else {
        failedItems.push(...(result.failedItems || []));
        if (result.error) {
          errors.push(result.error);
        }
      }
    });
    
    return {
      success: results.failureCount === 0,
      successCount: processedItems.length,
      failureCount: failedItems.length,
      processedItems,
      failedItems,
      errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * 失效相關緩存
   * @private
   */
  private async invalidateRelatedCaches<T>(
    items: T[],
    tenantId: string,
    cacheInvalidation: {
      prefixes: string[];
      itemIdField?: string;
      storeIdField?: string;
    }
  ): Promise<void> {
    // 處理前綴緩存失效
    cacheInvalidation.prefixes.forEach(prefix => {
      cacheManager.invalidateByPrefix(`${prefix}${tenantId}`);
    });
    
    // 處理特定項目的緩存失效
    if (cacheInvalidation.itemIdField) {
      const itemIds = this.extractUniqueValues(items, cacheInvalidation.itemIdField);
      
      itemIds.forEach(itemId => {
        if (itemId) {
          cacheManager.invalidateByPrefix(`${CachePrefix.INVENTORY_ITEM}${tenantId}_${itemId}`);
          
          // 如果同時提供了店鋪字段，處理品項在特定店鋪的緩存
          if (cacheInvalidation.storeIdField) {
            const storeIds = this.extractUniqueValues(items, cacheInvalidation.storeIdField);
            
            storeIds.forEach(storeId => {
              if (storeId) {
                cacheManager.invalidateByPrefix(
                  `${CachePrefix.STOCK_LEVEL}${tenantId}_${itemId}_${storeId}`
                );
              }
            });
          }
        }
      });
    }
    
    // 處理店鋪的緩存失效
    if (cacheInvalidation.storeIdField && !cacheInvalidation.itemIdField) {
      const storeIds = this.extractUniqueValues(items, cacheInvalidation.storeIdField);
      
      storeIds.forEach(storeId => {
        if (storeId) {
          cacheManager.invalidateByPrefix(`${CachePrefix.LIST}stockLevels_${tenantId}_${storeId}`);
        }
      });
    }
  }
  
  /**
   * 從物件數組中提取指定欄位的唯一值
   * @private
   */
  private extractUniqueValues<T>(items: T[], field: string): string[] {
    const values = new Set<string>();
    
    items.forEach(item => {
      const value = this.getNestedPropertyValue(item, field);
      if (value && typeof value === 'string') {
        values.add(value);
      }
    });
    
    return Array.from(values);
  }
  
  /**
   * 獲取物件的巢狀屬性值
   * @private
   */
  private getNestedPropertyValue(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => {
      return prev ? prev[curr] : undefined;
    }, obj);
  }
} 