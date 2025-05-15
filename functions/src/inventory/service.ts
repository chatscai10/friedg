// This file is deprecated. All inventory services have been moved to the services/ subdirectory 
// and are exported via services/index.ts.
// Please update imports to point to './services' or specific service files within that directory.

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
   * [REFACTORED] Upserts stock level directly in the 'menuItems' collection
   * and logs a stock adjustment.
   * Assumes itemId is the document ID in 'menuItems'.
   * Assumes menuItems documents contain: storeId, tenantId, stock: { current, lowStockThreshold }, manageStock (boolean)
   */
  async upsertStockLevel_REFACTORED(
    itemId: string, 
    storeId: string, 
    tenantId: string, 
    quantity: number, // Absolute new quantity
    lowStockThreshold?: number,
    userId?: string,
    reason: string = 'Manual stock level set' // Reason for the stock adjustment entry
  ) {
    const menuItemRef = db.collection('menuItems').doc(itemId);
    const now = admin.firestore.Timestamp.now();

    return db.runTransaction(async transaction => {
      const menuItemDoc = await transaction.get(menuItemRef);

      if (!menuItemDoc.exists) {
        // This implies the menuItem document (identified by itemId) itself doesn't exist.
        // If the expectation is that this operation can create a stock record for an item
        // in a store where it wasn't previously listed/stocked, then the approach
        // of just updating a 'menuItems' doc might be insufficient without more context
        // on how items are first introduced to a store's menu.
        // For now, an error is thrown if the base menuItem (docId = itemId) doesn't exist.
        logger.error(`[upsertStockLevel_REFACTORED] MenuItem with ID ${itemId} not found.`);
        throw new Error(`[RefactoredUpsert] Menu item with ID ${itemId} not found.`);
      }

      const menuItemData = menuItemDoc.data() as { 
        storeId?: string; 
        tenantId?: string; 
        stock?: { current?: number; lowStockThreshold?: number; manageStock?: boolean }; 
        manageStock?: boolean; 
        updatedAt?: admin.firestore.Timestamp;
        // other fields from MenuItemOnFirestore interface
      };

      // VALIDATIONS
      if (menuItemData.storeId !== storeId) {
        logger.error(`[upsertStockLevel_REFACTORED] MenuItem ${itemId} storeId mismatch. Expected: ${storeId}, Actual: ${menuItemData.storeId}`);
        throw new Error(`[RefactoredUpsert] Menu item ${itemId} is associated with store ${menuItemData.storeId}, not target store ${storeId}.`);
      }
      if (menuItemData.tenantId !== tenantId) {
        logger.error(`[upsertStockLevel_REFACTORED] MenuItem ${itemId} tenantId mismatch. Expected: ${tenantId}, Actual: ${menuItemData.tenantId}`);
        throw new Error(`[RefactoredUpsert] Menu item ${itemId} tenant mismatch. Expected ${tenantId}, got ${menuItemData.tenantId}.`);
      }
      // END VALIDATIONS

      const oldQuantity = menuItemData.stock?.current || 0;
      const quantityAdjusted = quantity - oldQuantity;

      const updatePayload: any = {
        'updatedAt': now,
      };

      // Determine path for stock fields (direct vs nested)
      // Prefer nested 'stock.field' if 'stock' object exists, otherwise update direct fields if they exist.
      // This is a temporary measure due to uncertainty of actual structure for manageStock/lowStockThreshold.
      // Ideal state: All stock related fields (current, lowStockThreshold, manageStock) are under the 'stock' object.
      let stockObjectExists = typeof menuItemData.stock === 'object' && menuItemData.stock !== null;

      updatePayload[stockObjectExists ? 'stock.current' : 'stockQuantity'] = quantity; // Assuming 'stockQuantity' if not nested
      updatePayload[stockObjectExists ? 'stock.manageStock' : 'manageStock'] = true; // Ensure stock is managed

      if (lowStockThreshold !== undefined) {
        updatePayload[stockObjectExists ? 'stock.lowStockThreshold' : 'lowStockThreshold'] = lowStockThreshold;
      } else if (stockObjectExists && menuItemData.stock?.lowStockThreshold === undefined) {
        // If not provided and nested stock obj exists but has no threshold, maybe clear it or set a default?
        // For now, only sets if explicitly provided. Defaulting logic from inventoryItems would be complex here.
      }
      // If not stockObjectExists and menuItemData.lowStockThreshold is undefined, it won't be set unless provided.

      transaction.update(menuItemRef, updatePayload);
      logger.info(`[upsertStockLevel_REFACTORED] Stock for menuItem ${itemId} in store ${storeId} updated in payload. New quantity: ${quantity}`);

      // Create a StockAdjustment record
      // This assumes stockAdjustmentService is available in the same scope or passed/imported
      // And that it has a method like createAdjustmentRecordInTransaction_REFACTORED
      if (stockAdjustmentService && typeof stockAdjustmentService.createAdjustmentRecordInTransaction_REFACTORED === 'function') {
        await stockAdjustmentService.createAdjustmentRecordInTransaction_REFACTORED(transaction, {
          itemId,
          storeId,
          tenantId,
          adjustmentType: StockAdjustmentType.STOCK_COUNT, // Or a more specific type like 'MANUAL_LEVEL_SET'
          quantityAdjusted: quantityAdjusted, 
          beforeQuantity: oldQuantity,
          afterQuantity: quantity,
          reason: reason,
          adjustmentDate: now.toDate(),
          operatorId: userId || 'system_refactor_upsert'
        });
        logger.info(`[upsertStockLevel_REFACTORED] Stock adjustment record created for menuItem ${itemId}, store ${storeId}.`);
      } else {
        logger.warn(`[upsertStockLevel_REFACTORED] stockAdjustmentService.createAdjustmentRecordInTransaction_REFACTORED is not available. Adjustment record NOT created.`);
      }
      
      // The onMenuItemWrite trigger should automatically update 'stockStatus' based on 'stock.current'.

      // Return data consistent with what might be expected by callers of the original method
      // Note: 'stockLevelId' is no longer applicable from the old 'stockLevels' collection.
      return {
        itemId: itemId,
        storeId: storeId,
        tenantId: tenantId,
        quantity: quantity,
        lowStockThreshold: updatePayload[stockObjectExists ? 'stock.lowStockThreshold' : 'lowStockThreshold'] !== undefined 
                           ? updatePayload[stockObjectExists ? 'stock.lowStockThreshold' : 'lowStockThreshold'] 
                           : (stockObjectExists ? menuItemData.stock?.lowStockThreshold : menuItemData.lowStockThreshold),
        lastUpdated: now.toDate(),
        lastUpdatedBy: userId || 'system_refactor_upsert'
      };
    });
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
   * [REFACTORED] Creates a stock adjustment record and updates the stock level
   * directly in the 'menuItems' collection within a single transaction.
   * Assumes itemId is the document ID in 'menuItems'. This ID should be for the item in the *source* store.
   * Assumes menuItems documents contain: storeId, tenantId, stock: { current }, manageStock (boolean), and potentially a global `productId`.
   */
  async createAdjustment_REFACTORED(
    tenantId: string,
    itemId: string, // Document ID of the menuItem in the source store
    storeId: string, // Source store for the adjustment
    adjustmentType: StockAdjustmentType,
    quantityAdjusted: number, // Positive for increase (RECEIPT, POSITIVE_ADJ), negative for decrease (ISSUE, WASTAGE, NEGATIVE_ADJ, TRANSFER_OUT)
    userId: string,
    options: {
      reason?: string;
      adjustmentDate?: Date;
      transferToStoreId?: string; // Required if adjustmentType is TRANSFER. This is the ID of the destination store.
      isInitialStock?: boolean; // Flag for initial stock setup
      productId?: string; // Global product identifier, used for transfers if targetItemId not given.
    } = {}
  ) {
    const sourceMenuItemRef = db.collection('menuItems').doc(itemId); // Ref to source item's document
    const now = admin.firestore.Timestamp.now();
    const adjustmentDate = options.adjustmentDate || now.toDate();

    return db.runTransaction(async transaction => {
      const sourceMenuItemDoc = await transaction.get(sourceMenuItemRef);

      if (!sourceMenuItemDoc.exists) {
        logger.error(`[createAdjustment_REFACTORED] Source MenuItem with ID ${itemId} not found.`);
        throw new Error(`[RefactoredAdjustment] Source Menu item with ID ${itemId} not found.`);
      }
      const sourceMenuItemData = sourceMenuItemDoc.data() as { 
        storeId?: string; 
        tenantId?: string; 
        productId?: string; // Global product ID
        stock?: { current?: number; manageStock?: boolean; lowStockThreshold?: number }; 
        manageStock?: boolean; 
        name?: string; 
      };

      // Validate source item belongs to the specified source storeId and tenantId
      if (sourceMenuItemData.storeId !== storeId) {
        logger.error(`[createAdjustment_REFACTORED] Source MenuItem ${itemId} storeId mismatch. Expected source store: ${storeId}, Actual item store: ${sourceMenuItemData.storeId}`);
        throw new Error(`[RefactoredAdjustment] Source Menu item ${itemId} is associated with store ${sourceMenuItemData.storeId}, not target source store ${storeId}.`);
      }
      if (sourceMenuItemData.tenantId !== tenantId) {
        logger.error(`[createAdjustment_REFACTORED] Source MenuItem ${itemId} tenantId mismatch. Expected: ${tenantId}, Actual: ${sourceMenuItemData.tenantId}`);
        throw new Error(`[RefactoredAdjustment] Source Menu item ${itemId} tenant mismatch. Expected ${tenantId}, got ${sourceMenuItemData.tenantId}.`);
      }

      const sourceCurrentQuantity = sourceMenuItemData.stock?.current || 0;
      let actualQuantityAdjusted = quantityAdjusted; // This is the delta for the source
      let sourceNewQuantity;

      if (options.isInitialStock) {
        // quantityAdjusted is the target stock level for initial stock.
        sourceNewQuantity = quantityAdjusted; 
        actualQuantityAdjusted = sourceNewQuantity - sourceCurrentQuantity; // Calculate the delta for the log
      } else {
        sourceNewQuantity = sourceCurrentQuantity + quantityAdjusted; // quantityAdjusted is already the delta
      }
      
      if (sourceNewQuantity < 0) {
        throw new Error(`Adjusted quantity (${sourceNewQuantity}) for item '${sourceMenuItemData.name || itemId}' (source) cannot be negative.`);
      }

      const sourceStockObjectExists = typeof sourceMenuItemData.stock === 'object' && sourceMenuItemData.stock !== null;
      const sourceManageStockPath = sourceStockObjectExists ? 'stock.manageStock' : 'manageStock';
      
      const sourceMenuItemUpdatePayload: any = {
        'stock.current': sourceNewQuantity,
        'updatedAt': now,
        [sourceManageStockPath]: true,
      };
      transaction.update(sourceMenuItemRef, sourceMenuItemUpdatePayload);
      logger.info(`[createAdjustment_REFACTORED] Stock for source menuItem ${itemId} in store ${storeId} updated from ${sourceCurrentQuantity} to ${sourceNewQuantity}.`);

      const sourceAdjustment = await this.createAdjustmentRecordInTransaction_REFACTORED(transaction, {
        itemId: itemId, // Doc ID of source item
        storeId, 
        tenantId,
        adjustmentType,
        quantityAdjusted: actualQuantityAdjusted, 
        beforeQuantity: sourceCurrentQuantity,
        afterQuantity: sourceNewQuantity,
        reason: options.reason,
        adjustmentDate,
        operatorId: userId,
        transferToStoreId: adjustmentType === StockAdjustmentType.TRANSFER ? options.transferToStoreId : undefined,
      });
      logger.info(`[createAdjustment_REFACTORED] Source stock adjustment record ${sourceAdjustment.adjustmentId} created for item ${itemId}, store ${storeId}.`);

      let targetAdjustmentResponse: StockAdjustment | undefined = undefined;

      if (adjustmentType === StockAdjustmentType.TRANSFER) {
        if (!options.transferToStoreId || options.transferToStoreId === storeId) {
          logger.error(`[createAdjustment_REFACTORED] Invalid transferToStoreId for TRANSFER: ${options.transferToStoreId}.`);
          throw new Error('Inventory transfer destination store ID is invalid or same as source store.');
        }
        const targetStoreId = options.transferToStoreId;
        const globalProductId = options.productId || sourceMenuItemData.productId || itemId; // Determine the global product ID

        // Find the target menu item document using the globalProductId and targetStoreId
        const targetItemQuery = db.collection('menuItems')
                                  .where('productId', '==', globalProductId) 
                                  .where('storeId', '==', targetStoreId)
                                  .where('tenantId', '==', tenantId)
                                  .limit(1);
        const targetMenuItemSnapshot = await transaction.get(targetItemQuery);

        if (targetMenuItemSnapshot.empty) {
          logger.error(`[createAdjustment_REFACTORED] Target menu item for product ID ${globalProductId} in store ${targetStoreId} not found for TRANSFER.`);
          throw new Error(`Transfer failed: Product '${sourceMenuItemData.name || globalProductId}' not found in destination store ${targetStoreId}.`);
        }
        const targetMenuItemRef = targetMenuItemSnapshot.docs[0].ref;
        const targetMenuItemDocId = targetMenuItemRef.id; // Actual document ID of the target item
        const targetMenuItemData = targetMenuItemSnapshot.docs[0].data() as {
            stock?: { current?: number; manageStock?: boolean };
            manageStock?: boolean; 
            name?: string;
        };

        const targetCurrentQuantity = targetMenuItemData.stock?.current || 0;
        // quantityAdjusted for source is negative (e.g., -5 means 5 units out)
        // target receives that amount positively
        const quantityReceivedByTarget = Math.abs(actualQuantityAdjusted); 
        const targetNewQuantity = targetCurrentQuantity + quantityReceivedByTarget;

        const targetStockObjectExists = typeof targetMenuItemData.stock === 'object' && targetMenuItemData.stock !== null;
        const targetManageStockPath = targetStockObjectExists ? 'stock.manageStock' : 'manageStock';

        const targetMenuItemUpdatePayload: any = {
          'stock.current': targetNewQuantity,
          'updatedAt': now,
          [targetManageStockPath]: true,
        };
        transaction.update(targetMenuItemRef, targetMenuItemUpdatePayload);
        logger.info(`[createAdjustment_REFACTORED] Stock for target menuItem ${targetMenuItemDocId} (product ${globalProductId}) in store ${targetStoreId} updated to ${targetNewQuantity}.`);

        targetAdjustmentResponse = await this.createAdjustmentRecordInTransaction_REFACTORED(transaction, {
          itemId: targetMenuItemDocId, 
          storeId: targetStoreId,
          tenantId,
          adjustmentType: StockAdjustmentType.RECEIPT, // Or TRANSFER_IN
          quantityAdjusted: quantityReceivedByTarget,
          beforeQuantity: targetCurrentQuantity,
          afterQuantity: targetNewQuantity,
          reason: `Transfer from store ${storeId} (Product: ${globalProductId}) - ${options.reason || 'Product Transfer'}`.trim(),
          adjustmentDate,
          operatorId: userId,
        });
        logger.info(`[createAdjustment_REFACTORED] Target stock adjustment record ${targetAdjustmentResponse.adjustmentId} created for item ${targetMenuItemDocId}, target store ${targetStoreId}.`);
      }

      return {
        sourceAdjustment,
        targetAdjustment: targetAdjustmentResponse,
      };
    });
  }

  /**
   * [REFACTORED - Helper, added createdAt/updatedAt to StockAdjustment type]
   * Creates a stock adjustment record within a Firestore transaction.
   */
  async createAdjustmentRecordInTransaction_REFACTORED(
    transaction: admin.firestore.Transaction,
    details: {
      itemId: string; 
      storeId: string;
      tenantId: string;
      adjustmentType: StockAdjustmentType;
      quantityAdjusted: number;
      beforeQuantity: number;
      afterQuantity: number;
      reason?: string;
      adjustmentDate?: Date;
      operatorId: string;
      transferToStoreId?: string; 
    }
  ): Promise<StockAdjustment> {
    const adjustmentId = db.collection('stockAdjustments').doc().id;
    const nowTimestamp = admin.firestore.Timestamp.now().toDate(); // Consistent timestamp for createdAt/updatedAt
    const adjustmentData: StockAdjustment = {
      adjustmentId,
      itemId: details.itemId,
      storeId: details.storeId,
      tenantId: details.tenantId,
      adjustmentType: details.adjustmentType,
      quantityAdjusted: details.quantityAdjusted,
      beforeQuantity: details.beforeQuantity,
      afterQuantity: details.afterQuantity,
      reason: details.reason,
      adjustmentDate: details.adjustmentDate || nowTimestamp, // Use consistent now if not provided
      operatorId: details.operatorId,
      transferToStoreId: details.transferToStoreId,
      createdAt: nowTimestamp, 
      updatedAt: nowTimestamp, 
    };
    const adjustmentRef = db.collection('stockAdjustments').doc(adjustmentId);
    transaction.set(adjustmentRef, adjustmentData);
    logger.info(`[createAdjustmentRecordInTransaction_REFACTORED] Adjustment record ${adjustmentId} set in transaction for item ${details.itemId} store ${details.storeId}.`);
    return adjustmentData;
  }
}

// 導出服務實例
export const inventoryItemService = new InventoryItemService();
export const stockLevelService = new StockLevelService();
export const stockAdjustmentService = new StockAdjustmentService(); 

export {}; // Ensures this is treated as a module if it becomes completely empty 