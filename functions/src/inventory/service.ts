/**
 * 庫存管理服務層
 * 
 * 提供庫存業務邏輯的核心實現，分離業務邏輯與請求處理
 */

import * as admin from 'firebase-admin';
import { 
  InventoryItem, 
  StockLevel, 
  StockAdjustment, 
  StockAdjustmentType,
  InventoryItemsFilter,
  StockLevelsFilter,
  StockAdjustmentsFilter
} from './inventory.types';

const db = admin.firestore();

/**
 * 簡單的記憶體緩存實現
 */
class MemoryCache<T> {
  private cache: Map<string, { data: T, expiry: number }> = new Map();
  private readonly defaultTTL: number;
  
  constructor(defaultTTLSeconds: number = 300) { // 預設5分鐘
    this.defaultTTL = defaultTTLSeconds * 1000;
  }
  
  /**
   * 設置緩存
   */
  set(key: string, data: T, ttlSeconds?: number): void {
    const ttl = (ttlSeconds || this.defaultTTL) * 1000;
    const expiry = Date.now() + ttl;
    this.cache.set(key, { data, expiry });
  }
  
  /**
   * 獲取緩存
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // 檢查是否過期
    if (item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  /**
   * 刪除緩存
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * 清空特定前綴的緩存
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * 清空所有緩存
   */
  clear(): void {
    this.cache.clear();
  }
}

// 創建緩存實例
const itemCache = new MemoryCache<InventoryItem>(600); // 10分鐘
const stockLevelCache = new MemoryCache<StockLevel>(300); // 5分鐘
const listCache = new MemoryCache<any>(60); // 1分鐘，用於列表查詢

/**
 * 庫存品項服務
 */
export class InventoryItemService {
  /**
   * 創建新的庫存品項
   */
  async createItem(item: Omit<InventoryItem, 'itemId' | 'createdAt' | 'updatedAt'>) {
    const now = admin.firestore.Timestamp.now();
    
    const newItem: Omit<InventoryItem, 'itemId'> = {
      ...item,
      createdAt: now.toDate(),
      updatedAt: now.toDate()
    };
    
    const itemRef = await db.collection('inventoryItems').add(newItem);
    const itemId = itemRef.id;
    
    await itemRef.update({ itemId });
    
    const createdItem = {
      itemId,
      ...newItem
    };
    
    // 清除相關緩存
    listCache.invalidateByPrefix(`items_${item.tenantId}`);
    
    return createdItem;
  }
  
  /**
   * 獲取庫存品項詳情
   */
  async getItem(itemId: string, tenantId: string): Promise<InventoryItem | null> {
    const cacheKey = `item_${tenantId}_${itemId}`;
    
    // 檢查緩存
    const cachedItem = itemCache.get(cacheKey);
    if (cachedItem) {
      return cachedItem;
    }
    
    // 從資料庫獲取
    const itemDoc = await db.collection('inventoryItems')
      .where('itemId', '==', itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemDoc.empty) {
      return null;
    }
    
    const item = itemDoc.docs[0].data() as InventoryItem;
    
    // 存入緩存
    itemCache.set(cacheKey, item);
    
    return item;
  }
  
  /**
   * 更新庫存品項
   */
  async updateItem(itemId: string, tenantId: string, data: Partial<InventoryItem>, updatedBy: string) {
    const itemQuery = await db.collection('inventoryItems')
      .where('itemId', '==', itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemQuery.empty) {
      throw new Error(`找不到 ID 為 ${itemId} 的庫存品項`);
    }
    
    const itemDoc = itemQuery.docs[0];
    
    const updateData: Partial<InventoryItem> = {
      ...data,
      updatedAt: admin.firestore.Timestamp.now().toDate(),
      updatedBy
    };
    
    await itemDoc.ref.update(updateData);
    
    // 獲取更新後的數據
    const updatedItemDoc = await itemDoc.ref.get();
    const updatedItem = updatedItemDoc.data() as InventoryItem;
    
    // 更新緩存
    const cacheKey = `item_${tenantId}_${itemId}`;
    itemCache.set(cacheKey, updatedItem);
    
    // 清除相關列表緩存
    listCache.invalidateByPrefix(`items_${tenantId}`);
    
    return updatedItem;
  }
  
  /**
   * 軟刪除庫存品項 (設為非活躍)
   */
  async deleteItem(itemId: string, tenantId: string, deletedBy: string) {
    const itemQuery = await db.collection('inventoryItems')
      .where('itemId', '==', itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemQuery.empty) {
      throw new Error(`找不到 ID 為 ${itemId} 的庫存品項`);
    }
    
    const itemDoc = itemQuery.docs[0];
    
    await itemDoc.ref.update({
      isActive: false,
      updatedAt: admin.firestore.Timestamp.now().toDate(),
      updatedBy: deletedBy
    });
    
    // 清除緩存
    const cacheKey = `item_${tenantId}_${itemId}`;
    itemCache.delete(cacheKey);
    
    // 清除相關列表緩存
    listCache.invalidateByPrefix(`items_${tenantId}`);
    
    return { success: true };
  }
  
  /**
   * 查詢庫存品項，支援分頁和過濾
   */
  async listItems(tenantId: string, filter: InventoryItemsFilter = {}, page = 1, pageSize = 20) {
    // 構建緩存鍵
    const filterKey = JSON.stringify(filter);
    const cacheKey = `items_${tenantId}_${filterKey}_p${page}_s${pageSize}`;
    
    // 檢查緩存
    const cachedResult = listCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    // 構建基本查詢 - 應用可直接在資料庫層過濾的條件
    let query = db.collection('inventoryItems').where('tenantId', '==', tenantId);
    
    // 添加可在資料庫層過濾的條件
    if (filter.category) {
      query = query.where('category', '==', filter.category) as any;
    }
    
    if (filter.isActive !== undefined) {
      query = query.where('isActive', '==', filter.isActive) as any;
    }
    
    // 執行查詢
    const snapshot = await query.get();
    
    // 如果沒有數據，直接返回空結果
    if (snapshot.empty) {
      const emptyResult = {
        items: [],
        pagination: {
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      };
      
      // 存入緩存
      listCache.set(cacheKey, emptyResult);
      
      return emptyResult;
    }
    
    let items = snapshot.docs.map(doc => doc.data() as InventoryItem);
    
    // 應用內存中過濾條件
    if (filter.name) {
      const searchTerm = filter.name.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm) || 
        (item.description && item.description.toLowerCase().includes(searchTerm))
      );
    }
    
    // 如果需要按庫存水平過濾
    if (filter.lowStock || filter.storeId) {
      // 獲取所有相關品項的ID
      const itemIds = items.map(item => item.itemId);
      
      // 使用批量獲取庫存水平的方法
      const stockLevelMap = await stockLevelService.batchGetStockLevels(
        itemIds,
        filter.storeId || null,
        tenantId
      );
      
      // 過濾低庫存品項
      if (filter.lowStock) {
        items = items.filter(item => {
          const itemLevels = stockLevelMap[item.itemId] || [];
          return itemLevels.some(level => 
            level.quantity < (level.lowStockThreshold || item.lowStockThreshold || 0)
          );
        });
      }
      
      // 為每個品項關聯庫存信息
      items = items.map(item => ({
        ...item,
        stockLevels: stockLevelMap[item.itemId] || []
      }) as InventoryItem & { stockLevels: StockLevel[] });
    }
    
    // 計算分頁
    const total = items.length;
    const offset = (page - 1) * pageSize;
    const paginatedItems = items.slice(offset, offset + pageSize);
    
    const result = {
      items: paginatedItems,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
    
    // 存入緩存
    listCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * 批量獲取多個商品信息
   */
  async batchGetItems(itemIds: string[], tenantId: string): Promise<Record<string, InventoryItem>> {
    // 先嘗試從緩存中獲取
    const itemsMap: Record<string, InventoryItem> = {};
    const missingItemIds: string[] = [];
    
    // 檢查哪些可以從緩存獲取，哪些需要從資料庫獲取
    for (const itemId of itemIds) {
      const cacheKey = `item_${tenantId}_${itemId}`;
      const cachedItem = itemCache.get(cacheKey);
      
      if (cachedItem) {
        itemsMap[itemId] = cachedItem;
      } else {
        missingItemIds.push(itemId);
      }
    }
    
    // 如果所有品項都在緩存中找到，直接返回
    if (missingItemIds.length === 0) {
      return itemsMap;
    }
    
    // 從資料庫獲取缺失的品項
    for (let i = 0; i < missingItemIds.length; i += 10) {
      const batchIds = missingItemIds.slice(i, i + 10);
      
      // 跳過空批次
      if (batchIds.length === 0) continue;
      
      const batchSnapshot = await db.collection('inventoryItems')
        .where('tenantId', '==', tenantId)
        .where('itemId', 'in', batchIds)
        .get();
      
      batchSnapshot.docs.forEach(doc => {
        const item = doc.data() as InventoryItem;
        // 更新緩存
        const cacheKey = `item_${tenantId}_${item.itemId}`;
        itemCache.set(cacheKey, item);
        
        // 添加到結果
        itemsMap[item.itemId] = item;
      });
    }
    
    return itemsMap;
  }
}

/**
 * 庫存水平服務
 */
export class StockLevelService {
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
    // 檢查品項是否存在
    const itemQuery = await db.collection('inventoryItems')
      .where('itemId', '==', itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemQuery.empty) {
      throw new Error(`找不到 ID 為 ${itemId} 的庫存品項`);
    }
    
    const itemData = itemQuery.docs[0].data() as InventoryItem;
    const defaultThreshold = itemData.lowStockThreshold || 0;
    
    // 查找現有庫存水平
    const stockLevelQuery = await db.collection('stockLevels')
      .where('itemId', '==', itemId)
      .where('storeId', '==', storeId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    const now = admin.firestore.Timestamp.now();
    
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
      const updatedLevel = updatedDoc.data() as StockLevel;
      
      // 更新緩存
      const cacheKey = `stocklevel_${tenantId}_${storeId}_${itemId}`;
      stockLevelCache.set(cacheKey, updatedLevel);
      
      // 清除相關列表緩存
      listCache.invalidateByPrefix(`stocklevels_${tenantId}`);
      
      return updatedLevel;
    } else {
      // 創建新庫存水平
      const stockLevelId = db.collection('stockLevels').doc().id;
      
      const newStockLevel: StockLevel = {
        stockLevelId,
        itemId,
        storeId,
        tenantId,
        quantity,
        lowStockThreshold: lowStockThreshold !== undefined ? lowStockThreshold : defaultThreshold,
        lastUpdated: now.toDate(),
        lastUpdatedBy: userId || 'system'
      };
      
      await db.collection('stockLevels').doc(stockLevelId).set(newStockLevel);
      
      // 更新緩存
      const cacheKey = `stocklevel_${tenantId}_${storeId}_${itemId}`;
      stockLevelCache.set(cacheKey, newStockLevel);
      
      // 清除相關列表緩存
      listCache.invalidateByPrefix(`stocklevels_${tenantId}`);
      
      return newStockLevel;
    }
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
    const cachedResult = listCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    // 構建查詢 - 直接應用可在資料庫層過濾的條件
    let query = db.collection('stockLevels')
      .where('tenantId', '==', tenantId)
      .where('storeId', '==', storeId);
    
    // 如果指定了商品ID，在資料庫層面過濾
    if (filter.itemId) {
      query = query.where('itemId', '==', filter.itemId);
    }
    
    // 執行查詢
    const stockLevelsSnapshot = await query.get();
    
    // 如果沒有數據，直接返回空結果
    if (stockLevelsSnapshot.empty) {
      const emptyResult = {
        levels: [],
        pagination: {
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      };
      
      // 存入緩存
      listCache.set(cacheKey, emptyResult);
      
      return emptyResult;
    }
    
    const stockLevels = stockLevelsSnapshot.docs.map(doc => doc.data() as StockLevel);
    
    // 收集所有不重複的商品ID
    const itemIds = [...new Set(stockLevels.map(level => level.itemId))];
    
    // 如果沒有商品，直接返回空結果
    if (itemIds.length === 0) {
      const emptyResult = {
        levels: [],
        pagination: {
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      };
      
      // 存入緩存
      listCache.set(cacheKey, emptyResult);
      
      return emptyResult;
    }
    
    // 使用 InventoryItemService 批量獲取商品信息
    const itemsMap = await inventoryItemService.batchGetItems(itemIds, tenantId);
    
    // 組合庫存水平和商品信息
    let result = stockLevels.map(level => ({
      ...level,
      item: itemsMap[level.itemId] || null
    }));
    
    // 應用內存中過濾條件
    if (filter.category) {
      result = result.filter(item => 
        item.item && item.item.category === filter.category
      );
    }
    
    if (filter.name) {
      const searchTerm = filter.name.toLowerCase();
      result = result.filter(item => 
        item.item && (
          item.item.name.toLowerCase().includes(searchTerm) || 
          (item.item.description && item.item.description.toLowerCase().includes(searchTerm))
        )
      );
    }
    
    if (filter.lowStock) {
      result = result.filter(item => {
        const itemLowThreshold = item.item?.lowStockThreshold || 0;
        const levelLowThreshold = item.lowStockThreshold || itemLowThreshold;
        return item.quantity < levelLowThreshold;
      });
    }
    
    // 計算分頁
    const total = result.length;
    const offset = (page - 1) * pageSize;
    const paginatedResult = result.slice(offset, offset + pageSize);
    
    const finalResult = {
      levels: paginatedResult,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
    
    // 存入緩存
    listCache.set(cacheKey, finalResult);
    
    return finalResult;
  }
  
  /**
   * 批量獲取多個商品的庫存水平
   */
  async batchGetStockLevels(
    itemIds: string[], 
    storeId: string | null, 
    tenantId: string
  ): Promise<Record<string, StockLevel[]>> {
    const stockLevelMap: Record<string, StockLevel[]> = {};
    
    // 處理空數組的情況
    if (!itemIds.length) {
      return stockLevelMap;
    }
    
    // 檢查是否有緩存
    if (storeId) {
      // 當指定了商店時，可以使用精確的緩存鍵
      for (const itemId of itemIds) {
        const cacheKey = `stocklevel_${tenantId}_${storeId}_${itemId}`;
        const cachedLevel = stockLevelCache.get(cacheKey);
        
        if (cachedLevel) {
          if (!stockLevelMap[itemId]) {
            stockLevelMap[itemId] = [];
          }
          stockLevelMap[itemId].push(cachedLevel);
        }
      }
    }
    
    // 每次查詢最多10個商品ID（Firestore限制）
    for (let i = 0; i < itemIds.length; i += 10) {
      const batchIds = itemIds.slice(i, i + 10);
      if (batchIds.length === 0) continue;
      
      // 構建基本查詢
      let batchQuery = db.collection('stockLevels')
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
          
          // 更新緩存
          if (storeId) {
            const cacheKey = `stocklevel_${tenantId}_${storeId}_${itemId}`;
            stockLevelCache.set(cacheKey, stockLevel);
          }
          
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
   * 同時更新多個品項的庫存水平，支持事務處理
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
    // 檢查是否有品項
    if (!items.length) {
      return {
        success: true,
        results: [],
        failureCount: 0,
        successCount: 0
      };
    }
    
    // 收集所有要更新的品項ID
    const itemIds = [...new Set(items.map(item => item.itemId))];
    
    // 批量獲取品項信息
    const itemsMap = await inventoryItemService.batchGetItems(itemIds, tenantId);
    
    // 檢查所有品項是否存在
    const missingItemIds = itemIds.filter(id => !itemsMap[id]);
    if (missingItemIds.length > 0) {
      throw new Error(`找不到以下品項: ${missingItemIds.join(', ')}`);
    }
    
    // 使用事務處理批量更新
    return db.runTransaction(async (transaction) => {
      const results = [];
      let successCount = 0;
      let failureCount = 0;
      const now = admin.firestore.Timestamp.now();
      
      // 創建庫存調整，如果指定了原因
      const adjustments: Record<string, any> = {};
      
      // 處理每個品項
      for (const item of items) {
        try {
          // 獲取品項詳情
          const inventoryItem = itemsMap[item.itemId];
          
          // 獲取現有庫存水平
          const stockLevelQuery = await transaction.get(
            db.collection('stockLevels')
              .where('itemId', '==', item.itemId)
              .where('storeId', '==', item.storeId)
              .where('tenantId', '==', tenantId)
              .limit(1)
          );
          
          let stockLevelId;
          let oldQuantity = 0;
          let lowStockThreshold = item.lowStockThreshold || inventoryItem.lowStockThreshold || 0;
          
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
            stockLevelId = db.collection('stockLevels').doc().id;
            
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
            
            transaction.set(db.collection('stockLevels').doc(stockLevelId), newStockLevel);
          }
          
          // 如果庫存量有變化且需要創建調整記錄
          if (oldQuantity !== item.quantity) {
            const adjustmentId = db.collection('stockAdjustments').doc().id;
            const quantityAdjusted = item.quantity - oldQuantity;
            
            const adjustment: StockAdjustment = {
              adjustmentId,
              itemId: item.itemId,
              storeId: item.storeId,
              tenantId,
              adjustmentType: StockAdjustmentType.STOCK_COUNT,
              quantityAdjusted,
              reason: reason || '批量庫存更新',
              adjustmentDate: now.toDate(),
              operatorId: userId,
              beforeQuantity: oldQuantity,
              afterQuantity: item.quantity
            };
            
            transaction.set(db.collection('stockAdjustments').doc(adjustmentId), adjustment);
            adjustments[`${item.itemId}_${item.storeId}`] = adjustment;
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
          
          // 清除緩存
          const cacheKey = `stocklevel_${tenantId}_${item.storeId}_${item.itemId}`;
          stockLevelCache.delete(cacheKey);
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
      
      // 清除相關列表緩存
      listCache.invalidateByPrefix(`stocklevels_${tenantId}`);
      
      // 返回結果
      return {
        success: failureCount === 0,
        results,
        successCount,
        failureCount,
        adjustments: Object.values(adjustments)
      };
    });
  }
}

/**
 * 庫存調整服務
 */
export class StockAdjustmentService {
  /**
   * 創建庫存調整
   */
  async createAdjustment(
    tenantId: string,
    itemId: string,
    storeId: string,
    adjustmentType: StockAdjustmentType,
    quantityAdjusted: number,
    userId: string,
    options: {
      reason?: string;
      adjustmentDate?: Date;
      transferToStoreId?: string;
    } = {}
  ) {
    // 檢查品項是否存在
    const itemQuery = await db.collection('inventoryItems')
      .where('itemId', '==', itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemQuery.empty) {
      throw new Error(`找不到 ID 為 ${itemId} 的庫存品項`);
    }
    
    // 開始事務
    return db.runTransaction(async transaction => {
      // 獲取庫存水平
      const stockLevelQuery = await transaction.get(
        db.collection('stockLevels')
          .where('itemId', '==', itemId)
          .where('storeId', '==', storeId)
          .where('tenantId', '==', tenantId)
          .limit(1)
      );
      
      const now = admin.firestore.Timestamp.now();
      const adjustmentDate = options.adjustmentDate || now.toDate();
      
      let currentQuantity = 0;
      let stockLevelRef;
      let stockLevelId;
      let lowStockThreshold = 0;
      
      // 處理現有庫存水平
      if (!stockLevelQuery.empty) {
        const stockLevelDoc = stockLevelQuery.docs[0];
        stockLevelRef = stockLevelDoc.ref;
        const stockLevelData = stockLevelDoc.data() as StockLevel;
        stockLevelId = stockLevelData.stockLevelId;
        currentQuantity = stockLevelData.quantity;
        lowStockThreshold = stockLevelData.lowStockThreshold;
      } else {
        // 創建新庫存水平
        stockLevelId = db.collection('stockLevels').doc().id;
        stockLevelRef = db.collection('stockLevels').doc(stockLevelId);
        
        // 從品項獲取閾值
        const itemData = itemQuery.docs[0].data() as InventoryItem;
        lowStockThreshold = itemData.lowStockThreshold || 0;
      }
      
      // 計算新數量
      const newQuantity = currentQuantity + quantityAdjusted;
      
      // 確保不為負數
      if (newQuantity < 0) {
        throw new Error('調整後庫存數量不能為負數');
      }
      
      // 建立調整記錄
      const adjustmentId = db.collection('stockAdjustments').doc().id;
      const newAdjustment: StockAdjustment = {
        adjustmentId,
        itemId,
        storeId,
        tenantId,
        adjustmentType,
        quantityAdjusted,
        reason: options.reason,
        adjustmentDate,
        operatorId: userId,
        beforeQuantity: currentQuantity,
        afterQuantity: newQuantity,
        transferToStoreId: options.transferToStoreId
      };
      
      // 寫入調整記錄
      const adjustmentRef = db.collection('stockAdjustments').doc(adjustmentId);
      transaction.set(adjustmentRef, newAdjustment);
      
      // 更新庫存水平
      const updatedStockLevel: StockLevel = {
        stockLevelId,
        itemId,
        storeId,
        tenantId,
        quantity: newQuantity,
        lowStockThreshold,
        lastUpdated: now.toDate(),
        lastUpdatedBy: userId
      };
      
      transaction.set(stockLevelRef, updatedStockLevel, { merge: true });
      
      // 清除緩存
      const stockLevelCacheKey = `stocklevel_${tenantId}_${storeId}_${itemId}`;
      stockLevelCache.delete(stockLevelCacheKey);
      
      // 處理移撥情況
      if (adjustmentType === StockAdjustmentType.TRANSFER && options.transferToStoreId) {
        // 獲取目標庫存水平
        const targetStockLevelQuery = await transaction.get(
          db.collection('stockLevels')
            .where('itemId', '==', itemId)
            .where('storeId', '==', options.transferToStoreId)
            .where('tenantId', '==', tenantId)
            .limit(1)
        );
        
        let targetQuantity = 0;
        let targetStockLevelRef;
        let targetStockLevelId;
        let targetLowStockThreshold = lowStockThreshold;
        
        // 處理目標庫存水平
        if (!targetStockLevelQuery.empty) {
          const targetStockLevelDoc = targetStockLevelQuery.docs[0];
          targetStockLevelRef = targetStockLevelDoc.ref;
          const targetStockLevelData = targetStockLevelDoc.data() as StockLevel;
          targetStockLevelId = targetStockLevelData.stockLevelId;
          targetQuantity = targetStockLevelData.quantity;
          targetLowStockThreshold = targetStockLevelData.lowStockThreshold;
        } else {
          // 創建新目標庫存水平
          targetStockLevelId = db.collection('stockLevels').doc().id;
          targetStockLevelRef = db.collection('stockLevels').doc(targetStockLevelId);
        }
        
        // 計算目標新數量
        const targetNewQuantity = targetQuantity + Math.abs(quantityAdjusted);
        
        // 更新目標庫存水平
        const targetUpdatedStockLevel: StockLevel = {
          stockLevelId: targetStockLevelId,
          itemId,
          storeId: options.transferToStoreId,
          tenantId,
          quantity: targetNewQuantity,
          lowStockThreshold: targetLowStockThreshold,
          lastUpdated: now.toDate(),
          lastUpdatedBy: userId
        };
        
        transaction.set(targetStockLevelRef, targetUpdatedStockLevel, { merge: true });
        
        // 清除目標庫存水平緩存
        const targetStockLevelCacheKey = `stocklevel_${tenantId}_${options.transferToStoreId}_${itemId}`;
        stockLevelCache.delete(targetStockLevelCacheKey);
        
        // 創建目標調整記錄
        const targetAdjustmentId = db.collection('stockAdjustments').doc().id;
        const targetAdjustment: StockAdjustment = {
          adjustmentId: targetAdjustmentId,
          itemId,
          storeId: options.transferToStoreId,
          tenantId,
          adjustmentType: StockAdjustmentType.RECEIPT,
          quantityAdjusted: Math.abs(quantityAdjusted),
          reason: `從 ${storeId} 移撥${options.reason ? `: ${options.reason}` : ''}`,
          adjustmentDate,
          operatorId: userId,
          beforeQuantity: targetQuantity,
          afterQuantity: targetNewQuantity,
          transferToStoreId: storeId
        };
        
        // 寫入目標調整記錄
        const targetAdjustmentRef = db.collection('stockAdjustments').doc(targetAdjustmentId);
        transaction.set(targetAdjustmentRef, targetAdjustment);
      }
      
      // 清除相關列表緩存
      listCache.invalidateByPrefix(`stocklevels_${tenantId}`);
      
      return {
        adjustmentId,
        ...newAdjustment
      };
    });
  }
  
  /**
   * 獲取調整記錄詳情
   */
  async getAdjustment(adjustmentId: string, tenantId: string) {
    const adjustmentDoc = await db.collection('stockAdjustments')
      .where('adjustmentId', '==', adjustmentId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (adjustmentDoc.empty) {
      throw new Error(`找不到 ID 為 ${adjustmentId} 的庫存調整記錄`);
    }
    
    return adjustmentDoc.docs[0].data() as StockAdjustment;
  }
  
  /**
   * 查詢調整記錄列表
   */
  async listAdjustments(
    tenantId: string, 
    filter: StockAdjustmentsFilter = {},
    page = 1, 
    pageSize = 20
  ) {
    // 構建緩存鍵
    const filterKey = JSON.stringify(filter);
    const cacheKey = `adjustments_${tenantId}_${filterKey}_p${page}_s${pageSize}`;
    
    // 檢查緩存
    const cachedResult = listCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    // 基本查詢
    let query = db.collection('stockAdjustments').where('tenantId', '==', tenantId);
    
    // 添加過濾條件
    if (filter.itemId) {
      query = query.where('itemId', '==', filter.itemId) as any;
    }
    
    if (filter.storeId) {
      query = query.where('storeId', '==', filter.storeId) as any;
    }
    
    if (filter.adjustmentType) {
      query = query.where('adjustmentType', '==', filter.adjustmentType) as any;
    }
    
    if (filter.operatorId) {
      query = query.where('operatorId', '==', filter.operatorId) as any;
    }
    
    // 執行查詢
    const snapshot = await query.get();
    let adjustments = snapshot.docs.map(doc => doc.data() as StockAdjustment);
    
    // 應用日期範圍過濾
    if (filter.startDate || filter.endDate) {
      adjustments = adjustments.filter(adjustment => {
        const date = adjustment.adjustmentDate;
        
        if (filter.startDate && filter.endDate) {
          return date >= filter.startDate && date <= filter.endDate;
        }
        
        if (filter.startDate) {
          return date >= filter.startDate;
        }
        
        if (filter.endDate) {
          return date <= filter.endDate;
        }
        
        return true;
      });
    }
    
    // 計算分頁
    const total = adjustments.length;
    const offset = (page - 1) * pageSize;
    const paginatedAdjustments = adjustments.slice(offset, offset + pageSize);
    
    const result = {
      adjustments: paginatedAdjustments,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
    
    // 存入緩存
    listCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * 批量創建庫存調整
   * 同時處理多個品項的庫存調整，支持事務處理
   */
  async batchCreateAdjustments(
    tenantId: string,
    adjustments: {
      itemId: string;
      storeId: string;
      adjustmentType: StockAdjustmentType;
      quantityAdjusted: number;
      reason?: string;
      transferToStoreId?: string;
    }[],
    userId: string,
    adjustmentDate?: Date
  ) {
    // 檢查是否有調整
    if (!adjustments.length) {
      return {
        success: true,
        results: [],
        failureCount: 0,
        successCount: 0
      };
    }
    
    // 收集所有要調整的品項ID
    const itemIds = [...new Set(adjustments.map(item => item.itemId))];
    
    // 批量獲取品項信息
    const itemsMap = await inventoryItemService.batchGetItems(itemIds, tenantId);
    
    // 檢查所有品項是否存在
    const missingItemIds = itemIds.filter(id => !itemsMap[id]);
    if (missingItemIds.length > 0) {
      throw new Error(`找不到以下品項: ${missingItemIds.join(', ')}`);
    }
    
    // 處理日期
    const now = admin.firestore.Timestamp.now();
    const adjDate = adjustmentDate || now.toDate();
    
    // 使用事務處理批量創建調整
    return db.runTransaction(async (transaction) => {
      const results = [];
      let successCount = 0;
      let failureCount = 0;
      const createdAdjustments: StockAdjustment[] = [];
      
      // 處理每個調整
      for (const adjustment of adjustments) {
        try {
          // 檢查是否是移撥且指定了目標分店
          if (adjustment.adjustmentType === StockAdjustmentType.TRANSFER && !adjustment.transferToStoreId) {
            throw new Error(`移撥類型的調整需要指定 transferToStoreId: ${adjustment.itemId} in ${adjustment.storeId}`);
          }
          
          // 獲取現有庫存水平
          const stockLevelQuery = await transaction.get(
            db.collection('stockLevels')
              .where('itemId', '==', adjustment.itemId)
              .where('storeId', '==', adjustment.storeId)
              .where('tenantId', '==', tenantId)
              .limit(1)
          );
          
          let stockLevelRef;
          let stockLevelId;
          let currentQuantity = 0;
          let lowStockThreshold = 0;
          
          // 處理現有庫存水平
          if (!stockLevelQuery.empty) {
            const stockLevelDoc = stockLevelQuery.docs[0];
            stockLevelRef = stockLevelDoc.ref;
            const stockLevelData = stockLevelDoc.data() as StockLevel;
            stockLevelId = stockLevelData.stockLevelId;
            currentQuantity = stockLevelData.quantity;
            lowStockThreshold = stockLevelData.lowStockThreshold;
          } else {
            // 創建新庫存水平
            stockLevelId = db.collection('stockLevels').doc().id;
            stockLevelRef = db.collection('stockLevels').doc(stockLevelId);
            
            // 從品項獲取閾值
            const itemData = itemsMap[adjustment.itemId];
            lowStockThreshold = itemData.lowStockThreshold || 0;
          }
          
          // 計算新數量
          const newQuantity = currentQuantity + adjustment.quantityAdjusted;
          
          // 確保不為負數
          if (newQuantity < 0) {
            throw new Error(`庫存調整後數量不能為負數: ${adjustment.itemId} in ${adjustment.storeId}`);
          }
          
          // 創建調整記錄
          const adjustmentId = db.collection('stockAdjustments').doc().id;
          const newAdjustment: StockAdjustment = {
            adjustmentId,
            itemId: adjustment.itemId,
            storeId: adjustment.storeId,
            tenantId,
            adjustmentType: adjustment.adjustmentType,
            quantityAdjusted: adjustment.quantityAdjusted,
            reason: adjustment.reason,
            adjustmentDate: adjDate,
            operatorId: userId,
            beforeQuantity: currentQuantity,
            afterQuantity: newQuantity,
            transferToStoreId: adjustment.transferToStoreId
          };
          
          // 添加調整記錄
          transaction.set(db.collection('stockAdjustments').doc(adjustmentId), newAdjustment);
          createdAdjustments.push(newAdjustment);
          
          // 更新庫存水平
          transaction.set(stockLevelRef, {
            stockLevelId,
            itemId: adjustment.itemId,
            storeId: adjustment.storeId,
            tenantId,
            quantity: newQuantity,
            lowStockThreshold,
            lastUpdated: now.toDate(),
            lastUpdatedBy: userId
          }, { merge: true });
          
          // 清除緩存
          const stockLevelCacheKey = `stocklevel_${tenantId}_${adjustment.storeId}_${adjustment.itemId}`;
          stockLevelCache.delete(stockLevelCacheKey);
          
          // 處理移撥情況
          if (adjustment.adjustmentType === StockAdjustmentType.TRANSFER && adjustment.transferToStoreId) {
            // 獲取目標分店的庫存水平
            const targetStockLevelQuery = await transaction.get(
              db.collection('stockLevels')
                .where('itemId', '==', adjustment.itemId)
                .where('storeId', '==', adjustment.transferToStoreId)
                .where('tenantId', '==', tenantId)
                .limit(1)
            );
            
            let targetQuantity = 0;
            let targetStockLevelRef;
            let targetStockLevelId;
            let targetLowStockThreshold = lowStockThreshold;
            
            // 處理目標庫存水平
            if (!targetStockLevelQuery.empty) {
              const targetStockLevelDoc = targetStockLevelQuery.docs[0];
              targetStockLevelRef = targetStockLevelDoc.ref;
              const targetStockLevelData = targetStockLevelDoc.data() as StockLevel;
              targetStockLevelId = targetStockLevelData.stockLevelId;
              targetQuantity = targetStockLevelData.quantity;
              targetLowStockThreshold = targetStockLevelData.lowStockThreshold;
            } else {
              // 創建新目標庫存水平
              targetStockLevelId = db.collection('stockLevels').doc().id;
              targetStockLevelRef = db.collection('stockLevels').doc(targetStockLevelId);
            }
            
            // 計算目標新數量
            const targetNewQuantity = targetQuantity + Math.abs(adjustment.quantityAdjusted);
            
            // 更新目標庫存水平
            transaction.set(targetStockLevelRef, {
              stockLevelId: targetStockLevelId,
              itemId: adjustment.itemId,
              storeId: adjustment.transferToStoreId,
              tenantId,
              quantity: targetNewQuantity,
              lowStockThreshold: targetLowStockThreshold,
              lastUpdated: now.toDate(),
              lastUpdatedBy: userId
            }, { merge: true });
            
            // 清除目標庫存水平緩存
            const targetStockLevelCacheKey = `stocklevel_${tenantId}_${adjustment.transferToStoreId}_${adjustment.itemId}`;
            stockLevelCache.delete(targetStockLevelCacheKey);
            
            // 創建目標調整記錄
            const targetAdjustmentId = db.collection('stockAdjustments').doc().id;
            const targetAdjustment: StockAdjustment = {
              adjustmentId: targetAdjustmentId,
              itemId: adjustment.itemId,
              storeId: adjustment.transferToStoreId,
              tenantId,
              adjustmentType: StockAdjustmentType.RECEIPT,
              quantityAdjusted: Math.abs(adjustment.quantityAdjusted),
              reason: `從 ${adjustment.storeId} 移撥${adjustment.reason ? `: ${adjustment.reason}` : ''}`,
              adjustmentDate: adjDate,
              operatorId: userId,
              beforeQuantity: targetQuantity,
              afterQuantity: targetNewQuantity,
              transferToStoreId: adjustment.storeId
            };
            
            // 添加目標調整記錄
            transaction.set(db.collection('stockAdjustments').doc(targetAdjustmentId), targetAdjustment);
            createdAdjustments.push(targetAdjustment);
          }
          
          // 記錄成功
          results.push({
            itemId: adjustment.itemId,
            storeId: adjustment.storeId,
            success: true,
            data: {
              adjustmentId: newAdjustment.adjustmentId,
              adjustmentType: adjustment.adjustmentType,
              quantityAdjusted: adjustment.quantityAdjusted,
              newQuantity
            }
          });
          
          successCount++;
        } catch (error: any) {
          // 記錄失敗
          results.push({
            itemId: adjustment.itemId,
            storeId: adjustment.storeId,
            success: false,
            error: error.message || '創建庫存調整時發生錯誤'
          });
          
          failureCount++;
        }
      }
      
      // 清除相關列表緩存
      listCache.invalidateByPrefix(`stocklevels_${tenantId}`);
      
      // 返回結果
      return {
        success: failureCount === 0,
        results,
        successCount,
        failureCount,
        adjustments: createdAdjustments
      };
    });
  }
}

// 導出服務實例
export const inventoryItemService = new InventoryItemService();
export const stockLevelService = new StockLevelService();
export const stockAdjustmentService = new StockAdjustmentService(); 