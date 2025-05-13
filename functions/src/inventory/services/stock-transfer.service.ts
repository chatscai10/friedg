/**
 * 庫存移撥服務
 * 
 * 專門處理庫存移撥相關的業務邏輯
 */
import * as admin from 'firebase-admin';
import { 
  StockAdjustment, 
  StockAdjustmentType, 
  StockLevel 
} from '../inventory.types';
import { firestoreProvider } from '../db/database.provider';
import { NegativeStockError } from '../utils/errors';

export class StockTransferService {
  /**
   * 執行庫存移撥操作
   * 
   * @param sourceData 來源庫存數據
   * @param targetStoreId 目標店鋪ID
   * @param quantity 移撥數量 (正數)
   * @param userId 操作用戶ID
   * @param options 其他選項
   * @returns 移撥的調整記錄
   */
  async executeTransfer(
    sourceData: {
      itemId: string,
      storeId: string,
      tenantId: string,
      currentQuantity: number
    },
    targetStoreId: string,
    quantity: number,
    userId: string,
    options: {
      reason?: string,
      adjustmentDate?: Date
    } = {}
  ): Promise<{
    sourceAdjustment: StockAdjustment,
    targetAdjustment: StockAdjustment
  }> {
    // 驗證移撥數量
    if (quantity <= 0) {
      throw new Error('移撥數量必須為正數');
    }

    // 確保不會為負數
    if (sourceData.currentQuantity < quantity) {
      throw new NegativeStockError(sourceData.itemId, sourceData.storeId);
    }

    // 使用事務處理移撥過程
    return firestoreProvider.runTransaction(async transaction => {
      const now = admin.firestore.Timestamp.now();
      const adjustmentDate = options.adjustmentDate || now.toDate();

      // 1. 處理來源店鋪庫存減少
      const sourceNewQuantity = sourceData.currentQuantity - quantity;
      
      // 創建來源調整記錄
      const sourceAdjustmentId = firestoreProvider.collection('stockAdjustments').doc().id;
      const sourceAdjustment: StockAdjustment = {
        adjustmentId: sourceAdjustmentId,
        itemId: sourceData.itemId,
        storeId: sourceData.storeId,
        tenantId: sourceData.tenantId,
        adjustmentType: StockAdjustmentType.TRANSFER,
        quantityAdjusted: -quantity,
        reason: options.reason,
        adjustmentDate,
        operatorId: userId,
        beforeQuantity: sourceData.currentQuantity,
        afterQuantity: sourceNewQuantity,
        transferToStoreId: targetStoreId
      };

      // 2. 獲取目標店鋪庫存
      const targetStockLevelQuery = await transaction.get(
        firestoreProvider.collection('stockLevels')
          .where('itemId', '==', sourceData.itemId)
          .where('storeId', '==', targetStoreId)
          .where('tenantId', '==', sourceData.tenantId)
          .limit(1)
      );
      
      let targetCurrentQuantity = 0;
      let targetStockLevelRef;
      let targetStockLevelId;
      let targetLowStockThreshold = 0;
      
      // 處理目標庫存水平
      if (!targetStockLevelQuery.empty) {
        const targetStockLevelDoc = targetStockLevelQuery.docs[0];
        targetStockLevelRef = targetStockLevelDoc.ref;
        const targetStockLevelData = targetStockLevelDoc.data() as StockLevel;
        targetStockLevelId = targetStockLevelData.stockLevelId;
        targetCurrentQuantity = targetStockLevelData.quantity;
        targetLowStockThreshold = targetStockLevelData.lowStockThreshold;
      } else {
        // 創建新目標庫存水平
        targetStockLevelId = firestoreProvider.collection('stockLevels').doc().id;
        targetStockLevelRef = firestoreProvider.collection('stockLevels').doc(targetStockLevelId);
      }
      
      // 3. 計算目標店鋪新數量
      const targetNewQuantity = targetCurrentQuantity + quantity;
      
      // 4. 創建目標調整記錄
      const targetAdjustmentId = firestoreProvider.collection('stockAdjustments').doc().id;
      const targetAdjustment: StockAdjustment = {
        adjustmentId: targetAdjustmentId,
        itemId: sourceData.itemId,
        storeId: targetStoreId,
        tenantId: sourceData.tenantId,
        adjustmentType: StockAdjustmentType.RECEIPT,
        quantityAdjusted: quantity,
        reason: `從 ${sourceData.storeId} 移撥${options.reason ? `: ${options.reason}` : ''}`,
        adjustmentDate,
        operatorId: userId,
        beforeQuantity: targetCurrentQuantity,
        afterQuantity: targetNewQuantity,
        transferToStoreId: sourceData.storeId // 反向引用
      };
      
      // 5. 更新目標庫存水平
      transaction.set(targetStockLevelRef, {
        stockLevelId: targetStockLevelId,
        itemId: sourceData.itemId,
        storeId: targetStoreId,
        tenantId: sourceData.tenantId,
        quantity: targetNewQuantity,
        lowStockThreshold: targetLowStockThreshold,
        lastUpdated: now.toDate(),
        lastUpdatedBy: userId
      }, { merge: true });
      
      // 6. 寫入調整記錄
      transaction.set(
        firestoreProvider.collection('stockAdjustments').doc(sourceAdjustmentId), 
        sourceAdjustment
      );
      
      transaction.set(
        firestoreProvider.collection('stockAdjustments').doc(targetAdjustmentId), 
        targetAdjustment
      );
      
      return {
        sourceAdjustment,
        targetAdjustment
      };
    });
  }
} 