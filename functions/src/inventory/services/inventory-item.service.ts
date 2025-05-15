/**
 * 庫存品項服務
 * 
 * 處理庫存品項的業務邏輯
 */
import * as admin from 'firebase-admin';
import {
  InventoryItem,
  InventoryItemsFilter,
  StockLevel // Assuming StockLevel might be needed if listItems implies stock levels are attached
} from '../inventory.types';
import { InventoryItemRepository } from '../repositories/inventory-item.repository';
import { MemoryCache } from '../../../utils/memory-cache';
import { validateInventoryItem } from '../utils/validators';
import { ItemNotFoundError } from '../utils/errors';
// import { stockLevelService } from './stock-level.service'; // Temporarily remove direct service-to-service import if causing issues, will be handled by handler or DI later

const db = admin.firestore();

// These should be initialized and potentially exported from a central place or injected.
// For now, to make the split class work, we define them here. This is a temporary measure.
// const itemCache = new MemoryCache<InventoryItem>(600);
// const listCache = new MemoryCache<any>(60);

export class InventoryItemService {
  // private itemCache: MemoryCache<InventoryItem>;
  // private listCache: MemoryCache<any>;
  
  constructor(
    private repository: InventoryItemRepository,
    private itemCache: MemoryCache<InventoryItem>,
    private listCache: MemoryCache<any>
    // private stockLevelService: StockLevelService // Optional: if we decide to inject
  ) {
    // this.itemCache = itemCache;
    // this.listCache = listCache;
  }

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
    
    this.listCache.invalidateByPrefix(`items_${item.tenantId}`);
    
    return createdItem;
  }
  
  /**
   * 獲取庫存品項詳情
   */
  async getItem(itemId: string, tenantId: string): Promise<InventoryItem | null> {
    const cacheKey = `item_${tenantId}_${itemId}`;
    
    const cachedItem = this.itemCache.get(cacheKey);
    if (cachedItem) {
      return cachedItem;
    }
    
    const itemDoc = await db.collection('inventoryItems')
      .where('itemId', '==', itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemDoc.empty) {
      return null;
    }
    
    const item = itemDoc.docs[0].data() as InventoryItem;
    this.itemCache.set(cacheKey, item);
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
    const updatedItemDoc = await itemDoc.ref.get();
    const updatedItem = updatedItemDoc.data() as InventoryItem;
    
    const cacheKey = `item_${tenantId}_${itemId}`;
    this.itemCache.set(cacheKey, updatedItem);
    this.listCache.invalidateByPrefix(`items_${tenantId}`);
    
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
    
    const cacheKey = `item_${tenantId}_${itemId}`;
    this.itemCache.delete(cacheKey);
    this.listCache.invalidateByPrefix(`items_${tenantId}`);
    
    return { success: true };
  }
  
  /**
   * 查詢庫存品項，支援分頁和過濾
   */
  async listItems(tenantId: string, filter: InventoryItemsFilter = {}, page = 1, pageSize = 20) {
    const filterKey = JSON.stringify(filter);
    const cacheKey = `items_${tenantId}_${filterKey}_p${page}_s${pageSize}`;
    
    const cachedResult = this.listCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    let query = db.collection('inventoryItems').where('tenantId', '==', tenantId);
    if (filter.category) {
      query = query.where('category', '==', filter.category) as any;
    }
    if (filter.isActive !== undefined) {
      query = query.where('isActive', '==', filter.isActive) as any;
    }
    
    const snapshot = await query.get();
    if (snapshot.empty) {
      const emptyResult = { items: [], pagination: { total: 0, page, pageSize, totalPages: 0 } };
      this.listCache.set(cacheKey, emptyResult);
      return emptyResult;
    }
    
    let items = snapshot.docs.map(doc => doc.data() as InventoryItem);
    if (filter.name) {
      const searchTerm = filter.name.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm) || 
        (item.description && item.description.toLowerCase().includes(searchTerm))
      );
    }
    
    if (filter.lowStock || filter.storeId) {
      const itemIds = items.map(item => item.itemId);
      // This creates a temporary circular dependency issue if StockLevelService also imports InventoryItemService directly.
      // This should ideally be resolved by a proper DI mechanism or by handlers coordinating service calls.
      // For this refactoring step, we assume StockLevelService is available or this part needs careful review for runtime instantiation.
      // One simple way for now is to instantiate it here if not available globally.
      const { StockLevelService: TempStockLevelService } = await import('./stock-level.service'); // Dynamic import to avoid top-level cycle
      const tempStockLevelServiceInstance = new TempStockLevelService();
      // Need to ensure tempStockLevelServiceInstance also gets its dependencies if any (like its own caches or other services)
 
      const stockLevelMap = await tempStockLevelServiceInstance.batchGetStockLevels(
        itemIds,
        filter.storeId || null,
        tenantId
      );
      
      if (filter.lowStock) {
        items = items.filter(item => {
          const itemLevels = stockLevelMap[item.itemId] || [];
          return itemLevels.some(level => 
            level.quantity < (level.lowStockThreshold || item.lowStockThreshold || 0)
          );
        });
      }
      items = items.map(item => ({ ...item, stockLevels: stockLevelMap[item.itemId] || [] })) as any;
    }
    
    const total = items.length;
    const offset = (page - 1) * pageSize;
    const paginatedItems = items.slice(offset, offset + pageSize);
    
    const result = { items: paginatedItems, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
    this.listCache.set(cacheKey, result);
    return result;
  }

  /**
   * 批量獲取多個商品信息
   */
  async batchGetItems(itemIds: string[], tenantId: string): Promise<Record<string, InventoryItem>> {
    const itemsMap: Record<string, InventoryItem> = {};
    const missingItemIds: string[] = [];
    
    for (const itemId of itemIds) {
      const cacheKey = `item_${tenantId}_${itemId}`;
      const cachedItem = this.itemCache.get(cacheKey);
      if (cachedItem) {
        itemsMap[itemId] = cachedItem;
      } else {
        missingItemIds.push(itemId);
      }
    }
    
    if (missingItemIds.length === 0) {
      return itemsMap;
    }
    
    for (let i = 0; i < missingItemIds.length; i += 10) {
      const batchIds = missingItemIds.slice(i, i + 10);
      if (batchIds.length === 0) continue;
      
      const batchSnapshot = await db.collection('inventoryItems')
        .where('tenantId', '==', tenantId)
        .where('itemId', 'in', batchIds)
        .get();
      
      batchSnapshot.docs.forEach(doc => {
        const item = doc.data() as InventoryItem;
        const cacheKey = `item_${tenantId}_${item.itemId}`;
        this.itemCache.set(cacheKey, item);
        itemsMap[item.itemId] = item;
      });
    }
    return itemsMap;
  }
} 