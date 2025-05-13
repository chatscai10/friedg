/**
 * 庫存操作服務
 * 
 * 提供庫存操作的通用邏輯
 */
import * as admin from 'firebase-admin';
import { 
  StockAdjustment, 
  StockAdjustmentType, 
  StockLevel 
} from '../inventory.types';
import { firestoreProvider } from '../db/database.provider';
import { NegativeStockError, ItemNotFoundError } from '../utils/errors';

export class StockOperationService {
  /**
   * 驗證並獲取庫存水平
   */
  async getOrCreateStockLevel(
    transaction: admin.firestore.Transaction,
    itemId: string,
    storeId: string,
    tenantId: string,
    lowStockThreshold: number = 0
  ): Promise<{
    stockLevelRef: admin.firestore.DocumentReference,
    stockLevelId: string,
    currentQuantity: number,
    lowStockThreshold: number,
    isNew: boolean
  }> {
    // 獲取當前庫存水平
    const stockLevelQuery = await transaction.get(
      firestoreProvider.collection('stockLevels')
        .where('itemId', '==', itemId)
        .where('storeId', '==', storeId)
        .where('tenantId', '==', tenantId)
        .limit(1)
    );
    
    let currentQuantity = 0;
    let stockLevelRef;
    let stockLevelId;
    let currentLowStockThreshold = lowStockThreshold;
    let isNew = false;
    
    // 處理現有庫存水平
    if (!stockLevelQuery.empty) {
      const stockLevelDoc = stockLevelQuery.docs[0];
      stockLevelRef = stockLevelDoc.ref;
      const stockLevelData = stockLevelDoc.data() as StockLevel;
      stockLevelId = stockLevelData.stockLevelId;
      currentQuantity = stockLevelData.quantity;
      currentLowStockThreshold = stockLevelData.lowStockThreshold;
    } else {
      // 創建新庫存水平
      isNew = true;
      stockLevelId = firestoreProvider.collection('stockLevels').doc().id;
      stockLevelRef = firestoreProvider.collection('stockLevels').doc(stockLevelId);
    }
    
    return {
      stockLevelRef,
      stockLevelId,
      currentQuantity,
      lowStockThreshold: currentLowStockThreshold,
      isNew
    };
  }
  
  /**
   * 更新庫存水平
   */
  updateStockLevel(
    transaction: admin.firestore.Transaction,
    stockLevelRef: admin.firestore.DocumentReference,
    stockLevelId: string,
    stockLevelData: {
      itemId: string,
      storeId: string,
      tenantId: string,
      quantity: number,
      lowStockThreshold: number
    },
    userId: string,
    isNew: boolean = false
  ): void {
    const now = admin.firestore.Timestamp.now();
    
    // 檢查數量是否為負
    if (stockLevelData.quantity < 0) {
      throw new NegativeStockError(stockLevelData.itemId, stockLevelData.storeId);
    }
    
    // 設置庫存水平數據
    const stockLevel: StockLevel = {
      stockLevelId,
      itemId: stockLevelData.itemId,
      storeId: stockLevelData.storeId,
      tenantId: stockLevelData.tenantId,
      quantity: stockLevelData.quantity,
      lowStockThreshold: stockLevelData.lowStockThreshold,
      lastUpdated: now.toDate(),
      lastUpdatedBy: userId
    };
    
    // 如果是新記錄則創建，否則更新
    if (isNew) {
      transaction.set(stockLevelRef, stockLevel);
    } else {
      transaction.update(stockLevelRef, {
        quantity: stockLevelData.quantity,
        lowStockThreshold: stockLevelData.lowStockThreshold,
        lastUpdated: now.toDate(),
        lastUpdatedBy: userId
      });
    }
  }
  
  /**
   * 創建調整記錄
   */
  createAdjustmentRecord(
    transaction: admin.firestore.Transaction,
    adjustmentData: {
      itemId: string,
      storeId: string,
      tenantId: string,
      adjustmentType: StockAdjustmentType,
      quantityAdjusted: number,
      beforeQuantity: number,
      afterQuantity: number,
      operatorId: string,
      reason?: string,
      adjustmentDate?: Date,
      transferToStoreId?: string
    }
  ): StockAdjustment {
    const now = admin.firestore.Timestamp.now();
    const adjustmentId = firestoreProvider.collection('stockAdjustments').doc().id;
    
    const adjustment: StockAdjustment = {
      adjustmentId,
      itemId: adjustmentData.itemId,
      storeId: adjustmentData.storeId,
      tenantId: adjustmentData.tenantId,
      adjustmentType: adjustmentData.adjustmentType,
      quantityAdjusted: adjustmentData.quantityAdjusted,
      reason: adjustmentData.reason,
      adjustmentDate: adjustmentData.adjustmentDate || now.toDate(),
      operatorId: adjustmentData.operatorId,
      beforeQuantity: adjustmentData.beforeQuantity,
      afterQuantity: adjustmentData.afterQuantity,
      transferToStoreId: adjustmentData.transferToStoreId
    };
    
    // 寫入調整記錄
    transaction.set(
      firestoreProvider.collection('stockAdjustments').doc(adjustmentId), 
      adjustment
    );
    
    return adjustment;
  }
} 