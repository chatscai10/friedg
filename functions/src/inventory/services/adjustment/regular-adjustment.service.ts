/**
 * 一般庫存調整服務
 * 
 * 處理非移撥類型的庫存調整操作
 */
import * as admin from 'firebase-admin';
import { StockAdjustment, StockAdjustmentType } from '../../inventory.types';
import { StockOperationService } from '../stock-operation.service';
import { InventoryItemService } from '../inventory-item.service';
import { firestoreProvider } from '../../db/database.provider';
import { cacheManager, CachePrefix } from '../../cache/cache-manager';
import { NegativeStockError } from '../../utils/errors';

/**
 * 調整選項介面
 */
export interface AdjustmentOptions {
  /** 調整原因 */
  reason?: string;
  /** 調整日期 */
  adjustmentDate?: Date;
  /** 移撥目標店鋪ID (僅用於移撥類型) */
  transferToStoreId?: string;
}

/**
 * 一般庫存調整服務類
 */
export class RegularAdjustmentService {
  private stockOperationService: StockOperationService;
  
  constructor(
    private inventoryItemService: InventoryItemService
  ) {
    this.stockOperationService = new StockOperationService();
  }
  
  /**
   * 執行一般庫存調整操作
   */
  async executeAdjustment(
    tenantId: string,
    itemId: string,
    storeId: string,
    adjustmentType: StockAdjustmentType,
    quantityAdjusted: number,
    userId: string,
    options: AdjustmentOptions = {}
  ): Promise<StockAdjustment> {
    // 獲取品項閾值
    const item = await this.inventoryItemService.getItem(itemId, tenantId);
    
    // 使用事務處理調整
    const adjustment = await firestoreProvider.runTransaction(async transaction => {
      // 獲取或創建庫存水平
      const stockLevelInfo = await this.stockOperationService.getOrCreateStockLevel(
        transaction,
        itemId,
        storeId,
        tenantId,
        item!.lowStockThreshold || 0
      );
      
      // 計算新數量和驗證
      const newQuantity = this.calculateAndValidateNewQuantity(
        stockLevelInfo.currentQuantity,
        quantityAdjusted,
        itemId,
        storeId
      );
      
      // 創建調整記錄
      const adjustment = this.stockOperationService.createAdjustmentRecord(
        transaction,
        {
          itemId,
          storeId,
          tenantId,
          adjustmentType,
          quantityAdjusted,
          beforeQuantity: stockLevelInfo.currentQuantity,
          afterQuantity: newQuantity,
          operatorId: userId,
          reason: options.reason,
          adjustmentDate: options.adjustmentDate
        }
      );
      
      // 更新庫存水平
      this.stockOperationService.updateStockLevel(
        transaction,
        stockLevelInfo.stockLevelRef,
        stockLevelInfo.stockLevelId,
        {
          itemId,
          storeId,
          tenantId,
          quantity: newQuantity,
          lowStockThreshold: stockLevelInfo.lowStockThreshold
        },
        userId,
        stockLevelInfo.isNew
      );
      
      return adjustment;
    });
    
    // 清除相關緩存
    this.invalidateRelatedCaches(tenantId, itemId, storeId);
    
    return adjustment;
  }
  
  /**
   * 計算並驗證新庫存量
   * @private
   */
  private calculateAndValidateNewQuantity(
    currentQuantity: number,
    quantityAdjusted: number,
    itemId: string,
    storeId: string
  ): number {
    // 計算新數量
    const newQuantity = currentQuantity + quantityAdjusted;
    
    // 確保不為負數
    if (newQuantity < 0) {
      throw new NegativeStockError(itemId, storeId);
    }
    
    return newQuantity;
  }
  
  /**
   * 清除相關緩存
   * @private
   */
  private invalidateRelatedCaches(
    tenantId: string,
    itemId: string,
    storeId: string
  ): void {
    // 清除調整記錄列表緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.LIST}adjustments_${tenantId}`);
    
    // 清除庫存水平緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.STOCK_LEVEL}${tenantId}_${itemId}_${storeId}`);
    
    // 清除品項相關緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.INVENTORY_ITEM}${tenantId}_${itemId}`);
  }
} 