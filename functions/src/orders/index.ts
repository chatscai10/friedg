import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { 
  createOrder,
  getOrderById,
  queryOrders,
  updateOrderStatus,
  recordOrderPayment,
  getOrderStats,
  getOrderStatusHistory
} from './services/orderService';
import { 
  generateReceipt, 
  getReceiptByOrderId,
  formatReceiptAsHtml 
} from './services/receiptService';
import { OrderStatus, PaymentMethod } from './types';
import { hasPermission, getUserInfoFromClaims } from '../libs/rbac';

// 訂單API區域設置為台灣
const region = 'asia-east1'; // 台灣區域

/**
 * 獲取訂單列表
 */
export const getOrders = functions.region(region).https.onCall(async (data, context) => {
  // 驗證用戶是否已登入
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      '需要登入才能獲取訂單'
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
    // 解析查詢參數
    const { 
      storeId,
      status,
      from,
      to,
      customerId,
      page,
      limit
    } = data;
    
    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'orders' },
      { storeId }
    );
    
    if (!permissionResult.granted) {
      throw new functions.https.HttpsError(
        'permission-denied',
        permissionResult.reason || '您沒有權限查看訂單'
      );
    }
    
    // 執行查詢
    const result = await queryOrders({
      storeId,
      status,
      from,
      to,
      customerId: customerId || (userInfo.role === 'customer' ? userInfo.uid : undefined),
      page,
      limit
    });
    
    return result;
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
 * 獲取訂單詳情
 */
export const getOrder = functions.region(region).https.onCall(async (data, context) => {
  // 驗證用戶是否已登入
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      '需要登入才能獲取訂單詳情'
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
    const { orderId } = data;
    
    if (!orderId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '訂單ID不能為空'
      );
    }
    
    // 獲取訂單
    const order = await getOrderById(orderId);
    
    if (!order) {
      throw new functions.https.HttpsError(
        'not-found',
        '找不到指定的訂單'
      );
    }
    
    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'orders', resourceId: orderId },
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
 * 創建新訂單
 */
export const newOrder = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 解析訂單數據
    const { 
      storeId, 
      items, 
      customerId, 
      customerName,
      customerPhone,
      customerEmail,
      customerTaxId,
      orderType,
      tableNumber,
      estimatedPickupTime,
      specialInstructions,
      discountCode,
      taxIncluded
    } = data;
    
    // 基本驗證
    if (!storeId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '店鋪ID不能為空'
      );
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '訂單項目不能為空'
      );
    }
    
    // 若已登入，獲取用戶ID
    let actualCustomerId = customerId;
    
    if (context.auth) {
      const userInfo = await getUserInfoFromClaims(context.auth.token);
      if (userInfo && userInfo.role === 'customer') {
        actualCustomerId = userInfo.uid;
      }
    }
    
    // 創建訂單
    const order = await createOrder({
      storeId,
      items,
      customerId: actualCustomerId,
      customerName,
      customerPhone,
      customerEmail,
      customerTaxId,
      orderType,
      tableNumber,
      estimatedPickupTime,
      specialInstructions,
      discountCode,
      taxIncluded
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
 * 更新訂單狀態
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
    const { orderId, status, reason } = data;
    
    if (!orderId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '訂單ID不能為空'
      );
    }
    
    if (!status || !Object.values(OrderStatus).includes(status)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '無效的訂單狀態'
      );
    }
    
    // 獲取訂單
    const order = await getOrderById(orderId);
    
    if (!order) {
      throw new functions.https.HttpsError(
        'not-found',
        '找不到指定的訂單'
      );
    }
    
    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'update', resource: 'orders', resourceId: orderId },
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
      orderId,
      status as OrderStatus,
      userInfo.uid,
      userInfo.role,
      reason
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
 * 記錄訂單支付
 */
export const recordPayment = functions.region(region).https.onCall(async (data, context) => {
  // 驗證用戶是否已登入
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      '需要登入才能記錄支付'
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
    const { orderId, paymentMethod, amount, transactionId, notes } = data;
    
    if (!orderId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '訂單ID不能為空'
      );
    }
    
    if (!paymentMethod || !Object.values(PaymentMethod).includes(paymentMethod)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '無效的支付方式'
      );
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '金額必須是大於零的數字'
      );
    }
    
    // 獲取訂單
    const order = await getOrderById(orderId);
    
    if (!order) {
      throw new functions.https.HttpsError(
        'not-found',
        '找不到指定的訂單'
      );
    }
    
    // 權限檢查 - 只有店員或管理員可以記錄支付
    if (userInfo.role === 'customer') {
      throw new functions.https.HttpsError(
        'permission-denied',
        '顧客無法記錄支付'
      );
    }
    
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'update', resource: 'orders', resourceId: orderId },
      { storeId: order.storeId, tenantId: order.tenantId }
    );
    
    if (!permissionResult.granted) {
      throw new functions.https.HttpsError(
        'permission-denied',
        permissionResult.reason || '您沒有權限記錄此訂單的支付'
      );
    }
    
    // 記錄支付
    const updatedOrder = await recordOrderPayment(
      orderId,
      paymentMethod as PaymentMethod,
      amount,
      userInfo.uid,
      userInfo.role,
      transactionId,
      notes
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
      `記錄支付失敗: ${errorMessage}`
    );
  }
});

/**
 * 獲取訂單統計數據
 */
export const getOrderStatistics = functions.region(region).https.onCall(async (data, context) => {
  // 驗證用戶是否已登入
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      '需要登入才能獲取統計數據'
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
    const { storeId, from, to, groupBy } = data;
    
    // 權限檢查 - 只有店長以上的角色才能查看統計數據
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'orders' },
      { storeId }
    );
    
    if (!permissionResult.granted) {
      throw new functions.https.HttpsError(
        'permission-denied',
        permissionResult.reason || '您沒有權限查看訂單統計數據'
      );
    }
    
    // 獲取統計數據
    const stats = await getOrderStats(
      storeId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      groupBy
    );
    
    return stats;
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
 * 生成訂單收據
 */
export const generateOrderReceipt = functions.region(region).https.onCall(async (data, context) => {
  // 驗證用戶是否已登入
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      '需要登入才能生成收據'
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
    const { orderId } = data;
    
    if (!orderId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '訂單ID不能為空'
      );
    }
    
    // 獲取訂單
    const order = await getOrderById(orderId);
    
    if (!order) {
      throw new functions.https.HttpsError(
        'not-found',
        '找不到指定的訂單'
      );
    }
    
    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'orders', resourceId: orderId },
      { storeId: order.storeId, tenantId: order.tenantId }
    );
    
    if (!permissionResult.granted) {
      throw new functions.https.HttpsError(
        'permission-denied',
        permissionResult.reason || '您沒有權限生成此訂單的收據'
      );
    }
    
    // 檢查訂單是否已支付
    if (order.paymentStatus !== 'paid') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        '只能為已支付的訂單生成收據'
      );
    }
    
    // 生成收據
    const receipt = await generateReceipt(orderId);
    
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
      `生成收據失敗: ${errorMessage}`
    );
  }
});

/**
 * 獲取訂單收據
 */
export const getOrderReceipt = functions.region(region).https.onRequest(async (req, res) => {
  try {
    const orderId = req.query.orderId as string;
    const format = (req.query.format as string) || 'json';
    
    if (!orderId) {
      res.status(400).json({ error: '訂單ID不能為空' });
      return;
    }
    
    // 驗證請求Token (簡化實現，實際應該使用JWT驗證)
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    
    if (!idToken) {
      res.status(401).json({ error: '未授權訪問' });
      return;
    }
    
    try {
      // 驗證Token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      // 獲取用戶信息
      const userInfo = await getUserInfoFromClaims(decodedToken);
      
      if (!userInfo) {
        res.status(403).json({ error: '無法獲取用戶權限資訊' });
        return;
      }
      
      // 獲取訂單
      const order = await getOrderById(orderId);
      
      if (!order) {
        res.status(404).json({ error: '找不到指定的訂單' });
        return;
      }
      
      // 權限檢查
      const permissionResult = await hasPermission(
        userInfo,
        { action: 'read', resource: 'orders', resourceId: orderId },
        { storeId: order.storeId, tenantId: order.tenantId }
      );
      
      if (!permissionResult.granted) {
        res.status(403).json({
          error: permissionResult.reason || '您沒有權限查看此訂單的收據'
        });
        return;
      }
      
      // 獲取收據
      const receipt = await getReceiptByOrderId(orderId);
      
      if (!receipt) {
        // 如果收據不存在，嘗試生成
        if (order.paymentStatus === 'paid') {
          const newReceipt = await generateReceipt(orderId);
          
          // 根據請求的格式返回收據
          switch (format) {
            case 'html':
              res.set('Content-Type', 'text/html');
              res.send(formatReceiptAsHtml(newReceipt));
              break;
            case 'pdf':
              // PDF生成功能需要額外實現
              res.status(501).json({ error: 'PDF格式暫未支持' });
              break;
            case 'json':
            default:
              res.json(newReceipt);
              break;
          }
        } else {
          res.status(422).json({ error: '無法生成收據，訂單未支付' });
        }
        return;
      }
      
      // 根據請求的格式返回收據
      switch (format) {
        case 'html':
          res.set('Content-Type', 'text/html');
          res.send(formatReceiptAsHtml(receipt));
          break;
        case 'pdf':
          // PDF生成功能需要額外實現
          res.status(501).json({ error: 'PDF格式暫未支持' });
          break;
        case 'json':
        default:
          res.json(receipt);
          break;
      }
    } catch (verifyError) {
      res.status(401).json({ error: '無效的認證Token' });
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
    
    console.error('獲取收據錯誤:', error);
    res.status(500).json({ error: `獲取收據失敗: ${errorMessage}` });
  }
});

/**
 * 獲取訂單狀態歷史
 */
export const getOrderHistory = functions.region(region).https.onCall(async (data, context) => {
  // 驗證用戶是否已登入
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      '需要登入才能獲取訂單狀態歷史'
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
    const { orderId } = data;
    
    if (!orderId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '訂單ID不能為空'
      );
    }
    
    // 獲取訂單
    const order = await getOrderById(orderId);
    
    if (!order) {
      throw new functions.https.HttpsError(
        'not-found',
        '找不到指定的訂單'
      );
    }
    
    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'orders', resourceId: orderId },
      { storeId: order.storeId, tenantId: order.tenantId }
    );
    
    if (!permissionResult.granted) {
      throw new functions.https.HttpsError(
        'permission-denied',
        permissionResult.reason || '您沒有權限查看此訂單歷史'
      );
    }
    
    // 獲取訂單狀態歷史
    const history = await getOrderStatusHistory(order.tenantId, orderId);
    
    return history;
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
      `獲取訂單狀態歷史失敗: ${errorMessage}`
    );
  }
}); 