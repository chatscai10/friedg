/**
 * 庫存水平服務
 * 
 * 處理庫存水平的業務邏輯
 */
import { StockLevel, StockLevelsFilter } from '../inventory.types';
import { StockLevelRepository } from '../repositories/stock-level.repository';
import { InventoryItemService } from './inventory-item.service';
import { MemoryCache } from '../cache/memory-cache';
import { validateStockLevel } from '../utils/validators';
import { NegativeStockError, TransactionTooLargeError } from '../utils/errors';
import { processBatches } from '../utils/batch-processor';

export class StockLevelService {
  private stockLevelCache: MemoryCache<StockLevel>;
  private listCache: MemoryCache<any>;
  
  constructor(
    private repository: StockLevelRepository,
    private inventoryItemService: InventoryItemService
  ) {
    this.stockLevelCache = new MemoryCache<StockLevel>(300); // 5分鐘
    this.listCache = new MemoryCache<any>(60); // 1分鐘
  }
  
  /**
   * 獲取或更新庫存水平
   */
  async upsertStockLevel(
    itemId: string, 
    storeId: string, 
    tenantId: string, 
    quantity: number, 
    lowStockThreshold?: number,
    userId?: string
  ) {
    // 驗證庫存數量
    if (quantity < 0) {
      throw new NegativeStockError(itemId, storeId);
    }
    
    // 檢查品項是否存在
    const item = await this.inventoryItemService.getItem(itemId, tenantId);
    if (!item) {
      throw new Error(`找不到 ID 為 ${itemId} 的庫存品項`);
    }
    
    // 如果未指定低庫存閾值，使用品項預設值
    if (lowStockThreshold === undefined) {
      lowStockThreshold = item.lowStockThreshold;
    }
    
    // 更新庫存水平
    const updatedLevel = await this.repository.upsertStockLevel(
      itemId, 
      storeId, 
      tenantId, 
      quantity, 
      lowStockThreshold,
      userId
    );
    
    // 更新緩存
    const cacheKey = `stocklevel_${tenantId}_${storeId}_${itemId}`;
    this.stockLevelCache.set(cacheKey, updatedLevel);
    
    // 清除相關列表緩存
    this.listCache.invalidateByPrefix(`stocklevels_${tenantId}`);
    
    return updatedLevel;
  }
  
  /**
   * 獲取特定品項的庫存水平
   */
  async getStockLevel(itemId: string, storeId: string, tenantId: string): Promise<StockLevel | null> {
    const cacheKey = `stocklevel_${tenantId}_${storeId}_${itemId}`;
    
    // 檢查緩存
    const cachedLevel = this.stockLevelCache.get(cacheKey);
    if (cachedLevel) {
      return cachedLevel;
    }
    
    // 從儲存庫獲取
    const stockLevel = await this.repository.getStockLevel(itemId, storeId, tenantId);
    
    // 存入緩存
    if (stockLevel) {
      this.stockLevelCache.set(cacheKey, stockLevel);
    }
    
    return stockLevel;
  }
  
  /**
   * 獲取特定分店的庫存水平
   */
  async getStoreStockLevels(
    storeId: string, 
    tenantId: string, 
    filter: StockLevelsFilter = {},
    page = 1, 
    pageSize = 20
  ) {
    // 構建緩存鍵
    const filterKey = JSON.stringify(filter);
    const cacheKey = `stocklevels_${tenantId}_${storeId}_${filterKey}_p${page}_s${pageSize}`;
    
    // 檢查緩存
    const cachedResult = this.listCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    // 從儲存庫獲取基礎數據
    const stockLevelsResult = await this.repository.getStoreStockLevels(
      storeId, 
      tenantId, 
      filter,
      page, 
      pageSize
    );
    
    // 如果沒有數據，直接返回
    if (!stockLevelsResult.levels.length) {
      return stockLevelsResult;
    }
    
    // 收集所有不重複的商品ID
    const itemIds = [...new Set(stockLevelsResult.levels.map(level => level.itemId))];
    
    // 獲取所有品項的詳情
    const itemsMap = await this.inventoryItemService.batchGetItems(itemIds, tenantId);
    
    // 組合庫存水平和品項詳情
    const levels = stockLevelsResult.levels.map(level => ({
      ...level,
      item: itemsMap[level.itemId] || null
    }));
    
    // 應用更多過濾條件
    let filteredLevels = levels;
    
    if (filter.category) {
      filteredLevels = filteredLevels.filter(item => 
        item.item && item.item.category === filter.category
      );
    }
    
    if (filter.name) {
      const searchTerm = filter.name.toLowerCase();
      filteredLevels = filteredLevels.filter(item => 
        item.item && (
          item.item.name.toLowerCase().includes(searchTerm) || 
          (item.item.description && item.item.description.toLowerCase().includes(searchTerm))
        )
      );
    }
    
    if (filter.lowStock) {
      filteredLevels = filteredLevels.filter(item => {
        const itemLowThreshold = item.item?.lowStockThreshold || 0;
        const levelLowThreshold = item.lowStockThreshold || itemLowThreshold;
        return item.quantity < levelLowThreshold;
      });
    }
    
    const result = {
      levels: filteredLevels,
      pagination: stockLevelsResult.pagination
    };
    
    // 存入緩存
    this.listCache.set(cacheKey, result);
    
    return result;
  }
  
  /**
   * 批量獲取多個商品的庫存水平
   */
  async batchGetStockLevels(
    itemIds: string[], 
    storeId: string | null, 
    tenantId: string
  ): Promise<Record<string, StockLevel[]>> {
    // 檢查空數組
    if (!itemIds.length) return {};
    
    const stockLevelMap: Record<string, StockLevel[]> = {};
    
    // 檢查緩存
    if (storeId) {
      for (const itemId of itemIds) {
        const cacheKey = `stocklevel_${tenantId}_${storeId}_${itemId}`;
        const cachedLevel = this.stockLevelCache.get(cacheKey);
        
        if (cachedLevel) {
          if (!stockLevelMap[itemId]) {
            stockLevelMap[itemId] = [];
          }
          stockLevelMap[itemId].push(cachedLevel);
        }
      }
    }
    
    // 獲取所有品項的庫存水平
    const dbStockLevelMap = await this.repository.batchGetStockLevels(
      itemIds, 
      storeId, 
      tenantId
    );
    
    // 合併結果並更新緩存
    for (const [itemId, levels] of Object.entries(dbStockLevelMap)) {
      // 更新緩存
      if (storeId && levels.length === 1) {
        const level = levels[0];
        const cacheKey = `stocklevel_${tenantId}_${storeId}_${itemId}`;
        this.stockLevelCache.set(cacheKey, level);
      }
      
      // 合併到結果map
      if (!stockLevelMap[itemId]) {
        stockLevelMap[itemId] = [];
      }
      
      // 過濾掉可能重複的項目
      for (const level of levels) {
        if (!stockLevelMap[itemId].some(l => l.stockLevelId === level.stockLevelId)) {
          stockLevelMap[itemId].push(level);
        }
      }
    }
    
    return stockLevelMap;
  }

  /**
   * 批量更新庫存水平
   */
  async batchUpdateStockLevels(
    tenantId: string,
    items: {
      itemId: string;
      storeId: string;
      quantity: number;
      lowStockThreshold?: number;
    }[],
    userId: string,
    reason?: string
  ) {
    // 檢查空數組
    if (!items.length) {
      return {
        success: true,
        results: [],
        successCount: 0,
        failureCount: 0
      };
    }
    
    // 檢查批次大小
    if (items.length > 500) {
      throw new TransactionTooLargeError();
    }
    
    // 使用批次處理工具處理
    const batchResults = await processBatches(
      items,
      batchItems => this.processBatchUpdateStockLevels(tenantId, batchItems, userId, reason),
      20 // 每批最多20個
    );
    
    // 合併結果
    const results = batchResults.flatMap(r => r.results);
    const successCount = batchResults.reduce((sum, r) => sum + r.successCount, 0);
    const failureCount = batchResults.reduce((sum, r) => sum + r.failureCount, 0);
    
    // 清除相關列表緩存
    this.listCache.invalidateByPrefix(`stocklevels_${tenantId}`);
    
    return {
      success: failureCount === 0,
      results,
      successCount,
      failureCount
    };
  }
  
  /**
   * 處理單個批次的庫存水平更新
   * @private
   */
  private async processBatchUpdateStockLevels(
    tenantId: string,
    items: {
      itemId: string;
      storeId: string;
      quantity: number;
      lowStockThreshold?: number;
    }[],
    userId: string,
    reason?: string
  ) {
    // 收集所有要更新的品項ID
    const itemIds = [...new Set(items.map(item => item.itemId))];
    
    // 批量獲取品項信息
    const itemsMap = await this.inventoryItemService.batchGetItems(itemIds, tenantId);
    
    // 檢查所有品項是否存在
    const missingItemIds = itemIds.filter(id => !itemsMap[id]);
    if (missingItemIds.length > 0) {
      throw new Error(`找不到以下品項: ${missingItemIds.join(', ')}`);
    }
    
    // 使用儲存庫執行事務處理
    const result = await this.repository.batchUpdateStockLevels(
      tenantId,
      items,
      userId
    );
    
    // 清除相關緩存
    for (const item of items) {
      const cacheKey = `stocklevel_${tenantId}_${item.storeId}_${item.itemId}`;
      this.stockLevelCache.delete(cacheKey);
    }
    
    return result;
  }
} 