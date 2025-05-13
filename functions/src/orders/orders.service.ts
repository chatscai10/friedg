import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Order, OrderInput, OrderStatus, OrderItem, PaymentStatus, OrderItemOption } from './types';
import { v4 as uuidv4 } from 'uuid';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 確保 Firebase Admin 已初始化 - 不應在此初始化，應使用 index.ts 中初始化的實例
 */
// try {
//   admin.app();
// } catch (error) {
//   admin.initializeApp({
//     projectId: 'friedg', // 使用你的 Firebase 項目 ID
//   });
//   console.log('Firebase 在 orders.service 中初始化成功');
// }

/**
 * 訂單服務: 處理訂單相關業務邏輯
 */

const db = admin.firestore();
const logger = functions.logger;

/**
 * 生成訂單編號
 * 格式: 店鋪ID前兩碼 + YYMMDD + 流水號(4位)
 * 使用 Firestore 事務確保流水號的唯一性和有序性
 * @param storeId 店鋪ID
 * @returns 格式化的訂單編號
 */
export async function generateOrderNumber(storeId: string): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(2); // 取年份後兩位
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 月份（補零）
  const day = now.getDate().toString().padStart(2, '0'); // 日（補零）
  const dateStr = `${year}${month}${day}`;
  
  // 取店鋪ID前兩個字符，轉大寫
  const prefix = storeId.substring(0, 2).toUpperCase();
  
  // 使用 Firestore 事務來獲取並更新計數器
  const counterRef = db.collection('counters').doc(`${storeId}_${dateStr}`);
  
  return await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);
    let count = 1;
    
    if (doc.exists) {
      count = doc.data()!.count + 1;
    }
    
    transaction.set(counterRef, { count }, { merge: true });
    return `${prefix}${dateStr}${count.toString().padStart(4, '0')}`;
  });
}

/**
 * 使用事務創建訂單
 * 確保在一個原子操作中完成訂單創建和庫存更新
 * @param orderInput 訂單輸入數據
 * @param tenantId 租戶ID
 * @param userId 用戶ID
 * @returns 創建的訂單對象
 */
export async function createOrderWithTransaction(
  orderInput: OrderInput, 
  tenantId: string, 
  userId: string
): Promise<Order> {
  // 使用事務確保數據一致性
  return await db.runTransaction(async (transaction) => {
    const { storeId, items } = orderInput;
    
    // 檢查店鋪是否存在
    const storeRef = db.collection('stores').doc(storeId);
    const storeDoc = await transaction.get(storeRef);
    
    if (!storeDoc.exists) {
      throw new Error(`店鋪不存在: ${storeId}`);
    }
    
    const storeData = storeDoc.data()!;
    
    // 處理訂單項目並檢查庫存
    const orderItems: OrderItem[] = [];
    let subtotal = 0;
    
    // 遍歷訂單項目
    for (const item of items) {
      const { menuItemId, quantity, unitPrice, options = [], specialInstructions } = item;
      
      // 檢查菜單項是否存在並檢查庫存
      const menuItemRef = db.collection('menuItems').doc(menuItemId);
      const menuItemDoc = await transaction.get(menuItemRef);
      
      if (!menuItemDoc.exists) {
        throw new Error(`菜單項不存在: ${menuItemId}`);
      }
      
      const menuItemData = menuItemDoc.data()!;
      
      // 檢查庫存是否充足
      if (menuItemData.stock !== undefined && menuItemData.stock < quantity) {
        throw new Error(`商品 ${menuItemData.name} 庫存不足，剩餘: ${menuItemData.stock}，需要: ${quantity}`);
      }
      
      // 處理選項及其額外價格
      let optionsTotal = 0;
      const processedOptions: OrderItemOption[] = [];
      
      if (options && options.length > 0) {
        for (const option of options) {
          const { optionId, value, additionalPrice = 0 } = option;
          
          optionsTotal += additionalPrice;
          processedOptions.push({
            optionId,
            optionName: menuItemData.options?.find(opt => opt.id === optionId)?.name || 'Unknown Option',
            value,
            additionalPrice
          });
        }
      }
      
      // 計算項目總價
      const itemTotal = quantity * unitPrice + optionsTotal;
      subtotal += itemTotal;
      
      // 添加到訂單項目列表
      orderItems.push({
        id: uuidv4(),
        menuItemId,
        menuItemName: menuItemData.name,
        menuItemImage: menuItemData.imageUrl || '',
        quantity,
        unitPrice,
        totalPrice: itemTotal,
        specialInstructions: specialInstructions || '',
        options: processedOptions
      });
    }
    
    // 生成訂單編號
    const orderNumber = await generateOrderNumber(storeId);
    
    // 計算稅金和總價
    const taxRate = storeData.taxRate || 0.05; // 預設 5% 稅率
    const taxIncluded = orderInput.taxIncluded !== false;
    
    let taxAmount;
    let totalAmount;
    
    if (taxIncluded) {
      // 稅金已包含在價格中
      taxAmount = subtotal - (subtotal / (1 + taxRate));
      totalAmount = subtotal;
    } else {
      // 稅金需要額外計算
      taxAmount = subtotal * taxRate;
      totalAmount = subtotal + taxAmount;
    }
    
    // 處理折扣
    let discountAmount = 0;
    if (orderInput.discountCode) {
      // 實際環境中需查詢折扣碼並計算折扣金額
      // 此處暫不實現詳細邏輯
    }
    
    // 計算最終總價
    totalAmount = totalAmount - discountAmount;
    
    // 創建訂單對象
    const orderId = uuidv4();
    
    const newOrder: Order = {
      id: orderId,
      orderNumber,
      storeId,
      storeName: storeData.name,
      tenantId,
      
      customerId: orderInput.customerId || userId,
      customerName: orderInput.customerName || '',
      customerPhone: orderInput.customerPhone || '',
      customerEmail: orderInput.customerEmail || '',
      customerTaxId: orderInput.customerTaxId,
      
      status: OrderStatus.PENDING,
      orderType: orderInput.orderType || 'takeout',
      tableNumber: orderInput.tableNumber || '',
      estimatedPickupTime: orderInput.estimatedPickupTime ? new Date(orderInput.estimatedPickupTime) : null,
      actualPickupTime: null,
      specialInstructions: orderInput.specialInstructions || '',
      
      items: orderItems,
      subtotal,
      taxAmount,
      taxIncluded,
      discountAmount,
      discountCode: orderInput.discountCode || '',
      tipAmount: 0,
      totalAmount,
      
      paymentStatus: PaymentStatus.UNPAID,
      paymentMethod: null,
      paymentTransactionId: null,
      
      deliveryInfo: orderInput.deliveryInfo,
      
      assignedStaffId: null,
      assignedStaffName: null,
      cancelReason: null,
      isDeleted: false,
      
      // 使用伺服器時間戳，確保時間記錄的準確性和一致性
      createdAt: FieldValue.serverTimestamp() as any,
      updatedAt: FieldValue.serverTimestamp() as any
    };
    
    // 保存訂單到數據庫
    const orderRef = db.collection('orders').doc(orderId);
    transaction.set(orderRef, newOrder);
    
    // 更新庫存
    for (const item of items) {
      const { menuItemId, quantity } = item;
      const menuItemRef = db.collection('menuItems').doc(menuItemId);
      
      // 減少庫存數量
      transaction.update(menuItemRef, {
        stock: FieldValue.increment(-quantity),
        salesCount: FieldValue.increment(quantity) // 可選：增加銷售計數
      });
    }
    
    // 可選：記錄訂單事件
    const eventRef = orderRef.collection('events').doc();
    transaction.set(eventRef, {
      eventType: 'created',
      timestamp: FieldValue.serverTimestamp(),
      userId,
      details: {
        status: OrderStatus.PENDING,
        itemCount: items.length
      }
    });
    
    // 因為 Firestore 事務中無法取得實際的 serverTimestamp 值，所以這裡需要將時間戳轉換回更加友好的格式
    // 為了不阻斷訂單流程，我們使用當前時間作為臨時值返回
    const orderForResponse = {
      ...newOrder,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return orderForResponse as Order;
  });
}

// 訂單查詢參數介面，擴展原有的 OrderQueryParams
interface ListOrdersQueryParams {
  limit?: number;
  startAfter?: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>;
  status?: OrderStatus;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  storeId?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * 列出訂單
 * @param tenantId 租戶ID
 * @param queryParams 查詢參數
 * @returns 訂單列表、總數和分頁信息
 */
export async function listOrders(
  tenantId: string,
  queryParams: ListOrdersQueryParams
): Promise<{
  orders: Order[],
  total: number,
  lastVisible?: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
}> {
  try {
    const {
      limit = 10,
      startAfter,
      status,
      customerId,
      dateFrom,
      dateTo,
      storeId,
      sortBy = 'createdAt',
      sortDirection = 'desc'
    } = queryParams;

    // 構建基本查詢
    let query = db.collection('orders')
      .where('tenantId', '==', tenantId)
      .where('isDeleted', '==', false);

    // 添加篩選條件
    if (status) {
      query = query.where('status', '==', status);
    }

    if (customerId) {
      query = query.where('customerId', '==', customerId);
    }

    if (storeId) {
      query = query.where('storeId', '==', storeId);
    }

    // 日期範圍篩選
    const hasDateFilter = dateFrom || dateTo;

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      query = query.where('createdAt', '>=', fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      // 設定為當天結束時間 (23:59:59.999)
      toDate.setHours(23, 59, 59, 999);
      query = query.where('createdAt', '<=', toDate);
    }

    // 1. 正確的總數計算 - 在應用排序和分頁前獲取總數
    const queryForTotalCount = query;
    const totalSnapshot = await queryForTotalCount.count().get();
    const total = totalSnapshot.data().count;
    
    // 2. 正確的排序邏輯 - 處理日期範圍查詢的特殊要求
    if (hasDateFilter) {
      // 如果有日期範圍過濾，createdAt必須是第一個排序欄位
      query = query.orderBy('createdAt', sortDirection);
      if (sortBy !== 'createdAt') {
        // 如果用戶指定了其他排序欄位，將其作為次要排序
        query = query.orderBy(sortBy, sortDirection);
      }
    } else {
      // 沒有日期範圍限制，可以直接按指定欄位排序
      query = query.orderBy(sortBy, sortDirection);
    }
    
    // 3. 分頁邏輯
    if (startAfter) {
      query = query.startAfter(startAfter);
    }
    
    // 設置限制
    query = query.limit(limit);
    
    // 4. 執行查詢並處理結果
    const dataSnapshot = await query.get();
    
    // 格式化結果
    const orders: Order[] = [];
    let lastVisible: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | undefined;
    
    dataSnapshot.forEach(doc => {
      const orderData = doc.data() as Order;
      // 確保日期字段正確轉換
      orderData.createdAt = orderData.createdAt instanceof admin.firestore.Timestamp ? 
        orderData.createdAt.toDate() : orderData.createdAt;
      orderData.updatedAt = orderData.updatedAt instanceof admin.firestore.Timestamp ? 
        orderData.updatedAt.toDate() : orderData.updatedAt;
      
      if (orderData.estimatedPickupTime && orderData.estimatedPickupTime instanceof admin.firestore.Timestamp) {
        orderData.estimatedPickupTime = orderData.estimatedPickupTime.toDate();
      }
      
      if (orderData.actualPickupTime && orderData.actualPickupTime instanceof admin.firestore.Timestamp) {
        orderData.actualPickupTime = orderData.actualPickupTime.toDate();
      }
      
      orders.push(orderData);
      
      // 更新最後一個可見文檔（用於下一頁查詢）
      lastVisible = doc;
    });
    
    return {
      orders,
      total,
      lastVisible
    };
  } catch (error) {
    logger.error('列出訂單時發生錯誤:', error);
    throw new Error(`列出訂單失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
  }
}

/**
 * 根據ID獲取訂單
 * @param tenantId 租戶ID
 * @param orderId 訂單ID
 * @returns 訂單對象或null
 */
export async function getOrderById(
  tenantId: string,
  orderId: string
): Promise<Order | null> {
  try {
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      return null;
    }
    
    const orderData = orderDoc.data() as Order;
    
    // 檢查租戶隔離
    if (orderData.tenantId !== tenantId) {
      logger.warn(`租戶 ${tenantId} 嘗試訪問不屬於自己的訂單 ${orderId}`);
      return null;
    }
    
    // 確保日期字段正確轉換
    orderData.createdAt = orderData.createdAt instanceof admin.firestore.Timestamp ? 
      orderData.createdAt.toDate() : orderData.createdAt;
    orderData.updatedAt = orderData.updatedAt instanceof admin.firestore.Timestamp ? 
      orderData.updatedAt.toDate() : orderData.updatedAt;
    
    if (orderData.estimatedPickupTime && orderData.estimatedPickupTime instanceof admin.firestore.Timestamp) {
      orderData.estimatedPickupTime = orderData.estimatedPickupTime.toDate();
    }
    
    if (orderData.actualPickupTime && orderData.actualPickupTime instanceof admin.firestore.Timestamp) {
      orderData.actualPickupTime = orderData.actualPickupTime.toDate();
    }
    
    return orderData;
  } catch (error) {
    logger.error(`獲取訂單 ${orderId} 時發生錯誤:`, error);
    throw new Error(`獲取訂單失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
  }
} 