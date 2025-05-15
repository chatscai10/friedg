/**
 * 庫存管理模組處理函數
 */

import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { CreateInventoryItemRequest, InventoryItem, InventoryItemsFilter, StockAdjustment, StockAdjustmentType, UpdateInventoryItemRequest, UpsertStockLevelRequest, CreateStockAdjustmentRequest, StockAdjustmentsFilter } from './inventory.types';
import {
  inventoryItemService,
  stockLevelService,
  stockAdjustmentService
} from './services'; // This will now point to services/index.ts
import { logger } from '../logger'; // Corrected logger path

// const db = admin.firestore(); // db instance can be removed if services encapsulate all Firestore interactions

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
    logger.error('創建庫存品項時發生錯誤:', error);
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
    
    // 使用服務層獲取品項詳情 (來自 inventoryItems collection)
    const item = await inventoryItemService.getItem(itemId, tenantId);
    
    if (!item) {
      res.status(404).json({
        success: false,
        error: `找不到 ID 為 ${itemId} 的庫存品項定義`
      });
      return;
    }
    
    // 如果請求包含 storeId 參數，則嘗試獲取該店鋪在 menuItems 中的庫存信息
    if (storeId) {
      try {
        // PLACEHOLDER: This service method needs to be implemented.
        // It should fetch stock information from the 'menuItems' collection for the given itemId (as productId) and storeId.
        // const menuItemStockInfo = await stockLevelService.getMenuItemStockInfo(item.itemId, storeId, tenantId);
        
        // For now, let's assume we cannot reliably get this yet without the new service method.
        // We will return the item definition only.
        // If getMenuItemStockInfo were available:
        // if (menuItemStockInfo) {
        //   res.status(200).json({
        //     success: true,
        //     data: {
        //       ...item, // from inventoryItems
        //       liveStock: menuItemStockInfo.quantity, // from menuItems
        //       liveLowStockThreshold: menuItemStockInfo.lowStockThreshold // from menuItems
        //     }
        //   });
        //   return;
        // }
        logger.warn(`[getInventoryItem] Stock info from menuItems for item ${itemId}, store ${storeId} not yet implemented for direct fetch. Returning item definition only.`);
      } catch (levelError: any) {
        logger.error(`[getInventoryItem] Error attempting to fetch menu item stock info for item ${itemId}, store ${storeId}: ${levelError.message}`);
        // Fall through to return item definition
      }
    }
    
    // 只返回品項定義資料
    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error: any) {
    logger.error('獲取庫存品項時發生錯誤:', { error: error.message, itemId: req.params.itemId, tenantId: res.locals.tenantId });
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
    logger.error('更新庫存品項時發生錯誤:', error);
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
    logger.error('刪除庫存品項時發生錯誤:', error);
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
    logger.error('查詢庫存品項時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `查詢庫存品項時發生錯誤: ${error.message || error}`
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

    if (!adjustmentData.itemId || !adjustmentData.storeId || !adjustmentData.adjustmentType || adjustmentData.quantityAdjusted === undefined) {
      res.status(400).json({
        success: false,
        error: '缺少必要欄位：itemId, storeId, adjustmentType, quantityAdjusted'
      });
      return;
    }
    
    const options: {
      reason?: string;
      adjustmentDate?: Date;
      transferToStoreId?: string;
      isInitialStock?: boolean;
      productId?: string; 
    } = {
      reason: adjustmentData.reason,
      adjustmentDate: adjustmentData.adjustmentDate ? new Date(adjustmentData.adjustmentDate) : undefined,
      transferToStoreId: adjustmentData.transferToStoreId,
      isInitialStock: adjustmentData.isInitialStock,
      productId: adjustmentData.productId 
    };

    // Use the injected stockAdjustmentService and its refactored method
    const result = await stockAdjustmentService.createAdjustment_REFACTORED(
      tenantId,
      adjustmentData.itemId, 
      adjustmentData.storeId,
      adjustmentData.adjustmentType,
      adjustmentData.quantityAdjusted,
      userId,
      options
    );

    res.status(201).json({
      success: true,
      message: '庫存調整已成功創建。',
      data: result 
    });

  } catch (error: any) {
    logger.error('創建庫存調整時發生錯誤:', { error: error.message, body: req.body, tenantId: res.locals.tenantId });
    if (error.message && (error.message.includes('not found') || error.message.includes('找不到'))) {
      res.status(404).json({ success: false, error: error.message });
    } else if (error.message && (error.message.includes('不匹配') || error.message.includes('無效') || error.message.includes('不能為負數') || error.message.includes('mismatch'))) {
      res.status(400).json({ success: false, error: error.message });
    } else {
      res.status(500).json({
        success: false,
        error: `創建庫存調整時發生錯誤: ${error.message || error}`
      });
    }
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
    
    // Use the injected stockAdjustmentService
    const adjustment = await stockAdjustmentService.getAdjustment(adjustmentId, tenantId);
      
    if (!adjustment) {
      res.status(404).json({
        success: false,
        error: `找不到 ID 為 ${adjustmentId} 的庫存調整記錄`
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: adjustment
    });

  } catch (error: any) {
    logger.error('獲取庫存調整記錄時發生錯誤:', { error: error.message, params: req.params, tenantId: res.locals.tenantId });
    // Simplified error handling here, specific service errors (like not found) should be handled if service throws them
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
    const page = parseInt(req.query.page as string || '1', 10);
    const pageSize = parseInt(req.query.pageSize as string || '20', 10);
    
    const filter: StockAdjustmentsFilter = {
      itemId: req.query.itemId as string,
      storeId: req.query.storeId as string,
      adjustmentType: req.query.adjustmentType as StockAdjustmentType,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      operatorId: req.query.operatorId as string
    };
    
    // Use the injected stockAdjustmentService
    const result = await stockAdjustmentService.listAdjustments(
      tenantId,
      filter,
      page,
      pageSize
    );
    
    res.status(200).json({
      success: true,
      data: result.adjustments,
      pagination: result.pagination
    });
  } catch (error: any) {
    logger.error('查詢庫存調整記錄時發生錯誤:', { error: error.message, query: req.query, tenantId: res.locals.tenantId });
    res.status(500).json({
      success: false,
      error: `查詢庫存調整記錄時發生錯誤: ${error.message || error}`
    });
  }
};

/**
 * 設置或更新菜單項的庫存水平 (直接操作 menuItems 集合)
 * HTTP 端點: PUT /inventory/items/:itemId/stock-levels/:storeId 
 * Note: itemId here refers to the document ID in the 'menuItems' collection.
 */
export const upsertStockLevel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId, storeId } = req.params; 
    const data: UpsertStockLevelRequest = req.body; // UpsertStockLevelRequest from inventory.types.ts has { quantity, lowStockThreshold?, reason? }
    const tenantId = res.locals.tenantId;
    const userId = res.locals.userId;

    if (!itemId || !storeId) {
      res.status(400).json({ success: false, error: 'itemId 和 storeId 是必要的路徑參數。' });
      return;
    }

    if (data.quantity === undefined || data.quantity === null) {
      res.status(400).json({ success: false, error: 'quantity 是必要的請求內容。' });
      return;
    }
    
    const updatedStockLevelInfo = await stockLevelService.upsertStockLevel_REFACTORED(
      itemId, 
      storeId,
      tenantId,
      data.quantity,
      data.lowStockThreshold,
      userId,
      data.reason || '手動庫存水平設置 (Handler)' // Pass reason from request if available
    );

    res.status(200).json({
      success: true,
      message: '菜單項庫存水平已成功更新。',
      data: updatedStockLevelInfo 
    });

  } catch (error: any) {
    logger.error('更新/設置菜單項庫存水平時發生錯誤:', { error: error.message, params: req.params, body: req.body, tenantId: res.locals.tenantId });
    if (error.message && (error.message.includes('not found') || error.message.includes('找不到'))) {
      res.status(404).json({ success: false, error: error.message });
    } else if (error.message && error.message.includes('mismatch')) {
      res.status(400).json({ success: false, error: error.message });
    }
    else {
      res.status(500).json({
        success: false,
        error: `更新/設置菜單項庫存水平時發生錯誤: ${error.message || error}`
      });
    }
  }
}; 