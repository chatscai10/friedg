import { Order, OrderStatus, PaymentStatus, OrderType, OrderItem } from '../../types/order';

// 訂單選項接口
interface OrderItemOption {
  optionId: string;
  optionName: string;
  value: string;
  additionalPrice: number;
}

// 模擬訂單數據
const mockOrders: Order[] = [
  {
    id: 'order-1',
    orderNumber: 'ST240501001',
    storeId: 'default_store',
    storeName: '總店',
    customerId: null,
    tenantId: 'default_tenant' as any, // 添加額外屬性
    status: 'completed' as OrderStatus,
    orderType: 'takeout' as OrderType,
    customerName: '陳大明',
    customerPhone: '0912345678',
    tableNumber: '' as any, // 添加額外屬性
    items: [
      {
        id: 'item-1',
        menuItemId: 'menu-1',
        menuItemName: '椒鹽雞排',
        quantity: 2,
        unitPrice: 80,
        totalPrice: 160,
        specialInstructions: ''
      },
      {
        id: 'item-2',
        menuItemId: 'menu-3',
        menuItemName: '薯條',
        quantity: 1,
        unitPrice: 35,
        totalPrice: 35,
        specialInstructions: ''
      }
    ],
    subtotal: 195,
    taxAmount: 9.75,
    totalPrice: 204.75,
    discountAmount: 0 as any, // 添加額外屬性
    taxIncluded: false as any, // 添加額外屬性
    paymentStatus: 'paid' as PaymentStatus,
    paymentMethod: 'cash',
    createdAt: new Date('2024-05-01T14:23:15'),
    updatedAt: new Date('2024-05-01T14:45:20')
  },
  {
    id: 'order-2',
    orderNumber: 'ST240502001',
    storeId: 'default_store',
    storeName: '總店',
    customerId: null,
    tenantId: 'default_tenant' as any,
    status: 'pending' as OrderStatus,
    orderType: 'dine-in' as OrderType,
    customerName: '林小華',
    customerPhone: '0923456789',
    tableNumber: 'A5' as any,
    items: [
      {
        id: 'item-3',
        menuItemId: 'menu-2',
        menuItemName: '香酥雞腿',
        quantity: 1,
        unitPrice: 90,
        totalPrice: 90,
        specialInstructions: ''
      },
      {
        id: 'item-4',
        menuItemId: 'menu-4',
        menuItemName: '可樂',
        quantity: 2,
        unitPrice: 25,
        totalPrice: 50,
        specialInstructions: ''
      }
    ],
    subtotal: 140,
    taxAmount: 7,
    totalPrice: 147,
    discountAmount: 0 as any,
    taxIncluded: false as any,
    paymentStatus: 'unpaid' as PaymentStatus,
    paymentMethod: null,
    createdAt: new Date('2024-05-02T10:15:30'),
    updatedAt: new Date('2024-05-02T10:15:30')
  },
  {
    id: 'order-3',
    orderNumber: 'ST240502002',
    storeId: 'default_store',
    storeName: '總店',
    customerId: null,
    tenantId: 'default_tenant' as any,
    status: 'preparing' as OrderStatus,
    orderType: 'takeout' as OrderType,
    customerName: '王小明',
    customerPhone: '0934567890',
    tableNumber: '' as any,
    items: [
      {
        id: 'item-5',
        menuItemId: 'menu-1',
        menuItemName: '椒鹽雞排',
        quantity: 3,
        unitPrice: 80,
        totalPrice: 240,
        specialInstructions: ''
      }
    ],
    subtotal: 240,
    taxAmount: 12,
    totalPrice: 242,
    discountAmount: 10 as any,
    taxIncluded: false as any,
    paymentStatus: 'paid' as PaymentStatus,
    paymentMethod: 'creditcard',
    createdAt: new Date('2024-05-02T15:30:45'),
    updatedAt: new Date('2024-05-02T15:35:20')
  }
];

// 模擬收據數據
const mockReceipts: Record<string, { 
  orderId: string, 
  receiptNumber: string, 
  generatedAt: string, 
  downloadUrl: string, 
  status: string 
}> = {
  'order-1': {
    orderId: 'order-1',
    receiptNumber: 'R-001',
    generatedAt: new Date('2024-05-01T14:50:00').toISOString(),
    downloadUrl: 'https://mockurl.com/receipts/order-1.pdf',
    status: 'available'
  },
  'order-3': {
    orderId: 'order-3',
    receiptNumber: 'R-003',
    generatedAt: new Date('2024-05-02T15:45:00').toISOString(),
    downloadUrl: 'https://mockurl.com/receipts/order-3.pdf',
    status: 'available'
  }
};

// 模擬訂單統計數據
const mockStatistics = {
  totalOrders: 42,
  completedOrders: 35,
  pendingOrders: 7,
  totalRevenue: 12500,
  averageOrderValue: 297.62,
  byOrderType: {
    'takeout': 25,
    'dine-in': 17,
    'delivery': 0
  },
  byPaymentMethod: {
    'cash': 20,
    'creditcard': 22
  }
};

// 分頁處理模擬函數
const paginateOrders = (page: number, limit: number, orders: Order[]) => {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedOrders = orders.slice(startIndex, endIndex);
  
  return {
    orders: paginatedOrders,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(orders.length / limit),
      totalItems: orders.length,
      totalOrders: orders.length,
      limit: limit
    }
  };
};

// 模擬獲取訂單列表
export const getOrders = async (params: {
  page?: number;
  limit?: number;
  storeId?: string;
  status?: OrderStatus;
  orderType?: string;
  from?: string;
  to?: string;
}) => {
  console.log('使用模擬訂單服務 - getOrders');
  
  // 延遲模擬網絡請求
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const { page = 1, limit = 10, storeId, status, orderType, from, to } = params;
  
  // 篩選
  let filteredOrders = [...mockOrders];
  
  if (storeId) {
    filteredOrders = filteredOrders.filter(order => order.storeId === storeId);
  }
  
  if (status) {
    filteredOrders = filteredOrders.filter(order => order.status === status);
  }
  
  if (orderType) {
    filteredOrders = filteredOrders.filter(order => order.orderType === orderType);
  }
  
  // 日期範圍過濾
  if (from) {
    const fromDate = new Date(from);
    filteredOrders = filteredOrders.filter(order => {
      const orderDate = order.createdAt instanceof Date 
        ? order.createdAt 
        : new Date(order.createdAt);
      return orderDate >= fromDate;
    });
  }
  
  if (to) {
    const toDate = new Date(to);
    filteredOrders = filteredOrders.filter(order => {
      const orderDate = order.createdAt instanceof Date 
        ? order.createdAt 
        : new Date(order.createdAt);
      return orderDate <= toDate;
    });
  }
  
  // 按創建時間排序
  filteredOrders.sort((a, b) => {
    const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    return dateB - dateA;
  });
  
  return paginateOrders(page, limit, filteredOrders);
};

// 模擬獲取訂單詳情
export const getOrderById = async (orderId: string) => {
  console.log(`使用模擬訂單服務 - getOrderById: ${orderId}`);
  
  // 延遲模擬網絡請求
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const order = mockOrders.find(o => o.id === orderId);
  
  if (!order) {
    throw new Error(`訂單不存在: ${orderId}`);
  }
  
  return order;
};

// 模擬更新訂單狀態
export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  console.log(`使用模擬訂單服務 - updateOrderStatus: ${orderId} -> ${status}`);
  
  // 延遲模擬網絡請求
  await new Promise(resolve => setTimeout(resolve, 700));
  
  const orderIndex = mockOrders.findIndex(o => o.id === orderId);
  
  if (orderIndex === -1) {
    throw new Error(`訂單不存在: ${orderId}`);
  }
  
  // 創建一個深拷貝以避免改變原始數據
  const updatedOrder = JSON.parse(JSON.stringify(mockOrders[orderIndex])) as Order;
  updatedOrder.status = status;
  updatedOrder.updatedAt = new Date();
  
  return updatedOrder;
};

// 模擬創建訂單
export const createOrder = async (orderData: Partial<Order>) => {
  console.log('使用模擬訂單服務 - createOrder', orderData);
  
  // 延遲模擬網絡請求
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 創建新訂單
  const newOrder: Order = {
    id: `order-${mockOrders.length + 1}`,
    orderNumber: `ST${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${String(mockOrders.length + 1).padStart(3, '0')}`,
    storeId: orderData.storeId || 'default_store',
    storeName: '總店',
    customerId: null,
    tenantId: 'default_tenant' as any,
    status: 'pending' as OrderStatus,
    orderType: (orderData.orderType || 'takeout') as OrderType,
    customerName: orderData.customerName || '',
    customerPhone: orderData.customerPhone || '',
    tableNumber: '' as any,
    items: orderData.items || [],
    subtotal: 100,
    taxAmount: 5,
    totalPrice: 105,
    discountAmount: 0 as any,
    taxIncluded: false as any,
    paymentStatus: 'unpaid' as PaymentStatus,
    paymentMethod: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  mockOrders.push(newOrder);
  
  return newOrder;
};

// 模擬獲取訂單收據
export const getOrderReceipt = async (orderId: string): Promise<Record<string, unknown>> => {
  console.log(`使用模擬訂單服務 - getOrderReceipt: ${orderId}`);
  
  // 延遲模擬網絡請求
  await new Promise(resolve => setTimeout(resolve, 600));
  
  // 檢查訂單是否存在
  const order = mockOrders.find(o => o.id === orderId);
  if (!order) {
    throw new Error(`訂單不存在: ${orderId}`);
  }
  
  // 檢查該訂單是否有收據
  if (mockReceipts[orderId]) {
    return mockReceipts[orderId];
  }
  
  // 如果沒有預先定義的收據，生成一個新的
  return {
    orderId,
    receiptNumber: `R-${orderId.substring(orderId.length - 3)}`,
    generatedAt: new Date().toISOString(),
    downloadUrl: `https://mockurl.com/receipts/${orderId}.pdf`,
    status: 'available'
  };
};

// 模擬記錄支付
export const recordPayment = async (orderId: string, paymentData: { 
  paymentMethod: string, 
  amount: number, 
  transactionId?: string 
}): Promise<Order> => {
  console.log(`使用模擬訂單服務 - recordPayment: ${orderId}`, paymentData);
  
  // 延遲模擬網絡請求
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const orderIndex = mockOrders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    throw new Error(`訂單不存在: ${orderId}`);
  }
  
  // 創建一個深拷貝以避免改變原始數據
  const updatedOrder = JSON.parse(JSON.stringify(mockOrders[orderIndex])) as Order;
  updatedOrder.paymentStatus = 'paid';
  updatedOrder.paymentMethod = paymentData.paymentMethod;
  updatedOrder.updatedAt = new Date();
  
  // 實際項目可能需要更多邏輯，例如檢查支付金額是否匹配訂單總金額等
  
  return updatedOrder;
};

// 模擬獲取訂單統計
export const getOrderStatistics = async (params?: { 
  storeId?: string, 
  from?: string, 
  to?: string, 
  groupBy?: string 
}): Promise<Record<string, unknown>> => {
  console.log('使用模擬訂單服務 - getOrderStatistics', params);
  
  // 延遲模擬網絡請求
  await new Promise(resolve => setTimeout(resolve, 900));
  
  // 可以根據參數過濾/定制返回的統計數據，這裡簡化處理
  return { ...mockStatistics };
};

// 模擬生成訂單收據
export const generateOrderReceipt = async (orderId: string): Promise<{ 
  message: string, 
  orderId: string, 
  receiptUrl?: string 
}> => {
  console.log(`使用模擬訂單服務 - generateOrderReceipt: ${orderId}`);
  
  // 延遲模擬網絡請求
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // 檢查訂單是否存在
  const order = mockOrders.find(o => o.id === orderId);
  if (!order) {
    throw new Error(`訂單不存在: ${orderId}`);
  }
  
  // 生成收據URL
  const receiptUrl = `https://mockurl.com/receipts/${orderId}.pdf`;
  
  // 將收據添加到模擬收據集合中
  mockReceipts[orderId] = {
    orderId,
    receiptNumber: `R-${orderId.substring(orderId.length - 3)}`,
    generatedAt: new Date().toISOString(),
    downloadUrl: receiptUrl,
    status: 'available'
  };
  
  return {
    message: '收據生成成功',
    orderId,
    receiptUrl
  };
};

// 導出模擬服務
export default {
  getOrders,
  getOrderById,
  updateOrderStatus,
  createOrder,
  getOrderReceipt,
  recordPayment,
  getOrderStatistics,
  generateOrderReceipt
}; 