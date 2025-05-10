import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import * as functions from 'firebase-functions';

// 導入訂單驗證模式和服務函數
import { CreateOrderSchema, CreateOrderInput, ListOrdersQuerySchema } from './orders.validators';
import { createOrderWithTransaction, listOrders, getOrderById } from './orders.service';
import { OrderInput } from './types';

const logger = functions.logger;

/**
 * 處理創建新訂單請求
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const createOrderHandler = async (req: Request, res: Response): Promise<Response> => {
  logger.info('處理創建訂單請求', { structuredData: true });
  
  try {
    // 1. 獲取當前用戶信息（透過認證中間件注入）
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    if (!user || !user.uid) {
      logger.error('創建訂單失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }
    
    // 2. 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('創建訂單失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }
    
    // 3. 驗證請求數據
    const validationResult = CreateOrderSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      logger.error('創建訂單失敗: 驗證錯誤', { errors: errorMessage });
      
      return res.status(400).json({
        success: false,
        message: '請求數據驗證失敗',
        errors: validationResult.error.format(),
      });
    }
    
    // 將驗證後的數據作為OrderInput處理
    const validatedData = validationResult.data as unknown as OrderInput;
    
    logger.info('訂單數據驗證成功，準備創建訂單', { 
      storeId: validatedData.storeId,
      tenantId: user.tenantId,
      itemCount: validatedData.items.length
    });
    
    // 4. 調用服務函數創建訂單
    const newOrder = await createOrderWithTransaction(
      validatedData,
      user.tenantId,
      user.uid
    );
    
    logger.info('訂單創建成功', { 
      orderId: newOrder.id, 
      orderNumber: newOrder.orderNumber,
      tenantId: user.tenantId,
      storeId: validatedData.storeId
    });
    
    // 5. 返回成功響應
    return res.status(201).json({
      success: true,
      message: '訂單創建成功',
      data: newOrder,
    });
    
  } catch (error) {
    // 6. 捕獲並處理各種錯誤類型
    logger.error('創建訂單時發生錯誤', { 
      error: error instanceof Error ? error.message : '未知錯誤',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // 根據錯誤類型返回適當的HTTP狀態碼
    if (error instanceof Error) {
      const errorMessage = error.message;
      
      // 處理不同類型的業務邏輯錯誤
      if (errorMessage.includes('店鋪不存在')) {
        return res.status(404).json({
          success: false,
          message: errorMessage,
        });
      } else if (errorMessage.includes('菜單項不存在')) {
        return res.status(404).json({
          success: false,
          message: errorMessage,
        });
      } else if (errorMessage.includes('庫存不足')) {
        return res.status(400).json({
          success: false,
          message: errorMessage,
        });
      }
    }
    
    // 默認返回500錯誤
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
};

/**
 * 處理獲取訂單列表請求
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const listOrdersHandler = async (req: Request, res: Response): Promise<Response> => {
  logger.info('處理獲取訂單列表請求', { structuredData: true });
  
  try {
    // 1. 獲取當前用戶信息（透過認證中間件注入）
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    if (!user || !user.uid) {
      logger.error('獲取訂單列表失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }
    
    // 2. 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('獲取訂單列表失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }
    
    // 3. 驗證查詢參數
    const validationResult = ListOrdersQuerySchema.safeParse(req.query);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      logger.error('獲取訂單列表失敗: 查詢參數驗證錯誤', { errors: errorMessage });
      
      return res.status(400).json({
        success: false,
        message: '查詢參數驗證失敗',
        errors: validationResult.error.format(),
      });
    }
    
    const queryParams = validationResult.data;
    logger.info('訂單查詢參數驗證成功', queryParams);
    
    // 4. 處理 startAfter 分頁參數（如果有）
    let startAfterDoc = undefined;
    if (queryParams.startAfter) {
      try {
        // 獲取指定ID的訂單文檔作為startAfter的參考點
        const startAfterRef = admin.firestore().collection('orders').doc(queryParams.startAfter);
        const startAfterSnapshot = await startAfterRef.get();
        
        if (startAfterSnapshot.exists) {
          startAfterDoc = startAfterSnapshot;
        } else {
          logger.warn('分頁參考文檔不存在', { docId: queryParams.startAfter });
          // 如果文檔不存在，我們就不設置startAfter，相當於從頭開始查詢
        }
      } catch (err) {
        logger.warn('獲取分頁參考文檔失敗', { 
          docId: queryParams.startAfter, 
          error: err instanceof Error ? err.message : '未知錯誤' 
        });
        // 出錯時不設置startAfter，相當於從頭開始查詢
      }
    }
    
    // 5. 調用服務函數獲取訂單列表
    const { orders, total, lastVisible } = await listOrders(user.tenantId, {
      ...queryParams,
      startAfter: startAfterDoc // 如果獲取成功，使用文檔引用；否則為undefined
    });
    
    // 6. 轉換 lastVisible 為客戶端可用的格式
    const lastVisibleId = lastVisible ? lastVisible.id : null;
    
    logger.info('訂單列表獲取成功', { 
      count: orders.length,
      total,
      hasMore: lastVisibleId !== null,
      tenantId: user.tenantId
    });
    
    // 7. 返回成功響應
    return res.status(200).json({
      success: true,
      data: {
        orders,
        total,
        lastVisible: lastVisibleId // 只返回ID，而不是整個Firestore文檔引用
      },
    });
    
  } catch (error) {
    logger.error('獲取訂單列表時發生錯誤', { 
      error: error instanceof Error ? error.message : '未知錯誤',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
};

/**
 * 處理根據ID獲取單個訂單請求
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const getOrderByIdHandler = async (req: Request, res: Response): Promise<Response> => {
  logger.info('處理獲取單個訂單請求', { orderId: req.params.orderId, structuredData: true });
  
  try {
    // 1. 獲取當前用戶信息（透過認證中間件注入）
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    if (!user || !user.uid) {
      logger.error('獲取訂單詳情失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }
    
    // 2. 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('獲取訂單詳情失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }
    
    // 3. 獲取並驗證訂單ID
    const { orderId } = req.params;
    
    if (!orderId || typeof orderId !== 'string') {
      logger.error('獲取訂單詳情失敗: 缺少有效的訂單ID');
      return res.status(400).json({
        success: false,
        message: '請提供有效的訂單ID',
      });
    }
    
    // 4. 調用服務函數獲取訂單詳情
    const order = await getOrderById(user.tenantId, orderId);
    
    // 5. 檢查訂單是否存在
    if (!order) {
      logger.warn('訂單未找到或無權訪問', { orderId, tenantId: user.tenantId });
      return res.status(404).json({
        success: false,
        message: '訂單未找到或您無權訪問此訂單',
      });
    }
    
    logger.info('訂單詳情獲取成功', { orderId, tenantId: user.tenantId });
    
    // 6. 返回成功響應
    return res.status(200).json({
      success: true,
      data: order,
    });
    
  } catch (error) {
    logger.error('獲取訂單詳情時發生錯誤', { 
      error: error instanceof Error ? error.message : '未知錯誤',
      stack: error instanceof Error ? error.stack : undefined,
      orderId: req.params.orderId
    });
    
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
}; 