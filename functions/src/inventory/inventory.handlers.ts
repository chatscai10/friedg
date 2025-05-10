/**
 * 庫存管理模組處理函數
 */

import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { CreateInventoryItemRequest, InventoryItem, InventoryItemsFilter, StockAdjustment, StockAdjustmentType, StockLevel, StockLevelsFilter, UpdateInventoryItemRequest, UpsertStockLevelRequest, CreateStockAdjustmentRequest, StockAdjustmentsFilter } from './inventory.types';

const db = admin.firestore();

/**
 * 創建庫存品項
 * HTTP 端點: POST /inventory/items
 */
export const createInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const itemData: CreateInventoryItemRequest = req.body;
    const tenantId = res.locals.tenantId;
    
    // 驗證必要欄位
    if (!itemData.name || !itemData.category || !itemData.unit) {
      res.status(400).json({
        success: false,
        error: '缺少必要欄位：name, category, unit'
      });
      return;
    }
    
    // 準備資料
    const now = admin.firestore.Timestamp.now();
    const newItem: Omit<InventoryItem, 'itemId'> = {
      name: itemData.name,
      description: itemData.description,
      category: itemData.category,
      unit: itemData.unit,
      supplierInfo: itemData.supplierInfo,
      lowStockThreshold: itemData.lowStockThreshold,
      images: itemData.images || [],
      barcode: itemData.barcode,
      sku: itemData.sku,
      isActive: itemData.isActive !== undefined ? itemData.isActive : true,
      costPerUnit: itemData.costPerUnit,
      tenantId: tenantId,
      createdAt: now.toDate(),
      updatedAt: now.toDate(),
      createdBy: res.locals.userId,
      updatedBy: res.locals.userId
    };
    
    // 寫入資料庫
    const itemRef = await db.collection('inventoryItems').add(newItem);
    const itemId = itemRef.id;
    
    // 更新項目ID
    await itemRef.update({ itemId });
    
    // 回傳創建的資料
    res.status(201).json({
      success: true,
      data: {
        itemId,
        ...newItem
      }
    });
  } catch (error: any) {
    console.error('創建庫存品項時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `創建庫存品項時發生錯誤: ${error.message || error}`
    });
  }
};

/**
 * 獲取特定庫存品項
 * HTTP 端點: GET /inventory/items/:itemId
 */
export const getInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const tenantId = res.locals.tenantId;
    
    // 查詢資料庫
    const itemDoc = await db.collection('inventoryItems')
      .where('itemId', '==', itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemDoc.empty) {
      res.status(404).json({
        success: false,
        error: `找不到 ID 為 ${itemId} 的庫存品項`
      });
      return;
    }
    
    const itemData = itemDoc.docs[0].data() as InventoryItem;
    
    // 如果請求包含 storeId 參數，則同時獲取該店鋪的庫存水平
    if (req.query.storeId) {
      const storeId = req.query.storeId as string;
      const stockLevelDoc = await db.collection('stockLevels')
        .where('itemId', '==', itemId)
        .where('storeId', '==', storeId)
        .where('tenantId', '==', tenantId)
        .limit(1)
        .get();
      
      if (!stockLevelDoc.empty) {
        const stockLevelData = stockLevelDoc.docs[0].data() as StockLevel;
        res.status(200).json({
          success: true,
          data: {
            ...itemData,
            stockLevel: stockLevelData.quantity,
            lowStockThreshold: stockLevelData.lowStockThreshold
          }
        });
        return;
      }
    }
    
    // 如果沒有找到庫存水平或沒有請求，則只返回品項資料
    res.status(200).json({
      success: true,
      data: itemData
    });
  } catch (error: any) {
    console.error('獲取庫存品項時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `獲取庫存品項時發生錯誤: ${error.message || error}`
    });
  }
};

/**
 * 更新庫存品項
 * HTTP 端點: PUT /inventory/items/:itemId
 */
export const updateInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const itemData: UpdateInventoryItemRequest = req.body;
    const tenantId = res.locals.tenantId;
    
    // 先檢查品項是否存在
    const itemQuery = await db.collection('inventoryItems')
      .where('itemId', '==', itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemQuery.empty) {
      res.status(404).json({
        success: false,
        error: `找不到 ID 為 ${itemId} 的庫存品項`
      });
      return;
    }
    
    const itemDoc = itemQuery.docs[0];
    
    // 準備更新資料
    const now = admin.firestore.Timestamp.now();
    const updateData: Partial<InventoryItem> = {
      ...itemData,
      updatedAt: now.toDate(),
      updatedBy: res.locals.userId
    };
    
    // 更新資料庫
    await itemDoc.ref.update(updateData);
    
    // 回傳更新後的資料
    const updatedItemDoc = await itemDoc.ref.get();
    
    res.status(200).json({
      success: true,
      data: updatedItemDoc.data()
    });
  } catch (error: any) {
    console.error('更新庫存品項時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `更新庫存品項時發生錯誤: ${error.message || error}`
    });
  }
};

/**
 * 刪除庫存品項 (軟刪除 - 設置為不活躍)
 * HTTP 端點: DELETE /inventory/items/:itemId
 */
export const deleteInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const tenantId = res.locals.tenantId;
    
    // 先檢查品項是否存在
    const itemQuery = await db.collection('inventoryItems')
      .where('itemId', '==', itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemQuery.empty) {
      res.status(404).json({
        success: false,
        error: `找不到 ID 為 ${itemId} 的庫存品項`
      });
      return;
    }
    
    const itemDoc = itemQuery.docs[0];
    
    // 軟刪除 - 標記為不活躍
    await itemDoc.ref.update({ 
      isActive: false,
      updatedAt: admin.firestore.Timestamp.now().toDate(),
      updatedBy: res.locals.userId
    });
    
    res.status(200).json({
      success: true,
      message: '庫存品項已成功標記為不活躍'
    });
  } catch (error: any) {
    console.error('刪除庫存品項時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `刪除庫存品項時發生錯誤: ${error.message || error}`
    });
  }
};

/**
 * 查詢庫存品項列表
 * HTTP 端點: GET /inventory/items
 */
export const listInventoryItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = res.locals.tenantId;
    
    // 分頁參數
    const page = parseInt(req.query.page as string || '1', 10);
    const pageSize = parseInt(req.query.pageSize as string || '20', 10);
    
    // 過濾條件
    const filter: InventoryItemsFilter = {
      category: req.query.category as string,
      name: req.query.name as string,
      lowStock: req.query.lowStock === 'true',
      isActive: req.query.isActive === undefined ? undefined : req.query.isActive === 'true',
      storeId: req.query.storeId as string
    };
    
    // 構建查詢
    let query = db.collection('inventoryItems').where('tenantId', '==', tenantId);
    
    // 應用過濾條件
    if (filter.category) {
      query = query.where('category', '==', filter.category);
    }
    
    if (filter.isActive !== undefined) {
      query = query.where('isActive', '==', filter.isActive);
    }
    
    // 執行查詢 (name 需要在客戶端進行過濾，因為 Firestore 不支援 LIKE 查詢)
    const snapshot = await query.get();
    
    // 處理查詢結果
    let items = snapshot.docs.map(doc => ({
      ...(doc.data() as InventoryItem),
    }));
    
    // 名稱模糊匹配
    if (filter.name) {
      const searchTerm = filter.name.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm) || 
        (item.description && item.description.toLowerCase().includes(searchTerm))
      );
    }
    
    // 如果需要查看庫存水平
    if (filter.lowStock || filter.storeId) {
      // 首先獲取所有相關的庫存水平記錄
      let stockLevelsQuery = db.collection('stockLevels').where('tenantId', '==', tenantId);
      
      if (filter.storeId) {
        stockLevelsQuery = stockLevelsQuery.where('storeId', '==', filter.storeId);
      }
      
      const stockLevelsSnapshot = await stockLevelsQuery.get();
      const stockLevels: Record<string, StockLevel> = {};
      
      stockLevelsSnapshot.forEach(doc => {
        const data = doc.data() as StockLevel;
        // 使用 itemId 作為鍵
        stockLevels[data.itemId] = data;
      });
      
      // 將庫存水平資訊附加到品項上，並按低庫存過濾
      const itemsWithStock = [];
      for (const item of items) {
        const stockLevel = stockLevels[item.itemId];
        if (stockLevel) {
          // 如果啟用了低庫存過濾，檢查庫存是否低於閾值
          if (filter.lowStock) {
            const threshold = stockLevel.lowStockThreshold || item.lowStockThreshold;
            if (threshold && stockLevel.quantity < threshold) {
              itemsWithStock.push({
                ...item,
                stockLevel: stockLevel.quantity,
                lowStockThreshold: threshold
              });
            }
          } else {
            itemsWithStock.push({
              ...item,
              stockLevel: stockLevel.quantity,
              lowStockThreshold: stockLevel.lowStockThreshold || item.lowStockThreshold
            });
          }
        } else if (!filter.lowStock && !filter.storeId) {
          // 如果不需要過濾庫存，但這個品項在特定店鋪沒有庫存記錄，也包含進來
          itemsWithStock.push({
            ...item,
            stockLevel: 0,
            lowStockThreshold: item.lowStockThreshold
          });
        }
      }
      
      items = itemsWithStock;
    }
    
    // 計算分頁
    const total = items.length;
    const offset = (page - 1) * pageSize;
    const paginatedItems = items.slice(offset, offset + pageSize);
    
    // 回傳結果
    res.status(200).json({
      success: true,
      data: paginatedItems,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error: any) {
    console.error('查詢庫存品項時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `查詢庫存品項時發生錯誤: ${error.message || error}`
    });
  }
};

/**
 * 查詢指定分店的庫存水平列表
 * HTTP 端點: GET /inventory/stores/{storeId}/stockLevels
 */
export const listStockLevels = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = res.locals.tenantId;
    const storeId = req.params.storeId;
    
    // 檢查商店ID是否存在
    if (!storeId) {
      res.status(400).json({
        success: false,
        error: '缺少必要參數：storeId'
      });
      return;
    }
    
    // 檢查用戶是否有權限訪問該店鋪的資料
    const userStoreId = res.locals.storeId;
    if (userStoreId && userStoreId !== storeId && !res.locals.isTenantAdmin) {
      res.status(403).json({
        success: false,
        error: '您沒有權限訪問該分店的庫存資料'
      });
      return;
    }
    
    // 分頁參數
    const page = parseInt(req.query.page as string || '1', 10);
    const pageSize = parseInt(req.query.pageSize as string || '20', 10);
    
    // 過濾條件
    const filter: StockLevelsFilter = {
      itemId: req.query.itemId as string,
      category: req.query.category as string,
      name: req.query.name as string,
      lowStock: req.query.lowStock === 'true'
    };
    
    // 構建查詢
    let query = db.collection('stockLevels')
      .where('tenantId', '==', tenantId)
      .where('storeId', '==', storeId);
    
    // 如果指定了特定商品ID
    if (filter.itemId) {
      query = query.where('itemId', '==', filter.itemId);
    }
    
    // 執行查詢
    const snapshot = await query.get();
    
    // 處理查詢結果
    const stockLevels = snapshot.docs.map(doc => ({
      ...(doc.data() as StockLevel),
      stockLevelId: doc.id
    }));
    
    // 獲取相關的庫存品項詳細資訊
    const itemIds = Array.from(new Set(stockLevels.map(level => level.itemId)));
    const itemsSnapshot = await db.collection('inventoryItems')
      .where('tenantId', '==', tenantId)
      .where('itemId', 'in', itemIds.length > 0 ? itemIds : ['dummy-id'])
      .get();
    
    const itemDetails: Record<string, InventoryItem> = {};
    itemsSnapshot.forEach(doc => {
      const data = doc.data() as InventoryItem;
      itemDetails[data.itemId] = data;
    });
    
    // 將商品詳情附加到庫存水平上，並處理過濾
    let filteredLevels = stockLevels.filter(level => {
      const item = itemDetails[level.itemId];
      
      // 如果找不到品項資訊，跳過
      if (!item) return false;
      
      // 按分類過濾
      if (filter.category && item.category !== filter.category) {
        return false;
      }
      
      // 按名稱過濾 (模糊匹配)
      if (filter.name) {
        const searchTerm = filter.name.toLowerCase();
        if (!item.name.toLowerCase().includes(searchTerm) && 
            !(item.description && item.description.toLowerCase().includes(searchTerm))) {
          return false;
        }
      }
      
      // 按低庫存過濾
      if (filter.lowStock && (!item.lowStockThreshold || level.quantityOnHand >= item.lowStockThreshold)) {
        return false;
      }
      
      return true;
    }).map(level => ({
      ...level,
      itemDetails: itemDetails[level.itemId]
    }));
    
    // 計算分頁
    const total = filteredLevels.length;
    const offset = (page - 1) * pageSize;
    const paginatedLevels = filteredLevels.slice(offset, offset + pageSize);
    
    // 回傳結果
    res.status(200).json({
      success: true,
      data: paginatedLevels,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error: any) {
    console.error('查詢庫存水平時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `查詢庫存水平時發生錯誤: ${error.message || error}`
    });
  }
};

/**
 * 創建庫存調整記錄
 * HTTP 端點: POST /inventory/adjustments
 */
export const createStockAdjustment = async (req: Request, res: Response): Promise<void> => {
  try {
    const adjustmentData: CreateStockAdjustmentRequest = req.body;
    const tenantId = res.locals.tenantId;
    const userId = res.locals.userId;
    
    // 驗證必要欄位
    if (!adjustmentData.itemId || !adjustmentData.storeId || adjustmentData.quantityAdjusted === undefined || !adjustmentData.adjustmentType) {
      res.status(400).json({
        success: false,
        error: '缺少必要欄位：itemId, storeId, quantityAdjusted, adjustmentType'
      });
      return;
    }
    
    // 如果是移撥類型，需要檢查目標分店ID
    if (adjustmentData.adjustmentType === StockAdjustmentType.TRANSFER && !adjustmentData.transferToStoreId) {
      res.status(400).json({
        success: false,
        error: '移撥類型的調整需要指定 transferToStoreId'
      });
      return;
    }
    
    // 檢查品項是否存在
    const itemQuery = await db.collection('inventoryItems')
      .where('itemId', '==', adjustmentData.itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemQuery.empty) {
      res.status(404).json({
        success: false,
        error: `找不到 ID 為 ${adjustmentData.itemId} 的庫存品項`
      });
      return;
    }
    
    // 開始 Firestore 事務
    const result = await db.runTransaction(async (transaction) => {
      // 獲取當前庫存水平
      const stockLevelQuery = await transaction.get(
        db.collection('stockLevels')
          .where('itemId', '==', adjustmentData.itemId)
          .where('storeId', '==', adjustmentData.storeId)
          .where('tenantId', '==', tenantId)
          .limit(1)
      );
      
      // 獲取調整日期
      const now = admin.firestore.Timestamp.now();
      const adjustmentDate = adjustmentData.adjustmentDate ? 
        new Date(adjustmentData.adjustmentDate) : now.toDate();
      
      let currentQuantity = 0;
      let stockLevelRef;
      let stockLevelId;
      let lowStockThreshold = 0;
      
      // 如果庫存水平記錄存在，獲取當前數量
      if (!stockLevelQuery.empty) {
        const stockLevelDoc = stockLevelQuery.docs[0];
        stockLevelRef = stockLevelDoc.ref;
        const stockLevelData = stockLevelDoc.data() as StockLevel;
        stockLevelId = stockLevelData.stockLevelId;
        currentQuantity = stockLevelData.quantity;
        lowStockThreshold = stockLevelData.lowStockThreshold;
      } else {
        // 如果不存在，創建一個新的庫存水平記錄
        stockLevelId = db.collection('stockLevels').doc().id;
        stockLevelRef = db.collection('stockLevels').doc(stockLevelId);
        
        // 從品項獲取低庫存閾值
        const itemData = itemQuery.docs[0].data() as InventoryItem;
        lowStockThreshold = itemData.lowStockThreshold || 0;
      }
      
      // 計算調整後的數量
      let newQuantity = currentQuantity + adjustmentData.quantityAdjusted;
      
      // 確保庫存數量不為負數
      if (newQuantity < 0) {
        return {
          success: false,
          error: '庫存調整後數量不能為負數',
          statusCode: 400
        };
      }
      
      // 創建調整記錄
      const adjustmentId = db.collection('stockAdjustments').doc().id;
      const newAdjustment: StockAdjustment = {
        adjustmentId,
        itemId: adjustmentData.itemId,
        storeId: adjustmentData.storeId,
        tenantId,
        adjustmentType: adjustmentData.adjustmentType,
        quantityAdjusted: adjustmentData.quantityAdjusted,
        reason: adjustmentData.reason,
        adjustmentDate,
        operatorId: userId,
        beforeQuantity: currentQuantity,
        afterQuantity: newQuantity,
        transferToStoreId: adjustmentData.transferToStoreId
      };
      
      // 添加調整記錄
      const adjustmentRef = db.collection('stockAdjustments').doc(adjustmentId);
      transaction.set(adjustmentRef, newAdjustment);
      
      // 更新原始庫存水平
      transaction.set(stockLevelRef, {
        stockLevelId,
        itemId: adjustmentData.itemId,
        storeId: adjustmentData.storeId,
        tenantId,
        quantity: newQuantity,
        lowStockThreshold,
        lastUpdated: now.toDate(),
        lastUpdatedBy: userId
      }, { merge: true });
      
      // 如果是移撥類型，還需要處理目標庫存水平
      if (adjustmentData.adjustmentType === StockAdjustmentType.TRANSFER && adjustmentData.transferToStoreId) {
        // 獲取目標分店的庫存水平
        const targetStockLevelQuery = await transaction.get(
          db.collection('stockLevels')
            .where('itemId', '==', adjustmentData.itemId)
            .where('storeId', '==', adjustmentData.transferToStoreId)
            .where('tenantId', '==', tenantId)
            .limit(1)
        );
        
        let targetQuantity = 0;
        let targetStockLevelRef;
        let targetStockLevelId;
        
        // 如果目標庫存水平記錄存在，獲取當前數量
        if (!targetStockLevelQuery.empty) {
          const targetStockLevelDoc = targetStockLevelQuery.docs[0];
          targetStockLevelRef = targetStockLevelDoc.ref;
          const targetStockLevelData = targetStockLevelDoc.data() as StockLevel;
          targetStockLevelId = targetStockLevelData.stockLevelId;
          targetQuantity = targetStockLevelData.quantity;
        } else {
          // 如果不存在，創建一個新的庫存水平記錄
          targetStockLevelId = db.collection('stockLevels').doc().id;
          targetStockLevelRef = db.collection('stockLevels').doc(targetStockLevelId);
        }
        
        // 更新目標庫存水平
        const newTargetQuantity = targetQuantity + Math.abs(adjustmentData.quantityAdjusted);
        transaction.set(targetStockLevelRef, {
          stockLevelId: targetStockLevelId,
          itemId: adjustmentData.itemId,
          storeId: adjustmentData.transferToStoreId,
          tenantId,
          quantity: newTargetQuantity,
          lowStockThreshold,
          lastUpdated: now.toDate(),
          lastUpdatedBy: userId
        }, { merge: true });
        
        // 為目標分店創建一個入庫的調整記錄
        const targetAdjustmentId = db.collection('stockAdjustments').doc().id;
        const targetAdjustment: StockAdjustment = {
          adjustmentId: targetAdjustmentId,
          itemId: adjustmentData.itemId,
          storeId: adjustmentData.transferToStoreId,
          tenantId,
          adjustmentType: StockAdjustmentType.RECEIPT,
          quantityAdjusted: Math.abs(adjustmentData.quantityAdjusted),
          reason: `從 ${adjustmentData.storeId} 移撥進貨`,
          adjustmentDate,
          operatorId: userId,
          beforeQuantity: targetQuantity,
          afterQuantity: newTargetQuantity
        };
        
        const targetAdjustmentRef = db.collection('stockAdjustments').doc(targetAdjustmentId);
        transaction.set(targetAdjustmentRef, targetAdjustment);
      }
      
      return {
        success: true,
        data: newAdjustment,
        statusCode: 201
      };
    });
    
    // 返回事務處理結果
    res.status(result.statusCode).json({
      success: result.success,
      data: result.data,
      error: result.error
    });
  } catch (error: any) {
    console.error('創建庫存調整時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `創建庫存調整時發生錯誤: ${error.message || error}`
    });
  }
};

/**
 * 獲取庫存調整記錄
 * HTTP 端點: GET /inventory/adjustments/:adjustmentId
 */
export const getStockAdjustment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { adjustmentId } = req.params;
    const tenantId = res.locals.tenantId;
    
    // 查詢資料庫
    const adjustmentDoc = await db.collection('stockAdjustments')
      .where('adjustmentId', '==', adjustmentId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (adjustmentDoc.empty) {
      res.status(404).json({
        success: false,
        error: `找不到 ID 為 ${adjustmentId} 的庫存調整記錄`
      });
      return;
    }
    
    const adjustmentData = adjustmentDoc.docs[0].data() as StockAdjustment;
    
    res.status(200).json({
      success: true,
      data: adjustmentData
    });
  } catch (error: any) {
    console.error('獲取庫存調整記錄時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `獲取庫存調整記錄時發生錯誤: ${error.message || error}`
    });
  }
};

/**
 * 查詢庫存調整記錄列表
 * HTTP 端點: GET /inventory/adjustments
 */
export const listStockAdjustments = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = res.locals.tenantId;
    
    // 分頁參數
    const page = parseInt(req.query.page as string || '1', 10);
    const pageSize = parseInt(req.query.pageSize as string || '20', 10);
    
    // 過濾條件
    const filter: StockAdjustmentsFilter = {
      itemId: req.query.itemId as string,
      storeId: req.query.storeId as string,
      adjustmentType: req.query.adjustmentType as StockAdjustmentType,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      operatorId: req.query.operatorId as string
    };
    
    // 構建查詢
    let query = db.collection('stockAdjustments').where('tenantId', '==', tenantId);
    
    // 應用過濾條件
    if (filter.itemId) {
      query = query.where('itemId', '==', filter.itemId);
    }
    
    if (filter.storeId) {
      query = query.where('storeId', '==', filter.storeId);
    }
    
    if (filter.adjustmentType) {
      query = query.where('adjustmentType', '==', filter.adjustmentType);
    }
    
    if (filter.operatorId) {
      query = query.where('operatorId', '==', filter.operatorId);
    }
    
    // 由於 Firestore 只能有一個範圍查詢，我們檢查是否已添加了 startDate 或 endDate
    if (filter.startDate) {
      query = query.where('adjustmentDate', '>=', filter.startDate);
    }
    
    if (filter.endDate) {
      const nextDay = new Date(filter.endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query = query.where('adjustmentDate', '<', nextDay);
    }
    
    // 執行查詢
    const snapshot = await query.get();
    
    // 處理查詢結果
    const adjustments = snapshot.docs.map(doc => doc.data() as StockAdjustment);
    
    // 計算分頁
    const total = adjustments.length;
    const offset = (page - 1) * pageSize;
    const paginatedAdjustments = adjustments.slice(offset, offset + pageSize);
    
    // 回傳結果
    res.status(200).json({
      success: true,
      data: paginatedAdjustments,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error: any) {
    console.error('查詢庫存調整記錄時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `查詢庫存調整記錄時發生錯誤: ${error.message || error}`
    });
  }
};

/**
 * 設置或更新庫存水平
 * HTTP 端點: PUT /inventory/items/:itemId/stock-levels/:storeId
 */
export const upsertStockLevel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId, storeId } = req.params;
    const stockData: UpsertStockLevelRequest = req.body;
    const tenantId = res.locals.tenantId;
    
    // 驗證必要欄位
    if (stockData.quantity === undefined) {
      res.status(400).json({
        success: false,
        error: '缺少必要欄位：quantity'
      });
      return;
    }
    
    // 先檢查品項是否存在
    const itemQuery = await db.collection('inventoryItems')
      .where('itemId', '==', itemId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    if (itemQuery.empty) {
      res.status(404).json({
        success: false,
        error: `找不到 ID 為 ${itemId} 的庫存品項`
      });
      return;
    }
    
    const itemData = itemQuery.docs[0].data() as InventoryItem;
    
    // 檢查庫存水平是否已存在
    const stockLevelQuery = await db.collection('stockLevels')
      .where('itemId', '==', itemId)
      .where('storeId', '==', storeId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    
    const now = admin.firestore.Timestamp.now();
    const userId = res.locals.userId;
    
    // 取得原始庫存水平（如果存在）
    let originalQuantity = 0;
    
    if (!stockLevelQuery.empty) {
      const existingStockLevel = stockLevelQuery.docs[0].data() as StockLevel;
      originalQuantity = existingStockLevel.quantity;
      
      // 更新現有記錄
      await stockLevelQuery.docs[0].ref.update({
        quantity: stockData.quantity,
        lowStockThreshold: stockData.lowStockThreshold || itemData.lowStockThreshold,
        lastUpdated: now.toDate(),
        lastUpdatedBy: userId
      });
      
      // 回傳更新後的數據
      res.status(200).json({
        success: true,
        data: {
          stockLevelId: existingStockLevel.stockLevelId,
          itemId,
          storeId,
          tenantId,
          quantity: stockData.quantity,
          lowStockThreshold: stockData.lowStockThreshold || itemData.lowStockThreshold,
          lastUpdated: now.toDate(),
          lastUpdatedBy: userId
        },
        meta: {
          quantityChange: stockData.quantity - originalQuantity
        }
      });
    } else {
      // 創建新記錄
      const stockLevelId = db.collection('stockLevels').doc().id;
      const newStockLevel: StockLevel = {
        stockLevelId,
        itemId,
        storeId,
        tenantId,
        quantity: stockData.quantity,
        lowStockThreshold: stockData.lowStockThreshold || itemData.lowStockThreshold || 0,
        lastUpdated: now.toDate(),
        lastUpdatedBy: userId
      };
      
      await db.collection('stockLevels').doc(stockLevelId).set(newStockLevel);
      
      // 回傳創建的數據
      res.status(201).json({
        success: true,
        data: newStockLevel,
        meta: {
          quantityChange: stockData.quantity
        }
      });
    }
    
    // 如果是庫存變更，自動創建一個庫存調整記錄
    if (stockLevelQuery.empty || originalQuantity !== stockData.quantity) {
      const adjustmentId = db.collection('stockAdjustments').doc().id;
      const adjustmentData: StockAdjustment = {
        adjustmentId,
        itemId,
        storeId,
        tenantId,
        adjustmentType: StockAdjustmentType.STOCK_COUNT,
        quantityAdjusted: stockData.quantity - originalQuantity,
        reason: '庫存水平更新',
        adjustmentDate: now.toDate(),
        operatorId: userId,
        beforeQuantity: originalQuantity,
        afterQuantity: stockData.quantity
      };
      
      await db.collection('stockAdjustments').doc(adjustmentId).set(adjustmentData);
    }
  } catch (error: any) {
    console.error('更新庫存水平時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `更新庫存水平時發生錯誤: ${error.message || error}`
    });
  }
};

/**
 * 獲取特定店鋪的庫存水平
 * HTTP 端點: GET /inventory/stock-levels/:storeId
 */
export const getStoreStockLevels = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const tenantId = res.locals.tenantId;
    
    // 過濾條件
    const filter: StockLevelsFilter = {
      itemId: req.query.itemId as string,
      category: req.query.category as string,
      name: req.query.name as string,
      lowStock: req.query.lowStock === 'true'
    };
    
    // 分頁參數
    const page = parseInt(req.query.page as string || '1', 10);
    const pageSize = parseInt(req.query.pageSize as string || '20', 10);
    
    // 構建查詢
    let query = db.collection('stockLevels')
      .where('tenantId', '==', tenantId)
      .where('storeId', '==', storeId);
    
    // 應用過濾條件
    if (filter.itemId) {
      query = query.where('itemId', '==', filter.itemId);
    }
    
    // 執行查詢
    const snapshot = await query.get();
    let stockLevels = snapshot.docs.map(doc => doc.data() as StockLevel);
    
    // 獲取相關品項資訊
    const itemIds = [...new Set(stockLevels.map(sl => sl.itemId))];
    const itemsSnapshot = await db.collection('inventoryItems')
      .where('tenantId', '==', tenantId)
      .where('itemId', 'in', itemIds.length > 0 ? itemIds : ['dummy'])
      .get();
    
    const itemsMap: Record<string, InventoryItem> = {};
    itemsSnapshot.forEach(doc => {
      const item = doc.data() as InventoryItem;
      itemsMap[item.itemId] = item;
    });
    
    // 合併品項資訊和庫存資訊
    const result = stockLevels.map(stockLevel => {
      const item = itemsMap[stockLevel.itemId];
      if (!item) return null; // 如果找不到相關品項，則跳過
      
      return {
        ...stockLevel,
        item: {
          itemId: item.itemId,
          name: item.name,
          description: item.description,
          category: item.category,
          unit: item.unit,
          images: item.images
        }
      };
    }).filter(item => item !== null);
    
    // 應用其他過濾條件
    let filteredResults = result as any[];
    
    if (filter.category) {
      filteredResults = filteredResults.filter(r => 
        r.item.category === filter.category
      );
    }
    
    if (filter.name) {
      const searchTerm = filter.name.toLowerCase();
      filteredResults = filteredResults.filter(r =>
        r.item.name.toLowerCase().includes(searchTerm) ||
        (r.item.description && r.item.description.toLowerCase().includes(searchTerm))
      );
    }
    
    if (filter.lowStock) {
      filteredResults = filteredResults.filter(r =>
        r.quantity < r.lowStockThreshold
      );
    }
    
    // 計算分頁
    const total = filteredResults.length;
    const offset = (page - 1) * pageSize;
    const paginatedResults = filteredResults.slice(offset, offset + pageSize);
    
    // 回傳結果
    res.status(200).json({
      success: true,
      data: paginatedResults,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error: any) {
    console.error('獲取店鋪庫存水平時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `獲取店鋪庫存水平時發生錯誤: ${error.message || error}`
    });
  }
}; 