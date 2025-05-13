/**
 * 訂單管理API
 * 標準化修復版本，統一使用新版Firebase Functions API
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getUserInfoFromClaims } from '../libs/rbac';
import { hasPermission } from '../libs/rbac/core/permission';
import { 
  createOrder, 
  getOrderById, 
  getOrdersByUserId,
  updateOrderStatus,
  recordOrderPayment,
  getOrderStatisticsByPeriod,
  getOrdersByStore,
  generateOrderReceiptById
} from './services/order.service';
import { OrderStatus } from './types';
import { validateData } from '../libs/validation/schema';
import {
  OrderQuerySchema,
  OrderDetailsSchema,
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  RecordOrderPaymentSchema,
  OrderStatisticsQuerySchema,
  GenerateReceiptSchema,
  OrderHistoryQuerySchema
} from './schemas/order.schema';

// 設定函數區域
const region = 'asia-east1';

/**
 * 獲取訂單列表 - 標準化API簽名
 */
export const getOrders = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 驗證用戶是否已登入
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '需要登入才能查看訂單列表'
      );
    }
    
    // 獲取用戶資訊
    const userInfo = await getUserInfoFromClaims(context.auth.token);
    
    if (!userInfo) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無法獲取用戶權限資訊'
      );
    }
    
    // 驗證並轉換請求參數
    const validatedData = validateData(data, OrderQuerySchema);
    
    // 根據用戶角色處理
    if (userInfo.role === 'customer') {
      // 顧客只能查看自己的訂單
      const orders = await getOrdersByUserId(userInfo.uid, validatedData);
      
      return orders;
    } else {
      // 店員、店長等查看店鋪訂單
      if (!validatedData.storeId) {
        // 如果沒提供店鋪ID，使用用戶的主要店鋪
        if (!userInfo.storeId) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            '缺少店鋪ID參數，且用戶未關聯主要店鋪'
          );
        }
        
        validatedData.storeId = userInfo.storeId;
      }
      
      // 權限檢查
      const permissionResult = await hasPermission(
        userInfo,
        { action: 'read', resource: 'orders' },
        { storeId: validatedData.storeId, tenantId: userInfo.tenantId }
      );
      
      if (!permissionResult.granted) {
        throw new functions.https.HttpsError(
          'permission-denied',
          permissionResult.reason || '您沒有權限查看此店鋪的訂單'
        );
      }
      
      // 獲取訂單
      const orders = await getOrdersByStore(validatedData.storeId, validatedData);
      
      return orders;
    }
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `獲取訂單列表失敗: ${errorMessage}`
    );
  }
});

/**
 * 獲取訂單詳情 - 標準化API簽名
 */
export const getOrder = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 驗證參數
    const validatedData = validateData(data, OrderDetailsSchema);
    
    // 獲取訂單
    const order = await getOrderById(validatedData.orderId);
    
    if (!order) {
      throw new functions.https.HttpsError(
        'not-found',
        '找不到指定的訂單'
      );
    }
    
    // 權限檢查
    // 未登入的匿名用戶只能查看自己創建的未付款訂單
    if (!context.auth) {
      // 檢查是否為未付款的匿名訂單
      if (order.customerId || order.status !== 'pending') {
        throw new functions.https.HttpsError(
          'permission-denied',
          '需要登入才能查看此訂單'
        );
      }
      
      // 暫時先放行匿名訂單查詢，後續可添加訂單token驗證
      return order;
    }
    
    // 已登入用戶的權限檢查
    const userInfo = await getUserInfoFromClaims(context.auth.token);
    
    if (!userInfo) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無法獲取用戶權限資訊'
      );
    }
    
    // 顧客只能查看自己的訂單
    if (userInfo.role === 'customer' && order.customerId !== userInfo.uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '您沒有權限查看此訂單'
      );
    }
    
    // 店員、店長等需要進行權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'orders', resourceId: validatedData.orderId },
      { storeId: order.storeId, tenantId: order.tenantId }
    );
    
    if (!permissionResult.granted) {
      throw new functions.https.HttpsError(
        'permission-denied',
        permissionResult.reason || '您沒有權限查看此訂單'
      );
    }
    
    return order;
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `獲取訂單詳情失敗: ${errorMessage}`
    );
  }
});

/**
 * 創建新訂單 - 標準化API簽名
 */
export const newOrder = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 驗證並轉換請求資料
    const validatedData = validateData(data, CreateOrderSchema);
    
    // 若已登入，獲取用戶ID
    let actualCustomerId = validatedData.customerId;
    
    if (context.auth) {
      const userInfo = await getUserInfoFromClaims(context.auth.token);
      if (userInfo && userInfo.role === 'customer') {
        actualCustomerId = userInfo.uid;
      }
    }
    
    // 創建訂單
    const order = await createOrder({
      ...validatedData,
      customerId: actualCustomerId
    });
    
    return order;
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `創建訂單失敗: ${errorMessage}`
    );
  }
});

/**
 * 更新訂單狀態 - 標準化API簽名
 */
export const updateStatus = functions.region(region).https.onCall(async (data, context) => {
  // 驗證用戶是否已登入
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      '需要登入才能更新訂單狀態'
    );
  }
  
  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(context.auth.token);
  
  if (!userInfo) {
    throw new functions.https.HttpsError(
      'permission-denied',
      '無法獲取用戶權限資訊'
    );
  }
  
  try {
    // 驗證並轉換請求資料
    const validatedData = validateData(data, UpdateOrderStatusSchema);
    
    // 獲取訂單
    const order = await getOrderById(validatedData.orderId);
    
    if (!order) {
      throw new functions.https.HttpsError(
        'not-found',
        '找不到指定的訂單'
      );
    }
    
    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'update', resource: 'orders', resourceId: validatedData.orderId },
      { storeId: order.storeId, tenantId: order.tenantId }
    );
    
    if (!permissionResult.granted) {
      throw new functions.https.HttpsError(
        'permission-denied',
        permissionResult.reason || '您沒有權限更新此訂單'
      );
    }
    
    // 更新訂單狀態
    const updatedOrder = await updateOrderStatus(
      validatedData.orderId,
      validatedData.status as OrderStatus,
      userInfo.uid,
      userInfo.role,
      validatedData.reason
    );
    
    return updatedOrder;
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `更新訂單狀態失敗: ${errorMessage}`
    );
  }
});

/**
 * 記錄訂單支付 - 標準化API簽名
 */
export const recordPayment = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 驗證並轉換請求資料
    const validatedData = validateData(data, RecordOrderPaymentSchema);
    
    // 獲取訂單
    const order = await getOrderById(validatedData.orderId);
    
    if (!order) {
      throw new functions.https.HttpsError(
        'not-found',
        '找不到指定的訂單'
      );
    }
    
    // 若已登入，進行權限檢查
    if (context.auth) {
      const userInfo = await getUserInfoFromClaims(context.auth.token);
      
      if (userInfo) {
        // 檢查顧客是否為訂單擁有者
        if (userInfo.role === 'customer' && order.customerId !== userInfo.uid) {
          throw new functions.https.HttpsError(
            'permission-denied',
            '您沒有權限支付此訂單'
          );
        }
        
        // 店員等需要進行權限檢查
        if (userInfo.role !== 'customer') {
          const permissionResult = await hasPermission(
            userInfo,
            { action: 'update', resource: 'orders', resourceId: validatedData.orderId },
            { storeId: order.storeId, tenantId: order.tenantId }
          );
          
          if (!permissionResult.granted) {
            throw new functions.https.HttpsError(
              'permission-denied',
              permissionResult.reason || '您沒有權限處理此訂單支付'
            );
          }
        }
      }
    }
    
    // 處理訂單支付
    const paymentRecord = await recordOrderPayment({
      ...validatedData,
      processedBy: context.auth?.uid || 'anonymous'
    });
    
    return paymentRecord;
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `記錄訂單支付失敗: ${errorMessage}`
    );
  }
});

/**
 * 獲取訂單統計數據 - 標準化API簽名
 */
export const getOrderStatistics = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 驗證用戶是否已登入
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '需要登入才能查看訂單統計數據'
      );
    }
    
    // 獲取用戶資訊
    const userInfo = await getUserInfoFromClaims(context.auth.token);
    
    if (!userInfo) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無法獲取用戶權限資訊'
      );
    }
    
    // 驗證並轉換請求資料
    const validatedData = validateData(data, OrderStatisticsQuerySchema);
    
    let targetStoreId = validatedData.storeId;
    
    // 若未提供店鋪ID，使用用戶關聯的店鋪
    if (!targetStoreId && userInfo.storeId) {
      targetStoreId = userInfo.storeId;
    }
    
    // 店長以上級別才能查看統計數據
    if (userInfo.role !== 'super_admin' && userInfo.role !== 'tenant_admin' && userInfo.role !== 'store_manager') {
      throw new functions.https.HttpsError(
        'permission-denied',
        '您沒有權限查看訂單統計數據'
      );
    }
    
    // 權限檢查
    if (targetStoreId) {
      // 檢查用戶是否有訪問此店鋪的權限
      if (userInfo.role === 'store_manager') {
        const canAccess = targetStoreId === userInfo.storeId || 
                         (userInfo.additionalStoreIds && userInfo.additionalStoreIds.includes(targetStoreId));
        
        if (!canAccess) {
          throw new functions.https.HttpsError(
            'permission-denied',
            '您沒有權限查看此店鋪的訂單統計數據'
          );
        }
      }
    }
    
    // 獲取統計數據
    const statistics = await getOrderStatisticsByPeriod({
      storeId: targetStoreId,
      tenantId: userInfo.tenantId,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
      groupBy: validatedData.groupBy
    });
    
    return statistics;
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `獲取訂單統計數據失敗: ${errorMessage}`
    );
  }
});

/**
 * 產生訂單收據 - 標準化API簽名
 */
export const generateOrderReceipt = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 驗證並轉換請求資料
    const validatedData = validateData(data, GenerateReceiptSchema);
    
    // 獲取訂單
    const order = await getOrderById(validatedData.orderId);
    
    if (!order) {
      throw new functions.https.HttpsError(
        'not-found',
        '找不到指定的訂單'
      );
    }
    
    // 權限檢查
    if (context.auth) {
      const userInfo = await getUserInfoFromClaims(context.auth.token);
      
      if (userInfo) {
        // 檢查顧客是否為訂單擁有者
        if (userInfo.role === 'customer' && order.customerId !== userInfo.uid) {
          throw new functions.https.HttpsError(
            'permission-denied',
            '您沒有權限查看此訂單收據'
          );
        }
        
        // 店員等需要進行權限檢查
        if (userInfo.role !== 'customer') {
          const permissionResult = await hasPermission(
            userInfo,
            { action: 'read', resource: 'orders', resourceId: validatedData.orderId },
            { storeId: order.storeId, tenantId: order.tenantId }
          );
          
          if (!permissionResult.granted) {
            throw new functions.https.HttpsError(
              'permission-denied',
              permissionResult.reason || '您沒有權限查看此訂單收據'
            );
          }
        }
      }
    } else if (order.customerId) {
      // 匿名訪問限制：僅允許查看未關聯客戶的訂單
      throw new functions.https.HttpsError(
        'permission-denied',
        '需要登入才能查看此訂單收據'
      );
    }
    
    // 生成收據
    const receipt = await generateOrderReceiptById(validatedData.orderId, validatedData.format);
    
    return receipt;
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `生成訂單收據失敗: ${errorMessage}`
    );
  }
});

/**
 * 獲取訂單收據 - HTTP請求版本（用於打印或下載）
 */
export const getOrderReceipt = functions.region(region).https.onRequest(async (req, res) => {
  try {
    const orderId = req.query.orderId as string;
    const format = (req.query.format as string) || 'html';
    const token = req.query.token as string;
    
    if (!orderId) {
      res.status(400).send('訂單ID不能為空');
      return;
    }
    
    // 獲取訂單
    const order = await getOrderById(orderId);
    
    if (!order) {
      res.status(404).send('找不到指定的訂單');
      return;
    }
    
    // 簡單的訪問令牌驗證（用於匿名訪問）
    // 在實際生產環境中應使用更安全的方法
    if (!token && order.customerId) {
      res.status(401).send('需要訪問令牌才能查看此訂單收據');
      return;
    }
    
    // 生成收據
    const receipt = await generateOrderReceiptById(orderId, format);
    
    // 根據格式類型設置Content-Type
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="receipt-${orderId}.pdf"`);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
    } else {
      res.setHeader('Content-Type', 'text/html');
    }
    
    res.send(receipt);
  } catch (error) {
    console.error('獲取訂單收據失敗:', error);
    res.status(500).send(`獲取訂單收據失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
  }
});

/**
 * 獲取用戶的訂單歷史 - 標準化API簽名
 */
export const getOrderHistory = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 驗證用戶是否已登入
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '需要登入才能查看訂單歷史'
      );
    }
    
    // 獲取用戶資訊
    const userInfo = await getUserInfoFromClaims(context.auth.token);
    
    if (!userInfo) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無法獲取用戶權限資訊'
      );
    }
    
    // 驗證並轉換請求資料
    const validatedData = validateData(data, OrderHistoryQuerySchema);
    
    // 如果指定了用戶ID且不是自己，檢查權限
    if (validatedData.userId && validatedData.userId !== userInfo.uid) {
      // 只有管理員角色可以查看其他用戶的訂單歷史
      if (userInfo.role !== 'super_admin' && userInfo.role !== 'tenant_admin' && userInfo.role !== 'store_manager') {
        throw new functions.https.HttpsError(
          'permission-denied',
          '您沒有權限查看其他用戶的訂單歷史'
        );
      }
    }
    
    // 獲取訂單歷史
    const orders = await getOrdersByUserId(validatedData.userId || userInfo.uid, {
      limit: validatedData.limit,
      offset: validatedData.offset,
      sortField: 'createdAt',
      sortDirection: 'desc'
    });
    
    return orders;
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `獲取訂單歷史失敗: ${errorMessage}`
    );
  }
}); 