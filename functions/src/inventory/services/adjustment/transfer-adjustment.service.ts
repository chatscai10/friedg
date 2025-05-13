/**
 * 庫存移撥調整服務
 * 
 * 處理店鋪間的庫存移撥操作
 */
import { StockAdjustment, StockAdjustmentType } from '../../inventory.types';
import { StockLevelRepository } from '../../repositories/stock-level.repository';
import { StockTransferService } from '../stock-transfer.service';
import { cacheManager, CachePrefix } from '../../cache/cache-manager';
import { AdjustmentOptions } from './regular-adjustment.service';

/**
 * 庫存移撥調整服務類
 */
export class TransferAdjustmentService {
  constructor(
    private stockLevelRepository: StockLevelRepository,
    private stockTransferService: StockTransferService
  ) {}
  
  /**
   * 執行庫存移撥調整操作
   */
  async executeTransfer(
    tenantId: string,
    itemId: string,
    sourceStoreId: string,
    targetStoreId: string,
    quantityAdjusted: number,
    userId: string,
    options: AdjustmentOptions = {}
  ): Promise<StockAdjustment> {
    // 獲取當前庫存水平
    const sourceStockLevel = await this.stockLevelRepository.getStockLevel(
      itemId, 
      sourceStoreId, 
      tenantId
    );
    
    if (!sourceStockLevel) {
      throw new Error(`找不到品項 ${itemId} 在店鋪 ${sourceStoreId} 的庫存記錄`);
    }
    
    // 使用專門的移撥服務處理
    const transferResult = await this.stockTransferService.executeTransfer(
      {
        itemId,
        storeId: sourceStoreId,
        tenantId,
        currentQuantity: sourceStockLevel.quantity
      },
      targetStoreId,
      Math.abs(quantityAdjusted), // 確保移撥數量為正數
      userId,
      options
    );
    
    // 清除相關緩存
    this.invalidateRelatedCaches(tenantId, itemId, sourceStoreId, targetStoreId);
    
    return transferResult.sourceAdjustment;
  }
  
  /**
   * 驗證移撥參數
   */
  validateTransferParams(
    storeId: string,
    targetStoreId: string,
    quantityAdjusted: number
  ): void {
    if (targetStoreId === storeId) {
      throw new Error('移撥目標店鋪不能與來源店鋪相同');
    }
    
    if (quantityAdjusted >= 0) {
      throw new Error('移撥調整的數量必須為負數');
    }
  }
  
  /**
   * 清除相關緩存
   * @private
   */
  private invalidateRelatedCaches(
    tenantId: string,
    itemId: string,
    sourceStoreId: string,
    targetStoreId: string
  ): void {
    // 清除調整記錄列表緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.LIST}adjustments_${tenantId}`);
    
    // 清除來源店鋪庫存水平緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.STOCK_LEVEL}${tenantId}_${itemId}_${sourceStoreId}`);
    
    // 清除目標店鋪庫存水平緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.STOCK_LEVEL}${tenantId}_${itemId}_${targetStoreId}`);
    
    // 清除品項相關緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.INVENTORY_ITEM}${tenantId}_${itemId}`);
  }
} 