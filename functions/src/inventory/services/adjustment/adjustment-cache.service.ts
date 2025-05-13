/**
 * 庫存調整緩存服務
 * 
 * 處理庫存調整相關的緩存管理
 */
import { StockAdjustment, StockAdjustmentsFilter } from '../../inventory.types';
import { StockAdjustmentRepository } from '../../repositories/stock-adjustment.repository';
import { cacheManager, CacheLevel, CachePrefix } from '../../cache/cache-manager';

/**
 * 庫存調整緩存服務類
 */
export class AdjustmentCacheService {
  constructor(
    private repository: StockAdjustmentRepository
  ) {}
  
  /**
   * 從緩存或資料庫獲取調整記錄
   */
  async getAdjustmentWithCache(adjustmentId: string, tenantId: string): Promise<StockAdjustment> {
    // 構建緩存鍵
    const cacheKey = `${CachePrefix.STOCK_ADJUSTMENT}${tenantId}_${adjustmentId}`;
    
    // 嘗試從緩存獲取
    const cachedData = cacheManager.get<StockAdjustment>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    // 從資料庫獲取
    const adjustment = await this.repository.getAdjustment(adjustmentId, tenantId);
    
    if (!adjustment) {
      throw new Error(`找不到 ID 為 ${adjustmentId} 的庫存調整記錄`);
    }
    
    // 存入緩存 (長期緩存，因為歷史調整很少變化)
    cacheManager.set(cacheKey, adjustment, CacheLevel.LEVEL3);
    
    return adjustment;
  }
  
  /**
   * 從緩存或資料庫獲取調整記錄列表
   */
  async listAdjustmentsWithCache(
    tenantId: string,
    filter: StockAdjustmentsFilter,
    page: number,
    pageSize: number
  ) {
    // 構建緩存鍵
    const filterKey = JSON.stringify(filter);
    const cacheKey = `${CachePrefix.LIST}adjustments_${tenantId}_${filterKey}_p${page}_s${pageSize}`;
    
    // 嘗試從緩存獲取
    const cachedResult = cacheManager.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    // 從儲存庫獲取數據
    const result = await this.repository.listAdjustments(tenantId, filter, page, pageSize);
    
    // 存入緩存 (中期緩存)
    cacheManager.set(cacheKey, result, CacheLevel.LEVEL2);
    
    return result;
  }
  
  /**
   * 清除與特定調整相關的所有緩存
   */
  invalidateAdjustmentCache(
    tenantId: string,
    adjustmentId: string
  ): void {
    // 清除特定調整記錄緩存
    cacheManager.invalidate(`${CachePrefix.STOCK_ADJUSTMENT}${tenantId}_${adjustmentId}`);
    
    // 清除調整列表緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.LIST}adjustments_${tenantId}`);
  }
  
  /**
   * 清除與品項和店鋪相關的所有緩存
   */
  invalidateItemStoreCache(
    tenantId: string,
    itemId: string,
    storeId: string
  ): void {
    // 清除庫存水平緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.STOCK_LEVEL}${tenantId}_${itemId}_${storeId}`);
    
    // 清除庫存水平列表緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.LIST}stockLevels_${tenantId}`);
    
    // 清除品項相關緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.INVENTORY_ITEM}${tenantId}_${itemId}`);
    
    // 清除調整記錄列表緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.LIST}adjustments_${tenantId}`);
  }
} 