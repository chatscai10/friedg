/**
 * 庫存品項服務
 * 
 * 處理庫存品項的業務邏輯
 */
import { InventoryItem, InventoryItemsFilter } from '../inventory.types';
import { InventoryItemRepository } from '../repositories/inventory-item.repository';
import { MemoryCache } from '../cache/memory-cache';
import { validateInventoryItem } from '../utils/validators';
import { ItemNotFoundError } from '../utils/errors';

export class InventoryItemService {
  private itemCache: MemoryCache<InventoryItem>;
  private listCache: MemoryCache<any>;
  
  constructor(
    private repository: InventoryItemRepository
  ) {
    this.itemCache = new MemoryCache<InventoryItem>(600); // 10分鐘
    this.listCache = new MemoryCache<any>(60); // 1分鐘
  }

  /**
   * 創建新的庫存品項
   */
  async createItem(item: Omit<InventoryItem, 'itemId' | 'createdAt' | 'updatedAt'>) {
    // 驗證輸入數據
    validateInventoryItem(item);
    
    // 儲存品項
    const createdItem = await this.repository.createItem(item);
    
    // 清除相關緩存
    this.listCache.invalidateByPrefix(`items_${item.tenantId}`);
    
    return createdItem;
  }
  
  /**
   * 獲取庫存品項詳情
   */
  async getItem(itemId: string, tenantId: string): Promise<InventoryItem | null> {
    const cacheKey = `item_${tenantId}_${itemId}`;
    
    // 檢查緩存
    const cachedItem = this.itemCache.get(cacheKey);
    if (cachedItem) {
      return cachedItem;
    }
    
    // 從資料庫獲取
    const item = await this.repository.getItem(itemId, tenantId);
    
    // 存入緩存
    if (item) {
      this.itemCache.set(cacheKey, item);
    }
    
    return item;
  }
  
  /**
   * 更新庫存品項
   */
  async updateItem(itemId: string, tenantId: string, data: Partial<InventoryItem>, updatedBy: string) {
    // 更新資料
    const updatedItem = await this.repository.updateItem(itemId, tenantId, data, updatedBy);
    
    // 更新緩存
    const cacheKey = `item_${tenantId}_${itemId}`;
    this.itemCache.set(cacheKey, updatedItem);
    
    // 清除相關列表緩存
    this.listCache.invalidateByPrefix(`items_${tenantId}`);
    
    return updatedItem;
  }
  
  /**
   * 軟刪除庫存品項 (設為非活躍)
   */
  async deleteItem(itemId: string, tenantId: string, deletedBy: string) {
    // 刪除品項
    const result = await this.repository.deleteItem(itemId, tenantId, deletedBy);
    
    // 清除緩存
    const cacheKey = `item_${tenantId}_${itemId}`;
    this.itemCache.delete(cacheKey);
    
    // 清除相關列表緩存
    this.listCache.invalidateByPrefix(`items_${tenantId}`);
    
    return result;
  }
  
  /**
   * 查詢庫存品項，支援分頁和過濾
   */
  async listItems(tenantId: string, filter: InventoryItemsFilter = {}, page = 1, pageSize = 20) {
    // 構建緩存鍵
    const filterKey = JSON.stringify(filter);
    const cacheKey = `items_${tenantId}_${filterKey}_p${page}_s${pageSize}`;
    
    // 檢查緩存
    const cachedResult = this.listCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    // 從儲存庫獲取並過濾數據
    const result = await this.repository.listItems(tenantId, filter, page, pageSize);
    
    // 存入緩存
    this.listCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * 批量獲取多個商品信息
   */
  async batchGetItems(itemIds: string[], tenantId: string): Promise<Record<string, InventoryItem>> {
    // 檢查空數組
    if (itemIds.length === 0) return {};
    
    // 先嘗試從緩存中獲取
    const itemsMap: Record<string, InventoryItem> = {};
    const missingItemIds: string[] = [];
    
    // 檢查哪些可以從緩存獲取，哪些需要從資料庫獲取
    for (const itemId of itemIds) {
      const cacheKey = `item_${tenantId}_${itemId}`;
      const cachedItem = this.itemCache.get(cacheKey);
      
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
    const dbItems = await this.repository.batchGetItems(missingItemIds, tenantId);
    
    // 更新緩存並合併結果
    for (const [itemId, item] of Object.entries(dbItems)) {
      const cacheKey = `item_${tenantId}_${itemId}`;
      this.itemCache.set(cacheKey, item);
      itemsMap[itemId] = item;
    }
    
    return itemsMap;
  }
} 