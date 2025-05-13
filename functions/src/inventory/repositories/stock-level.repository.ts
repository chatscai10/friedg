/**
 * 庫存水平儲存庫
 * 
 * 負責庫存水平的資料存取邏輯
 */
import * as admin from 'firebase-admin';
import { StockLevel, StockLevelsFilter } from '../inventory.types';
import { firestoreProvider } from '../db/database.provider';
import { ItemNotFoundError, NegativeStockError } from '../utils/errors';

export class StockLevelRepository {
  private collection = 'stockLevels';
  
  /**
   * 獲取特定庫存水平
   */
  async getStockLevel(itemId: string, storeId: string, tenantId: string): Promise<StockLevel | null> {
    const db = firestoreProvider;
    
    const stockLevelDoc = await db.collection(this.collection)
      .where('itemId', '==', itemId)
      .where('storeId', '==', storeId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (stockLevelDoc.empty) {
      return null;
    }
    
    return stockLevelDoc.docs[0].data() as StockLevel;
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
  ): Promise<StockLevel> {
    const db = firestoreProvider;
    const now = admin.firestore.Timestamp.now();
    
    // 檢查庫存量不為負數
    if (quantity < 0) {
      throw new NegativeStockError(itemId, storeId);
    }
    
    // 查找現有庫存水平
    const stockLevelQuery = await db.collection(this.collection)
      .where('itemId', '==', itemId)
      .where('storeId', '==', storeId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    // 更新或創建
    if (!stockLevelQuery.empty) {
      const stockLevelDoc = stockLevelQuery.docs[0];
      const stockLevelData = stockLevelDoc.data() as StockLevel;
      
      await stockLevelDoc.ref.update({
        quantity,
        lowStockThreshold: lowStockThreshold !== undefined ? lowStockThreshold : stockLevelData.lowStockThreshold,
        lastUpdated: now.toDate(),
        lastUpdatedBy: userId || 'system'
      });
      
      const updatedDoc = await stockLevelDoc.ref.get();
      return updatedDoc.data() as StockLevel;
    } else {
      // 創建新庫存水平
      const stockLevelId = db.collection(this.collection).doc().id;
      
      const newStockLevel: StockLevel = {
        stockLevelId,
        itemId,
        storeId,
        tenantId,
        quantity,
        lowStockThreshold: lowStockThreshold !== undefined ? lowStockThreshold : 0,
        lastUpdated: now.toDate(),
        lastUpdatedBy: userId || 'system'
      };
      
      await db.collection(this.collection).doc(stockLevelId).set(newStockLevel);
      
      return newStockLevel;
    }
  }
  
  /**
   * 獲取特定店鋪的庫存水平列表
   */
  async getStoreStockLevels(
    storeId: string, 
    tenantId: string, 
    filter: StockLevelsFilter = {},
    page = 1, 
    pageSize = 20
  ) {
    const db = firestoreProvider;
    
    // 構建查詢
    let query = db.collection(this.collection)
      .where('tenantId', '==', tenantId)
      .where('storeId', '==', storeId);
    
    // 如果指定了商品ID，在資料庫層面過濾
    if (filter.itemId) {
      query = query.where('itemId', '==', filter.itemId);
    }
    
    // 執行查詢
    const stockLevelsSnapshot = await query.get();
    
    // 處理結果
    if (stockLevelsSnapshot.empty) {
      return {
        levels: [],
        pagination: {
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      };
    }
    
    const stockLevels = stockLevelsSnapshot.docs.map(doc => doc.data() as StockLevel);
    
    // 計算分頁
    const total = stockLevels.length;
    const offset = (page - 1) * pageSize;
    const paginatedLevels = stockLevels.slice(offset, offset + pageSize);
    
    return {
      levels: paginatedLevels,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }
  
  /**
   * 批量獲取多個商品的庫存水平
   */
  async batchGetStockLevels(
    itemIds: string[], 
    storeId: string | null, 
    tenantId: string
  ): Promise<Record<string, StockLevel[]>> {
    if (!itemIds.length) return {};
    
    const db = firestoreProvider;
    const stockLevelMap: Record<string, StockLevel[]> = {};
    
    // 每次查詢最多10個商品ID（Firestore限制）
    for (let i = 0; i < itemIds.length; i += 10) {
      const batchIds = itemIds.slice(i, i + 10);
      if (batchIds.length === 0) continue;
      
      // 構建基本查詢
      let batchQuery = db.collection(this.collection)
        .where('tenantId', '==', tenantId)
        .where('itemId', 'in', batchIds);
      
      // 如果指定了店鋪ID，添加過濾條件
      if (storeId) {
        batchQuery = batchQuery.where('storeId', '==', storeId);
      }
      
      // 獲取庫存水平
      const snapshot = await batchQuery.get();
      
      if (!snapshot.empty) {
        snapshot.docs.forEach(doc => {
          const stockLevel = doc.data() as StockLevel;
          const itemId = stockLevel.itemId;
          
          if (!stockLevelMap[itemId]) {
            stockLevelMap[itemId] = [];
          }
          
          stockLevelMap[itemId].push(stockLevel);
        });
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
    userId: string
  ) {
    if (!items.length) {
      return {
        success: true,
        results: [],
        failureCount: 0,
        successCount: 0
      };
    }
    
    const db = firestoreProvider;
    const now = admin.firestore.Timestamp.now();
    
    // 使用事務處理批量更新
    return db.runTransaction(async (transaction) => {
      const results = [];
      let successCount = 0;
      let failureCount = 0;
      
      // 處理每個品項
      for (const item of items) {
        try {
          // 檢查庫存量不為負數
          if (item.quantity < 0) {
            throw new NegativeStockError(item.itemId, item.storeId);
          }
          
          // 獲取現有庫存水平
          const stockLevelQuery = await transaction.get(
            db.collection(this.collection)
              .where('itemId', '==', item.itemId)
              .where('storeId', '==', item.storeId)
              .where('tenantId', '==', tenantId)
              .limit(1)
          );
          
          let stockLevelId;
          let oldQuantity = 0;
          let lowStockThreshold = item.lowStockThreshold || 0;
          
          // 如果庫存水平記錄已存在
          if (!stockLevelQuery.empty) {
            const stockLevelDoc = stockLevelQuery.docs[0];
            const stockLevelData = stockLevelDoc.data() as StockLevel;
            stockLevelId = stockLevelData.stockLevelId;
            oldQuantity = stockLevelData.quantity;
            
            if (!item.lowStockThreshold) {
              lowStockThreshold = stockLevelData.lowStockThreshold;
            }
            
            // 更新庫存水平
            transaction.update(stockLevelDoc.ref, {
              quantity: item.quantity,
              lowStockThreshold,
              lastUpdated: now.toDate(),
              lastUpdatedBy: userId
            });
          } else {
            // 創建新的庫存水平記錄
            stockLevelId = db.collection(this.collection).doc().id;
            
            const newStockLevel: StockLevel = {
              stockLevelId,
              itemId: item.itemId,
              storeId: item.storeId,
              tenantId,
              quantity: item.quantity,
              lowStockThreshold,
              lastUpdated: now.toDate(),
              lastUpdatedBy: userId
            };
            
            transaction.set(db.collection(this.collection).doc(stockLevelId), newStockLevel);
          }
          
          // 記錄成功
          results.push({
            itemId: item.itemId,
            storeId: item.storeId,
            success: true,
            data: {
              quantity: item.quantity,
              oldQuantity,
              lowStockThreshold
            }
          });
          
          successCount++;
        } catch (error: any) {
          // 記錄失敗
          results.push({
            itemId: item.itemId,
            storeId: item.storeId,
            success: false,
            error: error.message || '更新庫存水平時發生錯誤'
          });
          
          failureCount++;
        }
      }
      
      // 返回結果
      return {
        success: failureCount === 0,
        results,
        successCount,
        failureCount
      };
    });
  }
} 