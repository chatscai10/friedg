/**
 * 庫存資料導入/導出服務
 * 
 * 提供庫存資料的批量導入與導出功能
 */
import * as admin from 'firebase-admin';
import { withErrorHandling, ErrorContext } from '../utils/error-handler';
import { ValidationError, TransactionTooLargeError } from '../utils/errors';
import { firestoreProvider } from '../db/database.provider';
import { quotaLimiter, QuotaType } from '../utils/quota-limiter';
import { 
  BatchImportExportOptions, 
  exportData, 
  importData, 
  ProgressCallback 
} from '../utils/batch-processor';
import { validateInventoryItem } from '../utils/validators';
import { BatchOperationService } from './batch-operation.service';
import { InventoryItemService } from './inventory-item.service';
import { StockLevelService } from './stock-level.service';
import { cacheManager, CachePrefix } from '../cache/cache-manager';

/**
 * 支持的導入/導出格式
 */
export type ExportFormat = 'json' | 'csv' | 'excel';

/**
 * 庫存品項導入數據
 */
export interface InventoryItemImport {
  /** 品項ID (可選，如未提供將自動生成) */
  itemId?: string;
  /** 品項名稱 */
  name: string;
  /** 品項SKU */
  sku: string;
  /** 品項描述 */
  description?: string;
  /** 品項分類 */
  category?: string;
  /** 品項單位 */
  unit?: string;
  /** 標籤 */
  tags?: string[];
  /** 成本價 */
  costPrice?: number;
  /** 售價 */
  sellingPrice?: number;
  /** 低庫存閾值 */
  lowStockThreshold?: number;
  /** 庫存狀態 */
  status?: string;
  /** 條碼 */
  barcode?: string;
  /** 自定義欄位 */
  [key: string]: any;
}

/**
 * 庫存水平導入數據
 */
export interface StockLevelImport {
  /** 品項ID */
  itemId: string;
  /** 店鋪ID */
  storeId: string;
  /** 庫存數量 */
  quantity: number;
  /** 低庫存閾值 */
  lowStockThreshold?: number;
  /** 庫位 */
  location?: string;
  /** 上次盤點日期 */
  lastStockTakeDate?: Date;
}

/**
 * 導出選項
 */
export interface ExportOptions extends BatchImportExportOptions {
  /** 要導出的欄位 */
  includeFields?: string[];
  /** 排除的欄位 */
  excludeFields?: string[];
  /** 是否包含已刪除的記錄 */
  includeDeleted?: boolean;
  /** 導出的最大記錄數量 */
  maxRecords?: number;
  /** 處理進度回調 */
  progressCallback?: ProgressCallback;
}

/**
 * 導入選項
 */
export interface ImportOptions extends BatchImportExportOptions {
  /** 導入時是否更新已存在的記錄 */
  updateExisting?: boolean;
  /** 是否跳過驗證失敗的記錄 */
  skipInvalid?: boolean;
  /** 是否在導入時自動創建不存在的引用 */
  createReferences?: boolean;
  /** 處理進度回調 */
  progressCallback?: ProgressCallback;
}

/**
 * 導入結果
 */
export interface ImportResult {
  /** 總嘗試導入記錄數 */
  totalCount: number;
  /** 成功導入記錄數 */
  successCount: number;
  /** 失敗記錄數 */
  failureCount: number;
  /** 創建的新記錄數 */
  createdCount: number;
  /** 更新的現有記錄數 */
  updatedCount: number;
  /** 跳過的記錄數 */
  skippedCount: number;
  /** 詳細錯誤信息 */
  errors?: Array<{
    /** 錯誤索引 */
    index: number;
    /** 記錄數據 */
    record: any;
    /** 錯誤訊息 */
    message: string;
  }>;
}

/**
 * 庫存資料導入/導出服務類
 */
export class ImportExportService {
  private batchOperationService: BatchOperationService;
  
  constructor(
    private inventoryItemService: InventoryItemService,
    private stockLevelService: StockLevelService
  ) {
    this.batchOperationService = new BatchOperationService();
  }
  
  /**
   * 導出庫存品項數據
   * @param tenantId 租戶ID
   * @param format 導出格式
   * @param options 導出選項
   */
  async exportInventoryItems(
    tenantId: string,
    format: ExportFormat = 'json',
    options: ExportOptions = {}
  ): Promise<string | Buffer> {
    const errorContext: ErrorContext = {
      component: 'ImportExportService',
      operation: '導出庫存品項',
      identity: { tenantId }
    };
    
    return withErrorHandling(async () => {
      // 檢查配額
      await quotaLimiter.enforceQuota(
        QuotaType.OPERATIONS_PER_MINUTE, 
        tenantId,
        '導出操作超出每分鐘限制'
      );
      
      // 獲取所有品項
      const allItems = await this.fetchAllInventoryItems(
        tenantId, 
        options.includeDeleted,
        options.maxRecords
      );
      
      // 過濾欄位
      const processedItems = this.processItemsForExport(
        allItems, 
        options.includeFields, 
        options.excludeFields
      );
      
      // 根據格式導出
      return this.exportDataToFormat(processedItems, format, options);
    }, errorContext);
  }
  
  /**
   * 導出庫存水平數據
   * @param tenantId 租戶ID
   * @param format 導出格式
   * @param options 導出選項
   */
  async exportStockLevels(
    tenantId: string,
    format: ExportFormat = 'json',
    options: ExportOptions = {}
  ): Promise<string | Buffer> {
    const errorContext: ErrorContext = {
      component: 'ImportExportService',
      operation: '導出庫存水平',
      identity: { tenantId }
    };
    
    return withErrorHandling(async () => {
      // 檢查配額
      await quotaLimiter.enforceQuota(
        QuotaType.OPERATIONS_PER_MINUTE, 
        tenantId,
        '導出操作超出每分鐘限制'
      );
      
      // 獲取所有庫存水平
      const allStockLevels = await this.fetchAllStockLevels(
        tenantId, 
        options.includeDeleted,
        options.maxRecords
      );
      
      // 過濾欄位
      const processedStockLevels = this.processItemsForExport(
        allStockLevels, 
        options.includeFields, 
        options.excludeFields
      );
      
      // 根據格式導出
      return this.exportDataToFormat(processedStockLevels, format, options);
    }, errorContext);
  }
  
  /**
   * 導入庫存品項數據
   * @param tenantId 租戶ID
   * @param userId 操作用戶ID
   * @param data 要導入的數據
   * @param format 數據格式
   * @param options 導入選項
   */
  async importInventoryItems(
    tenantId: string,
    userId: string,
    data: string | Buffer,
    format: ExportFormat = 'json',
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const errorContext: ErrorContext = {
      component: 'ImportExportService',
      operation: '導入庫存品項',
      identity: { tenantId, userId }
    };
    
    return withErrorHandling(async () => {
      // 檢查配額
      await quotaLimiter.enforceQuota(
        QuotaType.OPERATIONS_PER_MINUTE, 
        tenantId,
        '導入操作超出每分鐘限制'
      );
      
      // 解析導入數據
      const itemsToImport: InventoryItemImport[] = this.parseImportData(
        data, 
        format, 
        options
      );
      
      // 檢查批量大小
      if (itemsToImport.length > 500) {
        throw new TransactionTooLargeError();
      }
      
      // 執行導入
      return await this.processInventoryItemsImport(
        tenantId,
        userId,
        itemsToImport,
        options
      );
    }, errorContext);
  }
  
  /**
   * 導入庫存水平數據
   * @param tenantId 租戶ID
   * @param userId 操作用戶ID
   * @param data 要導入的數據
   * @param format 數據格式
   * @param options 導入選項
   */
  async importStockLevels(
    tenantId: string,
    userId: string,
    data: string | Buffer,
    format: ExportFormat = 'json',
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const errorContext: ErrorContext = {
      component: 'ImportExportService',
      operation: '導入庫存水平',
      identity: { tenantId, userId }
    };
    
    return withErrorHandling(async () => {
      // 檢查配額
      await quotaLimiter.enforceQuota(
        QuotaType.OPERATIONS_PER_MINUTE, 
        tenantId,
        '導入操作超出每分鐘限制'
      );
      
      // 解析導入數據
      const stockLevelsToImport: StockLevelImport[] = this.parseImportData(
        data, 
        format, 
        options
      );
      
      // 檢查批量大小
      if (stockLevelsToImport.length > 500) {
        throw new TransactionTooLargeError();
      }
      
      // 執行導入
      return await this.processStockLevelsImport(
        tenantId,
        userId,
        stockLevelsToImport,
        options
      );
    }, errorContext);
  }
  
  // #region 導出輔助方法
  
  /**
   * 獲取所有庫存品項
   * @private
   */
  private async fetchAllInventoryItems(
    tenantId: string,
    includeDeleted: boolean = false,
    maxRecords: number = 10000
  ): Promise<any[]> {
    const items: any[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;
    
    while (hasMore && items.length < maxRecords) {
      const result = await this.inventoryItemService.listItems(
        tenantId, 
        {}, 
        page, 
        pageSize,
        includeDeleted
      );
      
      items.push(...result.items);
      hasMore = result.hasMore;
      page++;
      
      if (items.length >= maxRecords) {
        break;
      }
    }
    
    return items.slice(0, maxRecords);
  }
  
  /**
   * 獲取所有庫存水平
   * @private
   */
  private async fetchAllStockLevels(
    tenantId: string,
    includeDeleted: boolean = false,
    maxRecords: number = 10000
  ): Promise<any[]> {
    const stockLevels: any[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;
    
    while (hasMore && stockLevels.length < maxRecords) {
      const result = await this.stockLevelService.listStockLevels(
        tenantId, 
        {}, 
        page, 
        pageSize,
        includeDeleted
      );
      
      stockLevels.push(...result.items);
      hasMore = result.hasMore;
      page++;
      
      if (stockLevels.length >= maxRecords) {
        break;
      }
    }
    
    return stockLevels.slice(0, maxRecords);
  }
  
  /**
   * 處理要導出的項目，過濾欄位
   * @private
   */
  private processItemsForExport(
    items: any[],
    includeFields?: string[],
    excludeFields?: string[]
  ): any[] {
    return items.map(item => {
      const result: any = {};
      
      // 如果指定了包含欄位，只保留這些欄位
      if (includeFields && includeFields.length > 0) {
        includeFields.forEach(field => {
          if (item[field] !== undefined) {
            result[field] = item[field];
          }
        });
        return result;
      }
      
      // 否則，拷貝所有欄位，排除指定的欄位
      Object.keys(item).forEach(key => {
        if (!excludeFields || !excludeFields.includes(key)) {
          result[key] = item[key];
        }
      });
      
      return result;
    });
  }
  
  /**
   * 根據格式導出數據
   * @private
   */
  private exportDataToFormat(
    data: any[],
    format: ExportFormat,
    options: ExportOptions
  ): string | Buffer {
    // 處理CSV和Excel格式的列定義
    if ((format === 'csv' || format === 'excel') && !options.columns) {
      // 自動生成列定義
      if (data.length > 0) {
        options.columns = this.generateColumnsFromData(data[0]);
      }
    }
    
    // 使用批量處理工具導出數據
    return exportData(data, {
      ...options,
      format
    });
  }
  
  /**
   * 從數據自動生成列定義
   * @private
   */
  private generateColumnsFromData(data: any): Array<{
    header: string;
    field: string;
    type?: 'string' | 'number' | 'boolean' | 'date';
  }> {
    const columns: Array<{
      header: string;
      field: string;
      type?: 'string' | 'number' | 'boolean' | 'date';
    }> = [];
    
    Object.keys(data).forEach(key => {
      let type: 'string' | 'number' | 'boolean' | 'date' | undefined;
      
      // 嘗試推斷類型
      if (typeof data[key] === 'number') {
        type = 'number';
      } else if (typeof data[key] === 'boolean') {
        type = 'boolean';
      } else if (data[key] instanceof Date) {
        type = 'date';
      } else if (typeof data[key] === 'string') {
        type = 'string';
      }
      
      columns.push({
        header: this.formatHeaderFromField(key),
        field: key,
        type
      });
    });
    
    return columns;
  }
  
  /**
   * 將欄位名稱格式化為表頭
   * @private
   */
  private formatHeaderFromField(field: string): string {
    // 將駝峰命名轉換為空格分隔的標題格式
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
  
  // #endregion 導出輔助方法
  
  // #region 導入輔助方法
  
  /**
   * 解析導入數據
   * @private
   */
  private parseImportData<T>(
    data: string | Buffer,
    format: ExportFormat,
    options: ImportOptions
  ): T[] {
    // 使用批量處理工具解析數據
    return importData(data, {
      ...options,
      format
    });
  }
  
  /**
   * 處理庫存品項導入
   * @private
   */
  private async processInventoryItemsImport(
    tenantId: string,
    userId: string,
    items: InventoryItemImport[],
    options: ImportOptions
  ): Promise<ImportResult> {
    // 初始化結果
    const result: ImportResult = {
      totalCount: items.length,
      successCount: 0,
      failureCount: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errors: []
    };
    
    // 驗證和預處理項目
    const validItems: InventoryItemImport[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      try {
        // 驗證項目
        validateInventoryItem(item);
        validItems.push(item);
      } catch (error: any) {
        if (options.skipInvalid) {
          // 記錄跳過的項目
          result.skippedCount++;
          result.errors?.push({
            index: i,
            record: item,
            message: error.message || '驗證失敗'
          });
        } else {
          // 驗證失敗直接返回錯誤
          throw new ValidationError(
            `第 ${i + 1} 項驗證失敗: ${error.message}`,
            error.invalidFields
          );
        }
      }
    }
    
    // 如果有需要更新的，先獲取現有項目
    let existingItems: Record<string, any> = {};
    if (options.updateExisting) {
      const existingIds = validItems.filter(item => item.itemId).map(item => item.itemId!);
      
      if (existingIds.length > 0) {
        existingItems = await this.inventoryItemService.batchGetItems(existingIds, tenantId);
      }
    }
    
    // 處理導入
    const processedResult = await this.batchOperationService.executeBatchWrite(
      validItems,
      async (batch) => {
        const results = [];
        
        for (const item of batch) {
          try {
            let isUpdate = false;
            
            // 檢查是否為更新
            if (item.itemId && existingItems[item.itemId]) {
              isUpdate = true;
              
              // 如果不允許更新，則跳過
              if (!options.updateExisting) {
                result.skippedCount++;
                continue;
              }
              
              // 合併現有資料和新資料
              const mergedItem = {
                ...existingItems[item.itemId],
                ...item,
                updatedBy: userId
              };
              
              // 更新品項
              const updatedItem = await this.inventoryItemService.updateItem(
                item.itemId,
                mergedItem,
                tenantId,
                userId
              );
              
              result.updatedCount++;
              result.successCount++;
              results.push(updatedItem);
            } else {
              // 創建新品項
              const newItem = await this.inventoryItemService.createItem(
                {
                  ...item,
                  createdBy: userId
                },
                tenantId,
                userId,
                item.itemId
              );
              
              result.createdCount++;
              result.successCount++;
              results.push(newItem);
            }
          } catch (error: any) {
            // 記錄錯誤
            result.failureCount++;
            result.errors?.push({
              index: batch.indexOf(item),
              record: item,
              message: error.message || '處理失敗'
            });
          }
        }
        
        return results;
      },
      {
        tenantId,
        userId,
        batchSize: 20,
        operationName: '導入庫存品項',
        trackProgress: !!options.progressCallback,
        cacheInvalidation: {
          prefixes: [CachePrefix.LIST]
        }
      }
    );
    
    // 清除相關緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.LIST}inventoryItems_${tenantId}`);
    
    return result;
  }
  
  /**
   * 處理庫存水平導入
   * @private
   */
  private async processStockLevelsImport(
    tenantId: string,
    userId: string,
    stockLevels: StockLevelImport[],
    options: ImportOptions
  ): Promise<ImportResult> {
    // 初始化結果
    const result: ImportResult = {
      totalCount: stockLevels.length,
      successCount: 0,
      failureCount: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errors: []
    };
    
    // 獲取所有相關品項
    const itemIds = [...new Set(stockLevels.map(sl => sl.itemId))];
    let itemsMap: Record<string, any> = {};
    
    if (itemIds.length > 0) {
      itemsMap = await this.inventoryItemService.batchGetItems(itemIds, tenantId);
    }
    
    // 檢查品項存在
    const validStockLevels: StockLevelImport[] = [];
    const missingItems: { itemId: string; stockLevel: StockLevelImport }[] = [];
    
    for (let i = 0; i < stockLevels.length; i++) {
      const stockLevel = stockLevels[i];
      
      if (!itemsMap[stockLevel.itemId]) {
        if (options.createReferences) {
          // 記錄缺失的品項，稍後創建
          missingItems.push({ itemId: stockLevel.itemId, stockLevel });
        } else {
          // 記錄缺失品項錯誤
          result.skippedCount++;
          result.errors?.push({
            index: i,
            record: stockLevel,
            message: `品項 ${stockLevel.itemId} 不存在`
          });
          continue;
        }
      }
      
      validStockLevels.push(stockLevel);
    }
    
    // 如果需要，創建缺失的品項
    if (options.createReferences && missingItems.length > 0) {
      await this.createMissingItems(tenantId, userId, missingItems, result);
    }
    
    // 處理導入
    const batchResult = await this.batchOperationService.executeBatchWrite(
      validStockLevels,
      async (batch) => {
        const results = [];
        
        for (const stockLevel of batch) {
          try {
            // 更新或創建庫存水平
            const updatedStockLevel = await this.stockLevelService.setStockLevel(
              stockLevel.itemId,
              stockLevel.storeId,
              stockLevel.quantity,
              tenantId,
              userId,
              stockLevel.lowStockThreshold,
              stockLevel.location
            );
            
            if (updatedStockLevel.isNew) {
              result.createdCount++;
            } else {
              result.updatedCount++;
            }
            
            result.successCount++;
            results.push(updatedStockLevel);
          } catch (error: any) {
            // 記錄錯誤
            result.failureCount++;
            result.errors?.push({
              index: batch.indexOf(stockLevel),
              record: stockLevel,
              message: error.message || '處理失敗'
            });
          }
        }
        
        return results;
      },
      {
        tenantId,
        userId,
        batchSize: 20,
        operationName: '導入庫存水平',
        trackProgress: !!options.progressCallback,
        cacheInvalidation: {
          prefixes: [CachePrefix.LIST, CachePrefix.STOCK_LEVEL],
          itemIdField: 'itemId',
          storeIdField: 'storeId'
        }
      }
    );
    
    return result;
  }
  
  /**
   * 創建缺失的品項
   * @private
   */
  private async createMissingItems(
    tenantId: string,
    userId: string,
    missingItems: Array<{ itemId: string; stockLevel: StockLevelImport }>,
    result: ImportResult
  ): Promise<void> {
    // 批量創建缺失的品項
    await this.batchOperationService.executeBatchWrite(
      missingItems,
      async (batch) => {
        const results = [];
        
        for (const { itemId, stockLevel } of batch) {
          try {
            // 創建基本品項
            const newItem = await this.inventoryItemService.createItem(
              {
                itemId,
                name: `品項 ${itemId}`,
                sku: `SKU_${itemId}`,
                lowStockThreshold: stockLevel.lowStockThreshold || 0,
                createdBy: userId
              },
              tenantId,
              userId,
              itemId
            );
            
            results.push(newItem);
          } catch (error: any) {
            // 記錄創建品項錯誤
            result.errors?.push({
              index: -1, // 不對應導入數據的特定索引
              record: { itemId },
              message: `創建缺失品項失敗: ${error.message || '處理失敗'}`
            });
          }
        }
        
        return results;
      },
      {
        tenantId,
        userId,
        batchSize: 20,
        operationName: '創建缺失品項',
        cacheInvalidation: {
          prefixes: [CachePrefix.LIST, CachePrefix.INVENTORY_ITEM]
        }
      }
    );
  }
  
  // #endregion 導入輔助方法
} 