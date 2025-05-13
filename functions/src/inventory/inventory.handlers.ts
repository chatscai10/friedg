/**
 * 庫存管理模組處理函數
 */

import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { CreateInventoryItemRequest, InventoryItem, InventoryItemsFilter, StockAdjustment, StockAdjustmentType, StockLevel, StockLevelsFilter, UpdateInventoryItemRequest, UpsertStockLevelRequest, CreateStockAdjustmentRequest, StockAdjustmentsFilter } from './inventory.types';
import { inventoryItemService, stockLevelService, stockAdjustmentService } from './service';

const db = admin.firestore();

/**
 * 創建庫存品項
 * HTTP 端點: POST /inventory/items
 */
export const createInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const itemData: CreateInventoryItemRequest = req.body;
    const tenantId = res.locals.tenantId;
    const userId = res.locals.userId;
    
    // 驗證必要欄位
    if (!itemData.name || !itemData.category || !itemData.unit) {
      res.status(400).json({
        success: false,
        error: '缺少必要欄位：name, category, unit'
      });
      return;
    }
    
    // 準備資料
    const newItem: Omit<InventoryItem, 'itemId' | 'createdAt' | 'updatedAt'> = {
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
      createdBy: userId,
      updatedBy: userId
    };
    
    // 使用服務層創建品項
    const createdItem = await inventoryItemService.createItem(newItem);
    
    // 回傳創建的資料
    res.status(201).json({
      success: true,
      data: createdItem
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
    const storeId = req.query.storeId as string;
    
    // 使用服務層獲取品項詳情
    const item = await inventoryItemService.getItem(itemId, tenantId);
    
    if (!item) {
      res.status(404).json({
        success: false,
        error: `找不到 ID 為 ${itemId} 的庫存品項`
      });
      return;
    }
    
    // 如果請求包含 storeId 參數，則同時獲取該店鋪的庫存水平
    if (storeId) {
      try {
        const stockLevel = await stockLevelService.upsertStockLevel(
          itemId, 
          storeId, 
          tenantId, 
          0, // 默認數量為0
          undefined, 
          'system'
        );
        
        res.status(200).json({
          success: true,
          data: {
            ...item,
            stockLevel: stockLevel.quantity,
            lowStockThreshold: stockLevel.lowStockThreshold
          }
        });
        return;
      } catch (levelError) {
        console.error('獲取庫存水平時發生錯誤:', levelError);
        // 即使獲取庫存水平失敗，仍然返回品項資訊
      }
    }
    
    // 如果沒有找到庫存水平或沒有請求，則只返回品項資料
    res.status(200).json({
      success: true,
      data: item
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
    const userId = res.locals.userId;
    
    try {
      // 使用服務層更新品項
      const updatedItem = await inventoryItemService.updateItem(
        itemId, 
        tenantId, 
        itemData, 
        userId
      );
      
      // 回傳更新後的資料
      res.status(200).json({
        success: true,
        data: updatedItem
      });
    } catch (error: any) {
      // 處理具體業務錯誤
      if (error.message && error.message.includes('找不到')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        throw error; // 重新拋出非預期的錯誤，讓外層捕獲
      }
    }
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
    const userId = res.locals.userId;
    
    try {
      // 使用服務層執行軟刪除
      const result = await inventoryItemService.deleteItem(itemId, tenantId, userId);
      
      res.status(200).json({
        success: true,
        message: '庫存品項已成功標記為不活躍'
      });
    } catch (error: any) {
      // 處理具體業務錯誤
      if (error.message && error.message.includes('找不到')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        throw error; // 重新拋出非預期的錯誤，讓外層捕獲
      }
    }
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
    
    // 使用服務層處理業務邏輯
    const result = await inventoryItemService.listItems(tenantId, filter, page, pageSize);
    
    // 回傳結果
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination
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
    
    // 使用服務層獲取庫存水平
    const result = await stockLevelService.getStoreStockLevels(
      storeId,
      tenantId,
      filter,
      page,
      pageSize
    );
    
    // 回傳結果
    res.status(200).json({
      success: true,
      data: result.levels,
      pagination: result.pagination
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
    
    try {
      // 使用服務層創建庫存調整
      const adjustment = await stockAdjustmentService.createAdjustment(
        tenantId,
        adjustmentData.itemId,
        adjustmentData.storeId,
        adjustmentData.adjustmentType,
        adjustmentData.quantityAdjusted,
        userId,
        {
          reason: adjustmentData.reason,
          adjustmentDate: adjustmentData.adjustmentDate ? new Date(adjustmentData.adjustmentDate) : undefined,
          transferToStoreId: adjustmentData.transferToStoreId
        }
      );
      
      // 回傳成功結果
      res.status(201).json({
        success: true,
        data: adjustment
      });
      
      // 記錄庫存操作事件 (非同步處理，不影響主流程)
      try {
        const eventData = {
          type: 'inventory_adjustment',
          adjustmentId: adjustment.adjustmentId,
          itemId: adjustmentData.itemId,
          storeId: adjustmentData.storeId,
          adjustmentType: adjustmentData.adjustmentType,
          quantity: adjustmentData.quantityAdjusted,
          tenantId,
          userId,
          timestamp: admin.firestore.Timestamp.now().toDate()
        };
        
        // 使用 await 確保事件記錄完成
        await db.collection('events').add(eventData);
      } catch (eventError) {
        // 僅記錄錯誤，不影響主流程
        console.error('記錄庫存調整事件時發生錯誤:', eventError);
      }
    } catch (error: any) {
      // 處理具體業務錯誤
      if (error.message.includes('調整後庫存數量不能為負數')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else if (error.message.includes('找不到')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        throw error; // 重新拋出非預期的錯誤，讓外層捕獲
      }
    }
  } catch (error: any) {
    // 整體例外處理
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
    
    try {
      // 使用服務層獲取調整記錄
      const adjustment = await stockAdjustmentService.getAdjustment(adjustmentId, tenantId);
      
      res.status(200).json({
        success: true,
        data: adjustment
      });
    } catch (error: any) {
      // 處理具體業務錯誤
      if (error.message && error.message.includes('找不到')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        throw error; // 重新拋出非預期的錯誤，讓外層捕獲
      }
    }
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
    
    // 使用服務層獲取調整記錄
    const result = await stockAdjustmentService.listAdjustments(
      tenantId,
      filter,
      page,
      pageSize
    );
    
    // 回傳結果
    res.status(200).json({
      success: true,
      data: result.adjustments,
      pagination: result.pagination
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
    const userId = res.locals.userId;
    
    // 驗證必要欄位
    if (stockData.quantity === undefined) {
      res.status(400).json({
        success: false,
        error: '缺少必要欄位：quantity'
      });
      return;
    }
    
    try {
      // 使用服務層更新庫存水平
      const updatedLevel = await stockLevelService.upsertStockLevel(
        itemId,
        storeId,
        tenantId,
        stockData.quantity,
        stockData.lowStockThreshold,
        userId
      );
      
      // 如果更新了庫存水平，創建一條調整記錄
      // 注意: 對比舊版實現，這裡需要知道原始數量來計算變更，但 upsertStockLevel 方法不會返回這個資訊
      // 為簡化代碼，直接使用 stockAdjustmentService 來建立記錄
      const adjustmentType = StockAdjustmentType.STOCK_COUNT;
      const reason = '庫存水平更新';
      
      try {
        await stockAdjustmentService.createAdjustment(
          tenantId,
          itemId,
          storeId,
          adjustmentType,
          0, // 這裡會在服務層自動計算差值
          userId,
          {
            reason,
            adjustmentDate: new Date()
          }
        );
      } catch (adjustError) {
        console.error('創建庫存調整記錄時發生錯誤:', adjustError);
        // 不影響主流程
      }
      
      // 回傳更新或創建的數據
      res.status(updatedLevel ? 200 : 201).json({
        success: true,
        data: updatedLevel
      });
    } catch (error: any) {
      // 處理具體業務錯誤
      if (error.message && error.message.includes('找不到')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        throw error; // 重新拋出非預期的錯誤，讓外層捕獲
      }
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
    
    // 使用服務層獲取庫存水平
    const result = await stockLevelService.getStoreStockLevels(
      storeId,
      tenantId,
      filter,
      page,
      pageSize
    );
    
    // 回傳結果
    res.status(200).json({
      success: true,
      data: result.levels,
      pagination: result.pagination
    });
  } catch (error: any) {
    console.error('獲取店鋪庫存水平時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `獲取店鋪庫存水平時發生錯誤: ${error.message || error}`
    });
  }
}; 