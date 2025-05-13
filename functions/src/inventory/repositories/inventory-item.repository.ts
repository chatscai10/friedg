/**
 * 庫存品項儲存庫
 * 
 * 負責庫存品項的資料存取邏輯
 */
import * as admin from 'firebase-admin';
import { InventoryItem, InventoryItemsFilter } from '../inventory.types';
import { firestoreProvider } from '../db/database.provider';
import { ItemNotFoundError } from '../utils/errors';

export class InventoryItemRepository {
  private collection = 'inventoryItems';
  
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
    
    const db = firestoreProvider;
    const itemRef = await db.collection(this.collection).add(newItem);
    const itemId = itemRef.id;
    
    await itemRef.update({ itemId });
    
    return {
      itemId,
      ...newItem
    } as InventoryItem;
  }
  
  /**
   * 獲取庫存品項詳情
   */
  async getItem(itemId: string, tenantId: string): Promise<InventoryItem | null> {
    const db = firestoreProvider;
    
    const itemDoc = await db.collection(this.collection)
      .where('itemId', '==', itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemDoc.empty) {
      return null;
    }
    
    return itemDoc.docs[0].data() as InventoryItem;
  }
  
  /**
   * 更新庫存品項
   */
  async updateItem(itemId: string, tenantId: string, data: Partial<InventoryItem>, updatedBy: string) {
    const db = firestoreProvider;
    
    const itemQuery = await db.collection(this.collection)
      .where('itemId', '==', itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemQuery.empty) {
      throw new ItemNotFoundError(itemId);
    }
    
    const itemDoc = itemQuery.docs[0];
    
    const updateData: Partial<InventoryItem> = {
      ...data,
      updatedAt: admin.firestore.Timestamp.now().toDate(),
      updatedBy
    };
    
    await itemDoc.ref.update(updateData);
    
    const updatedItemDoc = await itemDoc.ref.get();
    return updatedItemDoc.data() as InventoryItem;
  }
  
  /**
   * 軟刪除庫存品項 (設為非活躍)
   */
  async deleteItem(itemId: string, tenantId: string, deletedBy: string) {
    const db = firestoreProvider;
    
    const itemQuery = await db.collection(this.collection)
      .where('itemId', '==', itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemQuery.empty) {
      throw new ItemNotFoundError(itemId);
    }
    
    const itemDoc = itemQuery.docs[0];
    
    await itemDoc.ref.update({
      isActive: false,
      updatedAt: admin.firestore.Timestamp.now().toDate(),
      updatedBy: deletedBy
    });
    
    return { success: true };
  }
  
  /**
   * 查詢庫存品項列表
   */
  async listItems(tenantId: string, filter: InventoryItemsFilter = {}, page = 1, pageSize = 20) {
    const db = firestoreProvider;
    
    // 構建基本查詢
    let query = db.collection(this.collection).where('tenantId', '==', tenantId);
    
    // 添加可在資料庫層過濾的條件
    if (filter.category) {
      query = query.where('category', '==', filter.category) as any;
    }
    
    if (filter.isActive !== undefined) {
      query = query.where('isActive', '==', filter.isActive) as any;
    }
    
    // 執行查詢
    const snapshot = await query.get();
    
    // 處理結果...
    if (snapshot.empty) {
      return {
        items: [],
        pagination: {
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      };
    }
    
    // 取得與過濾數據...
    let items = snapshot.docs.map(doc => doc.data() as InventoryItem);
    
    // 應用內存中過濾條件
    if (filter.name) {
      const searchTerm = filter.name.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm) || 
        (item.description && item.description.toLowerCase().includes(searchTerm))
      );
    }
    
    // 計算分頁
    const total = items.length;
    const offset = (page - 1) * pageSize;
    const paginatedItems = items.slice(offset, offset + pageSize);
    
    return {
      items: paginatedItems,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }
  
  /**
   * 批量獲取多個商品信息
   */
  async batchGetItems(itemIds: string[], tenantId: string): Promise<Record<string, InventoryItem>> {
    if (itemIds.length === 0) return {};
    
    const db = firestoreProvider;
    const itemsMap: Record<string, InventoryItem> = {};
    
    // 每次查詢最多10個項目（Firestore限制）
    for (let i = 0; i < itemIds.length; i += 10) {
      const batchIds = itemIds.slice(i, i + 10);
      
      if (batchIds.length === 0) continue;
      
      const batchSnapshot = await db.collection(this.collection)
        .where('tenantId', '==', tenantId)
        .where('itemId', 'in', batchIds)
        .get();
      
      batchSnapshot.docs.forEach(doc => {
        const item = doc.data() as InventoryItem;
        itemsMap[item.itemId] = item;
      });
    }
    
    return itemsMap;
  }
} 