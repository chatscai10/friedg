/**
 * 訂單模塊 - Gen 2 版本
 * 使用 Firebase Functions v2 API
 */

import { onCall } from 'firebase-functions/v2/https';
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

// 設定區域和其他配置
const region = 'asia-east1'; // 台灣區域
const runtimeOptions = {
  memory: '256MiB' as const,
  timeoutSeconds: 60
};

/**
 * 獲取訂單列表
 */
export const getOrders = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能獲取訂單');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
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
    } = request.data;

    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'orders' },
      { storeId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限查看訂單');
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

    throw new Error(`獲取訂單列表失敗: ${errorMessage}`);
  }
});

/**
 * 獲取訂單詳情
 */
export const getOrder = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能獲取訂單詳情');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
  }

  try {
    const { orderId } = request.data;

    if (!orderId) {
      throw new Error('訂單ID不能為空');
    }

    // 獲取訂單
    const order = await getOrderById(orderId);

    if (!order) {
      throw new Error('找不到指定的訂單');
    }

    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'orders', resourceId: orderId },
      { storeId: order.storeId, tenantId: order.tenantId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限查看此訂單');
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

    throw new Error(`獲取訂單詳情失敗: ${errorMessage}`);
  }
});

/**
 * 創建新訂單
 */
export const newOrder = onCall({ region, ...runtimeOptions }, async (request) => {
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
    } = request.data;

    // 基本驗證
    if (!storeId) {
      throw new Error('店鋪ID不能為空');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('訂單項目不能為空');
    }

    // 若已登入，獲取用戶ID
    let actualCustomerId = customerId;

    if (request.auth) {
      const userInfo = await getUserInfoFromClaims(request.auth.token);
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

    throw new Error(`創建訂單失敗: ${errorMessage}`);
  }
});

/**
 * 更新訂單狀態
 */
export const updateStatus = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能更新訂單狀態');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
  }

  try {
    const { orderId, status, reason } = request.data;

    if (!orderId) {
      throw new Error('訂單ID不能為空');
    }

    if (!status || !Object.values(OrderStatus).includes(status)) {
      throw new Error('無效的訂單狀態');
    }

    // 獲取訂單
    const order = await getOrderById(orderId);

    if (!order) {
      throw new Error('找不到指定的訂單');
    }

    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'update', resource: 'orders', resourceId: orderId },
      { storeId: order.storeId, tenantId: order.tenantId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限更新此訂單');
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

    throw new Error(`更新訂單狀態失敗: ${errorMessage}`);
  }
});

/**
 * 記錄訂單支付
 */
export const recordPayment = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能記錄支付');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
  }

  try {
    const { orderId, paymentMethod, amount, transactionId, notes } = request.data;

    if (!orderId) {
      throw new Error('訂單ID不能為空');
    }

    if (!paymentMethod || !Object.values(PaymentMethod).includes(paymentMethod)) {
      throw new Error('無效的支付方式');
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('金額必須是大於零的數字');
    }

    // 獲取訂單
    const order = await getOrderById(orderId);

    if (!order) {
      throw new Error('找不到指定的訂單');
    }

    // 權限檢查 - 只有店員或管理員可以記錄支付
    if (userInfo.role === 'customer') {
      throw new Error('顧客無法記錄支付');
    }

    const permissionResult = await hasPermission(
      userInfo,
      { action: 'update', resource: 'orders', resourceId: orderId },
      { storeId: order.storeId, tenantId: order.tenantId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限記錄此訂單的支付');
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

    throw new Error(`記錄支付失敗: ${errorMessage}`);
  }
});

/**
 * 獲取訂單統計數據
 */
export const getOrderStatistics = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能獲取統計數據');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
  }

  try {
    const { storeId, from, to, groupBy } = request.data;

    // 權限檢查 - 只有店長以上的角色才能查看統計數據
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'orders' },
      { storeId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限查看訂單統計數據');
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

    throw new Error(`獲取訂單統計數據失敗: ${errorMessage}`);
  }
});

/**
 * 生成訂單收據
 */
export const generateOrderReceipt = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能生成收據');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
  }

  try {
    const { orderId } = request.data;

    if (!orderId) {
      throw new Error('訂單ID不能為空');
    }

    // 獲取訂單
    const order = await getOrderById(orderId);

    if (!order) {
      throw new Error('找不到指定的訂單');
    }

    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'orders', resourceId: orderId },
      { storeId: order.storeId, tenantId: order.tenantId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限生成此訂單的收據');
    }

    // 檢查訂單是否已支付
    if (order.paymentStatus !== 'paid') {
      throw new Error('只能為已支付的訂單生成收據');
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

    throw new Error(`生成收據失敗: ${errorMessage}`);
  }
});

/**
 * 獲取訂單狀態歷史
 */
export const getOrderHistory = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能獲取訂單狀態歷史');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
  }

  try {
    const { orderId } = request.data;

    if (!orderId) {
      throw new Error('訂單ID不能為空');
    }

    // 獲取訂單
    const order = await getOrderById(orderId);

    if (!order) {
      throw new Error('找不到指定的訂單');
    }

    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'orders', resourceId: orderId },
      { storeId: order.storeId, tenantId: order.tenantId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限查看此訂單歷史');
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

    throw new Error(`獲取訂單狀態歷史失敗: ${errorMessage}`);
  }
});
