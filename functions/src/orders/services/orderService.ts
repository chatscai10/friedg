import * as admin from 'firebase-admin';
import { 
  Order, 
  OrderInput, 
  OrderStatus, 
  OrderItem, 
  PaymentStatus, 
  PaymentMethod,
  OrderStatsResult,
  OrderQueryParams,
  OrderItemOption
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';

const db = admin.firestore();
const ordersCollection = db.collection('orders');

/**
 * 訂單編號生成器
 * 格式: 店鋪ID前兩碼 + YYMMDD + 流水號(4位)
 */
async function generateOrderNumber(storeId: string): Promise<string> {
  const today = DateTime.now().setZone('Asia/Taipei');
  const dateStr = today.toFormat('yyMMdd');
  const prefix = storeId.substring(0, 2).toUpperCase();
  
  // 獲取今日已有訂單數以生成流水號
  const snapshot = await ordersCollection
    .where('storeId', '==', storeId)
    .where('createdAt', '>=', today.startOf('day').toJSDate())
    .where('createdAt', '<=', today.endOf('day').toJSDate())
    .get();
  
  const sequenceNum = (snapshot.size + 1).toString().padStart(4, '0');
  return `${prefix}${dateStr}${sequenceNum}`;
}

/**
 * 創建新訂單
 */
export async function createOrder(orderInput: OrderInput): Promise<Order> {
  const { storeId, items, ...restInput } = orderInput;
  
  // 使用事務確保庫存和訂單數據一致性
  const order = await db.runTransaction(async (transaction) => {
    // 1. 獲取店鋪信息
    const storeDoc = await transaction.get(db.collection('stores').doc(storeId));
    if (!storeDoc.exists) {
      throw new Error(`店鋪不存在: ${storeId}`);
    }
    const storeData = storeDoc.data()!;
    
    // 2. 檢查菜單項並計算金額
    const orderItems: OrderItem[] = [];
    let subtotal = 0;
    
    for (const item of items) {
      const { menuItemId, quantity, unitPrice, options = [] } = item;
      
      // 檢查菜單項是否存在
      const menuItemDoc = await transaction.get(db.collection('menuItems').doc(menuItemId));
      if (!menuItemDoc.exists) {
        throw new Error(`菜單項不存在: ${menuItemId}`);
      }
      const menuItemData = menuItemDoc.data()!;
      
      // 檢查庫存（如果啟用了庫存管理）
      if (menuItemData.trackInventory && menuItemData.inventoryCount < quantity) {
        throw new Error(`商品 ${menuItemData.name} 庫存不足`);
      }
      
      // 計算選項額外費用
      let optionsTotal = 0;
      const processedOptions: OrderItemOption[] = [];
      
      for (const option of options) {
        const { optionId, value, additionalPrice = 0 } = option;
        
        // 檢查選項是否存在
        const optionDoc = await transaction.get(db.collection('menuOptions').doc(optionId));
        if (!optionDoc.exists) {
          throw new Error(`選項不存在: ${optionId}`);
        }
        const optionData = optionDoc.data()!;
        
        optionsTotal += additionalPrice;
        processedOptions.push({
          optionId,
          optionName: optionData.name,
          value,
          additionalPrice
        });
      }
      
      // 計算項目總價
      const itemTotal = quantity * unitPrice + optionsTotal;
      subtotal += itemTotal;
      
      // 更新庫存（如果啟用了庫存管理）
      if (menuItemData.trackInventory) {
        transaction.update(menuItemDoc.ref, {
          inventoryCount: admin.firestore.FieldValue.increment(-quantity)
        });
      }
      
      // 添加到訂單項目列表
      orderItems.push({
        id: uuidv4(),
        menuItemId,
        menuItemName: menuItemData.name,
        menuItemImage: menuItemData.imageUrl || '',
        quantity,
        unitPrice,
        totalPrice: itemTotal,
        specialInstructions: item.specialInstructions || '',
        options: processedOptions
      });
    }
    
    // 3. 生成訂單編號
    const orderNumber = await generateOrderNumber(storeId);
    
    // 4. 計算稅金和總價
    const taxRate = storeData.taxRate || 0.05; // 默認 5% 稅率
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
    
    // 5. 計算折扣（如果提供了折扣碼）
    let discountAmount = 0;
    if (orderInput.discountCode) {
      // 這裡可以實現折扣碼邏輯
      // 暫時跳過，保留接口
    }
    
    // 最終總價 = 總價 - 折扣
    totalAmount -= discountAmount;
    
    // 6. 建立新訂單文檔
    const now = admin.firestore.Timestamp.now();
    const orderId = uuidv4();
    
    const newOrder: Order = {
      id: orderId,
      orderNumber,
      storeId,
      storeName: storeData.name,
      tenantId: storeData.tenantId,
      
      customerName: restInput.customerName || '',
      customerPhone: restInput.customerPhone || '',
      customerEmail: restInput.customerEmail || '',
      customerId: restInput.customerId || null,
      
      status: OrderStatus.PENDING,
      orderType: restInput.orderType || 'takeout',
      tableNumber: restInput.tableNumber || '',
      estimatedPickupTime: restInput.estimatedPickupTime ? new Date(restInput.estimatedPickupTime) : null,
      actualPickupTime: null,
      specialInstructions: restInput.specialInstructions || '',
      
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
      
      assignedStaffId: null,
      assignedStaffName: null,
      cancelReason: null,
      isDeleted: false,
      
      createdAt: now.toDate(),
      updatedAt: now.toDate()
    };
    
    // 7. 保存訂單到數據庫
    transaction.set(ordersCollection.doc(orderId), newOrder);
    
    // 8. 記錄訂單事件
    transaction.set(
      db.collection('orders').doc(orderId).collection('events').doc(),
      {
        eventType: 'created',
        timestamp: now,
        userId: orderInput.customerId || 'system',
        userRole: 'customer',
        details: {
          status: OrderStatus.PENDING,
          items: orderItems.length
        }
      }
    );
    
    return newOrder;
  });
  
  return order;
}

/**
 * 獲取訂單詳情
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
  const orderDoc = await ordersCollection.doc(orderId).get();
  if (!orderDoc.exists) return null;
  
  return orderDoc.data() as Order;
}

/**
 * 查詢訂單列表
 */
export async function queryOrders(params: OrderQueryParams): Promise<{
  orders: Order[],
  pagination: {
    total: number,
    page: number,
    limit: number,
    pages: number
  }
}> {
  const {
    storeId,
    status,
    from,
    to,
    customerId,
    page = 1,
    limit = 20
  } = params;
  
  let query: FirebaseFirestore.Query = ordersCollection
    .where('isDeleted', '==', false);
  
  // 應用篩選條件
  if (storeId) {
    query = query.where('storeId', '==', storeId);
  }
  
  if (status) {
    query = query.where('status', '==', status);
  }
  
  if (customerId) {
    query = query.where('customerId', '==', customerId);
  }
  
  // 日期範圍篩選
  if (from) {
    const fromDate = new Date(from);
    query = query.where('createdAt', '>=', fromDate);
  }
  
  if (to) {
    const toDate = new Date(to);
    query = query.where('createdAt', '<=', toDate);
  }
  
  // 計算總記錄數（注意：這在大數據量時效率不高）
  const countSnapshot = await query.get();
  const total = countSnapshot.size;
  
  // 計算分頁
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  
  // 獲取當前頁數據
  query = query.orderBy('createdAt', 'desc')
    .limit(limit)
    .offset(offset);
  
  const snapshot = await query.get();
  const orders = snapshot.docs.map(doc => doc.data() as Order);
  
  return {
    orders,
    pagination: {
      total,
      page,
      limit,
      pages: totalPages
    }
  };
}

/**
 * 更新訂單狀態
 */
export async function updateOrderStatus(
  orderId: string, 
  status: OrderStatus, 
  userId: string,
  userRole: string,
  reason: string = ''
): Promise<Order | null> {
  return await db.runTransaction(async (transaction) => {
    const orderRef = ordersCollection.doc(orderId);
    const orderDoc = await transaction.get(orderRef);
    
    if (!orderDoc.exists) {
      throw new Error(`訂單不存在: ${orderId}`);
    }
    
    const orderData = orderDoc.data() as Order;
    
    // 檢查狀態轉換是否合法
    if (!isValidStatusTransition(orderData.status, status)) {
      throw new Error(`不允許從 ${orderData.status} 狀態轉換為 ${status}`);
    }
    
    // 更新訂單狀態
    const updateData: Partial<Order> = {
      status,
      updatedAt: admin.firestore.Timestamp.now().toDate()
    };
    
    // 如果取消訂單，記錄取消原因
    if (status === OrderStatus.CANCELLED) {
      updateData.cancelReason = reason;
    }
    
    // 如果訂單完成，記錄實際取餐時間
    if (status === OrderStatus.COMPLETED) {
      updateData.actualPickupTime = admin.firestore.Timestamp.now().toDate();
    }
    
    transaction.update(orderRef, updateData);
    
    // 記錄狀態變更事件
    transaction.set(
      orderRef.collection('events').doc(),
      {
        eventType: 'status_changed',
        timestamp: admin.firestore.Timestamp.now(),
        userId,
        userRole,
        details: {
          oldStatus: orderData.status,
          newStatus: status,
          reason: reason || undefined
        }
      }
    );
    
    // 如果取消訂單，恢復庫存
    if (status === OrderStatus.CANCELLED) {
      for (const item of orderData.items) {
        const menuItemRef = db.collection('menuItems').doc(item.menuItemId);
        const menuItemDoc = await transaction.get(menuItemRef);
        
        if (menuItemDoc.exists && menuItemDoc.data()!.trackInventory) {
          transaction.update(menuItemRef, {
            inventoryCount: admin.firestore.FieldValue.increment(item.quantity)
          });
        }
      }
    }
    
    return {
      ...orderData,
      ...updateData
    };
  });
}

/**
 * 記錄訂單支付
 */
export async function recordOrderPayment(
  orderId: string,
  paymentMethod: PaymentMethod,
  amount: number,
  userId: string,
  userRole: string,
  transactionId?: string,
  notes?: string
): Promise<Order | null> {
  return await db.runTransaction(async (transaction) => {
    const orderRef = ordersCollection.doc(orderId);
    const orderDoc = await transaction.get(orderRef);
    
    if (!orderDoc.exists) {
      throw new Error(`訂單不存在: ${orderId}`);
    }
    
    const orderData = orderDoc.data() as Order;
    
    // 檢查訂單是否已完全支付
    if (orderData.paymentStatus === PaymentStatus.PAID) {
      throw new Error('訂單已經完全支付');
    }
    
    // 檢查訂單狀態是否允許支付
    if (orderData.status === OrderStatus.CANCELLED) {
      throw new Error('已取消的訂單不能進行支付');
    }
    
    // 計算新的支付狀態
    let paymentStatus: PaymentStatus;
    
    if (amount >= orderData.totalAmount) {
      paymentStatus = PaymentStatus.PAID;
    } else if (amount > 0) {
      paymentStatus = PaymentStatus.PARTIALLY_PAID;
    } else {
      paymentStatus = orderData.paymentStatus;
    }
    
    // 更新訂單支付信息
    const updateData: Partial<Order> = {
      paymentStatus,
      paymentMethod,
      paymentTransactionId: transactionId || orderData.paymentTransactionId,
      updatedAt: admin.firestore.Timestamp.now().toDate()
    };
    
    transaction.update(orderRef, updateData);
    
    // 記錄支付事件
    transaction.set(
      orderRef.collection('events').doc(),
      {
        eventType: 'payment_recorded',
        timestamp: admin.firestore.Timestamp.now(),
        userId,
        userRole,
        details: {
          method: paymentMethod,
          amount,
          transactionId: transactionId || undefined,
          notes: notes || undefined,
          newStatus: paymentStatus
        }
      }
    );
    
    return {
      ...orderData,
      ...updateData
    };
  });
}

/**
 * 獲取訂單統計數據
 */
export async function getOrderStats(
  storeId?: string,
  from?: Date,
  to?: Date,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<OrderStatsResult> {
  let query: FirebaseFirestore.Query = ordersCollection
    .where('isDeleted', '==', false);
  
  if (storeId) {
    query = query.where('storeId', '==', storeId);
  }
  
  if (from) {
    query = query.where('createdAt', '>=', from);
  }
  
  if (to) {
    query = query.where('createdAt', '<=', to);
  }
  
  const snapshot = await query.get();
  const orders = snapshot.docs.map(doc => doc.data() as Order);
  
  // 基本統計
  const totalOrders = orders.length;
  const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
  
  // 按狀態分組
  const ordersByStatus = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // 按類型分組
  const ordersByType = orders.reduce((acc, order) => {
    acc[order.orderType] = (acc[order.orderType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // 熱銷商品排行
  const itemSales: Record<string, { quantity: number, revenue: number, name: string }> = {};
  
  for (const order of orders) {
    for (const item of order.items) {
      if (!itemSales[item.menuItemId]) {
        itemSales[item.menuItemId] = {
          quantity: 0,
          revenue: 0,
          name: item.menuItemName
        };
      }
      
      itemSales[item.menuItemId].quantity += item.quantity;
      itemSales[item.menuItemId].revenue += item.totalPrice;
    }
  }
  
  const topSellingItems = Object.entries(itemSales)
    .map(([menuItemId, data]) => ({
      menuItemId,
      menuItemName: data.name,
      quantity: data.quantity,
      revenue: data.revenue
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);
  
  // 按日期分組銷售數據
  const salesByDay: Array<{ date: string, orders: number, sales: number }> = [];
  
  if (orders.length > 0) {
    const dateFormat = groupBy === 'day' ? 'yyyy-MM-dd' :
                      groupBy === 'week' ? 'yyyy-WW' :
                      'yyyy-MM';
    
    const salesByDate: Record<string, { orders: number, sales: number }> = {};
    
    for (const order of orders) {
      const date = DateTime.fromJSDate(order.createdAt).toFormat(dateFormat);
      
      if (!salesByDate[date]) {
        salesByDate[date] = { orders: 0, sales: 0 };
      }
      
      salesByDate[date].orders += 1;
      salesByDate[date].sales += order.totalAmount;
    }
    
    for (const [date, data] of Object.entries(salesByDate)) {
      salesByDay.push({
        date,
        orders: data.orders,
        sales: data.sales
      });
    }
    
    // 按日期排序
    salesByDay.sort((a, b) => a.date.localeCompare(b.date));
  }
  
  return {
    totalOrders,
    totalSales,
    averageOrderValue,
    topSellingItems,
    ordersByStatus,
    ordersByType,
    salesByDay
  };
}

/**
 * 檢查訂單狀態轉換是否合法
 */
function isValidStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
  // 狀態轉換規則
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [
      OrderStatus.PREPARING, 
      OrderStatus.CANCELLED
    ],
    [OrderStatus.PREPARING]: [
      OrderStatus.READY, 
      OrderStatus.CANCELLED
    ],
    [OrderStatus.READY]: [
      OrderStatus.COMPLETED, 
      OrderStatus.CANCELLED
    ],
    [OrderStatus.COMPLETED]: [
      // 完成狀態不能再變更
    ],
    [OrderStatus.CANCELLED]: [
      // 取消狀態不能再變更
    ]
  };
  
  // 檢查新狀態是否在有效的轉換列表中
  return validTransitions[currentStatus]?.includes(newStatus) || false;
} 