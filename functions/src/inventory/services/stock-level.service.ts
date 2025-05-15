/**
 * 庫存水平服務 (重構後)
 * 
 * 主要職責: 更新 menuItems 集合中單個菜單項的庫存水平。
 * 舊的針對 stockLevels 集合的操作方法已被移除。
 */
// import { StockLevel, StockLevelsFilter } from '../inventory.types'; // StockLevel no longer primary entity here
// import { StockLevelRepository } from '../repositories/stock-level.repository'; // Repository for stockLevels collection, to be removed
// import { InventoryItemService } from './inventory-item.service'; // Not directly used by upsertStockLevel_REFACTORED
import { StockAdjustmentService } from './stock-adjustment.service';
import { MemoryCache } from '../../../utils/memory-cache'; // Corrected path
// import { validateStockLevel } from '../utils/validators';
// import { NegativeStockError, TransactionTooLargeError } from '../utils/errors';
// import { processBatches } from '../utils/batch-processor';
import * as admin from 'firebase-admin';
import { logger } from '../../logger';
import { StockAdjustmentType } from '../inventory.types'; // Keep for StockAdjustmentType

const db = admin.firestore();

export class StockLevelService {
  // StockLevelRepository and InventoryItemService removed from constructor if not used by remaining methods
  constructor(
    private stockAdjustmentService: StockAdjustmentService,
    // Caches might still be useful if we add read methods for menuItem stock, but for now, only upsert exists.
    // private stockLevelCache: MemoryCache<any>, // Type would change from StockLevel
    // private listCache: MemoryCache<any>
  ) {}
  
  // All old methods (upsertStockLevel, getStockLevel, getStoreStockLevels, batchGetStockLevels, batchUpdateStockLevels) are REMOVED.

  /**
   * [REFACTORED] 更新 Firestore 中 `menuItems` 集合內特定菜單項的庫存水平。
   *
   * 此方法通過事務執行以下操作：
   * 1. 驗證目標 `menuItem` 是否存在及其 `storeId` 和 `tenantId` 是否匹配。
   * 2. 更新 `menuItem` 文檔中的嵌套 `stock` 對象字段 (`stock.current`, `stock.manageStock`, `stock.lowStockThreshold`)。
   * 3. 調用 `StockAdjustmentService.createAdjustmentRecordInTransaction_REFACTORED` 來記錄庫存調整。
   *
   * @param itemId - 菜單品項的文檔ID (在 `menuItems` 集合中)。
   * @param storeId - 菜單品項所屬的商店ID。
   * @param tenantId - 租戶ID。
   * @param quantity - 更新後的絕對庫存數量。
   * @param lowStockThreshold - (可選) 低庫存閾值。如果未提供，則保留現有值（如果存在）。
   * @param userId - (可選) 執行操作的用戶ID。
   * @param reason - (可選) 本次庫存設定的原因，用於調整記錄。默認為 'Manual stock level set'。
   * @returns Promise resolving to an object containing the updated stock details.
   * @throws Error - 如果菜單項未找到、商店ID或租戶ID不匹配，或StockAdjustmentService不可用。
   */
  async upsertStockLevel_REFACTORED(
    itemId: string, 
    storeId: string, 
    tenantId: string, 
    quantity: number, // Absolute new quantity
    lowStockThreshold?: number,
    userId?: string,
    reason: string = 'Manual stock level set'
  ) {
    const menuItemRef = db.collection('menuItems').doc(itemId);
    const now = admin.firestore.Timestamp.now();

    return db.runTransaction(async transaction => {
      const menuItemDoc = await transaction.get(menuItemRef);

      if (!menuItemDoc.exists) {
        logger.error(`[upsertStockLevel_REFACTORED] MenuItem with ID ${itemId} not found.`);
        throw new Error(`[RefactoredUpsert] Menu item with ID ${itemId} not found.`);
      }

      const menuItemData = menuItemDoc.data() as { 
        storeId?: string; 
        tenantId?: string; 
        stock?: { current?: number; lowStockThreshold?: number; manageStock?: boolean }; 
        updatedAt?: admin.firestore.Timestamp;
      };

      // Validate storeId and tenantId before proceeding
      if (menuItemData.storeId !== storeId) {
        logger.error(`[upsertStockLevel_REFACTORED] MenuItem ${itemId} storeId mismatch. Expected: ${storeId}, Actual: ${menuItemData.storeId}`);
        throw new Error(`[RefactoredUpsert] Menu item ${itemId} is associated with store ${menuItemData.storeId}, not target store ${storeId}.`);
      }
      if (menuItemData.tenantId !== tenantId) {
        logger.error(`[upsertStockLevel_REFACTORED] MenuItem ${itemId} tenantId mismatch. Expected: ${tenantId}, Actual: ${menuItemData.tenantId}`);
        throw new Error(`[RefactoredUpsert] Menu item ${itemId} tenant mismatch. Expected ${tenantId}, got ${menuItemData.tenantId}.`);
      }

      const oldQuantity = menuItemData.stock?.current || 0;
      const quantityAdjusted = quantity - oldQuantity;

      const updatePayload: any = {
        'updatedAt': now,
        'stock.current': quantity,
        'stock.manageStock': true, // Default to true when directly setting stock level
      };

      if (lowStockThreshold !== undefined) {
        updatePayload['stock.lowStockThreshold'] = lowStockThreshold;
      } else if (menuItemData.stock?.lowStockThreshold !== undefined) {
        // If not provided in args, but exists in doc, preserve it.
        updatePayload['stock.lowStockThreshold'] = menuItemData.stock.lowStockThreshold;
      } // If not in args and not in doc, it won't be set (which is fine, can be undefined)

      transaction.update(menuItemRef, updatePayload);
      logger.info(`[upsertStockLevel_REFACTORED] Stock for menuItem ${itemId} in store ${storeId} updated. New quantity: ${quantity}, LowThreshold: ${updatePayload['stock.lowStockThreshold']}`);

      if (this.stockAdjustmentService && typeof this.stockAdjustmentService.createAdjustmentRecordInTransaction_REFACTORED === 'function') {
        await this.stockAdjustmentService.createAdjustmentRecordInTransaction_REFACTORED(transaction, {
          itemId,
          storeId,
          tenantId,
          adjustmentType: StockAdjustmentType.STOCK_COUNT, // This type implies a direct setting of stock level
          quantityAdjusted: quantityAdjusted, 
          beforeQuantity: oldQuantity,
          afterQuantity: quantity,
          reason: reason,
          adjustmentDate: now.toDate(),
          operatorId: userId || 'system_stock_set' // Changed operatorId for clarity
        });
        logger.info(`[upsertStockLevel_REFACTORED] Stock adjustment record created for menuItem ${itemId}, store ${storeId}.`);
      } else {
        logger.warn(`[upsertStockLevel_REFACTORED] stockAdjustmentService.createAdjustmentRecordInTransaction_REFACTORED is not available. Adjustment record NOT created.`);
        // Critical dependency, should throw if service is expected but not available
        throw new Error('StockAdjustmentService is not available for creating adjustment record during stock level update.'); 
      }
      
      return {
        itemId: itemId,
        storeId: storeId,
        tenantId: tenantId,
        quantity: quantity,
        lowStockThreshold: updatePayload['stock.lowStockThreshold'],
        manageStock: updatePayload['stock.manageStock'], // Return the effective manageStock status
        lastUpdated: now.toDate(),
        lastUpdatedBy: userId || 'system_stock_set'
      };
    });
  }
} 