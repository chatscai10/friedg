import apiClient from './api'; // Import the configured Axios instance
import { Order, OrderStatus, PaymentStatus } from '../types/order';
import mockOrderService from './mock/mockOrderService';

// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL; // No longer needed

// Define a type for pagination if needed, otherwise use any or a specific structure
interface PaginationInfo {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    // Add other relevant pagination fields if provided by the API
}

interface OrdersResponse {
    orders: Order[];
    pagination: PaginationInfo;
}

// 訂單查詢參數接口
export interface GetOrdersParams {
  page?: number;
  limit?: number;
  status?: string;
  orderType?: string;
  from?: string;
  to?: string;
  search?: string;
  storeId?: string;
}

// 檢查是否使用模擬數據（根據環境變數或localStorage）
const isMockDataEnabled = () => {
  // 檢查多種條件以確保正確識別測試用戶
  // 1. 檢查localStorage中的標誌
  const testUserFlag = localStorage.getItem('testUserLoggedIn') === 'true';
  // 2. 檢查使用者是否被明確標識為測試用戶
  const isTestUser = localStorage.getItem('isTestUser') === 'true';
  // 3. 檢查URL參數是否指示測試模式
  const urlHasTestMode = window.location.search.includes('testMode=true');
  // 4. 檢查環境中是否指定了測試模式
  const envTestMode = import.meta.env.VITE_USE_MOCK_DATA === 'true';
  
  // 如果滿足任何一個條件，返回true
  console.log("測試用戶狀態檢查:", { testUserFlag, isTestUser, urlHasTestMode, envTestMode });
  
  return testUserFlag || isTestUser || urlHasTestMode || envTestMode;
};

/**
 * 獲取訂單列表
 * @param params 查詢參數 (來自組件，例如分頁、狀態過濾)
 * @returns 訂單列表及分頁信息
 */
export const getOrders = async (params: {
  page?: number;
  limit?: number;
  storeId?: string;
  status?: OrderStatus;
  orderType?: string;
  from?: string;
  to?: string;
}) => {
  try {
    console.log('[快速診斷] 硬編碼 storeId: default_store');
    
    // 添加默認 storeId
    const queryParams = {
      ...params,
      storeId: params.storeId || 'default_store'
    };
    
    console.log('Fetching orders with params:', queryParams);
    
    // 判斷是否使用模擬數據
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務獲取訂單列表');
      return mockOrderService.getOrders(queryParams);
    }
    
    // 使用真實API
    const response = await apiClient.get('/orders', { params: queryParams });
    return response.data;
  } catch (error) {
    console.error('獲取訂單列表失敗:', error);
    throw error;
  }
};

/**
 * 獲取單個訂單詳情
 * @param orderId 訂單ID
 * @returns 訂單詳情
 */
export const getOrderById = async (orderId: string) => {
  try {
    // 判斷是否使用模擬數據
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務獲取訂單詳情');
      return mockOrderService.getOrderById(orderId);
    }
    
    // 使用真實API
    const response = await apiClient.get(`/orders/${orderId}`);
    return response.data;
  } catch (error) {
    console.error(`獲取訂單 ${orderId} 詳情失敗:`, error);
    throw error;
  }
};

/**
 * 更新訂單狀態
 * @param orderId 訂單ID
 * @param status 新狀態
 * @returns 更新後的訂單
 */
export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  try {
    // 判斷是否使用模擬數據
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務更新訂單狀態');
      return mockOrderService.updateOrderStatus(orderId, status);
    }
    
    // 使用真實API
    const response = await apiClient.patch(`/orders/${orderId}/status`, { status });
    return response.data;
  } catch (error) {
    console.error(`更新訂單 ${orderId} 狀態失敗:`, error);
    throw error;
  }
};

/**
 * 獲取訂單收據
 * @param orderId 訂單ID
 * @returns 收據信息
 */
export const getOrderReceipt = async (orderId: string): Promise<Record<string, unknown>> => {
  try {
    // 判斷是否使用模擬數據
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務獲取訂單收據');
      // 檢查mockOrderService是否有getOrderReceipt方法
      if ('getOrderReceipt' in mockOrderService) {
        return mockOrderService.getOrderReceipt(orderId);
      }
      // 如果沒有，返回模擬收據數據
      return {
        orderId,
        receiptNumber: `R-${orderId.substring(6)}`,
        generatedAt: new Date().toISOString(),
        downloadUrl: '#',
        status: 'available'
      };
    }
    
    // 使用真實API
    const response = await apiClient.get<Record<string, unknown>>(`/orders/${orderId}/receipt`);
    return response.data;
  } catch (error) {
    console.error(`獲取訂單 ${orderId} 收據失敗:`, error);
    throw error;
  }
};

/**
 * 建立新訂單
 * @param orderData 訂單數據
 * @returns 新建的訂單
 */
export const createOrder = async (orderData: Partial<Order>) => {
  try {
    // 判斷是否使用模擬數據
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務創建訂單');
      return mockOrderService.createOrder(orderData);
    }
    
    // 使用真實API
    const response = await apiClient.post('/orders', orderData);
    return response.data;
  } catch (error) {
    console.error('建立訂單失敗:', error);
    throw error;
  }
};

export const recordPayment = async (orderId: string, paymentData: { paymentMethod: string, amount: number, transactionId?: string }): Promise<Order> => {
  try {
    // 判斷是否使用模擬數據
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務記錄支付');
      // 檢查mockOrderService是否有recordPayment方法
      if ('recordPayment' in mockOrderService) {
        return mockOrderService.recordPayment(orderId, paymentData);
      }
      // 如果沒有，獲取訂單並修改狀態
      const order = await getOrderById(orderId);
      if (order) {
        // 類型斷言為訂單模型，處理可選屬性
        const updatedOrder = order as Order;
        updatedOrder.paymentStatus = 'paid' as PaymentStatus;
        updatedOrder.paymentMethod = paymentData.paymentMethod;
        updatedOrder.updatedAt = new Date();
        return updatedOrder;
      }
      throw new Error(`訂單不存在: ${orderId}`);
    }
    
    // 使用真實API
    const response = await apiClient.post(`/orders/${orderId}/payment`, paymentData);
    return response.data;
  } catch (error) {
    console.error('記錄支付失敗:', error);
    throw error;
  }
};

// 獲取訂單統計數據
export const getOrderStatistics = async (params?: { storeId?: string, from?: string, to?: string, groupBy?: string }): Promise<Record<string, unknown>> => {
  try {
    // 判斷是否使用模擬數據
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務獲取訂單統計');
      // 檢查mockOrderService是否有getOrderStatistics方法
      if ('getOrderStatistics' in mockOrderService) {
        return mockOrderService.getOrderStatistics(params);
      }
      // 返回模擬統計數據
      return {
        totalOrders: 42,
        completedOrders: 35,
        pendingOrders: 7,
        totalRevenue: 12500,
        averageOrderValue: 297.62
      };
    }
    
    // 使用真實API
    const response = await apiClient.get<Record<string, unknown>>('/orders/stats', { params });
    return response.data;
  } catch (error) {
    console.error('獲取訂單統計失敗:', error);
    throw error;
  }
};

export const generateOrderReceipt = async (orderId: string): Promise<{ message: string, orderId: string, receiptUrl?: string }> => {
  try {
    // 判斷是否使用模擬數據
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務生成訂單收據');
      // 檢查mockOrderService是否有generateOrderReceipt方法
      if ('generateOrderReceipt' in mockOrderService) {
        return mockOrderService.generateOrderReceipt(orderId);
      }
      // 返回模擬生成收據結果
      return {
        message: '收據生成成功',
        orderId,
        receiptUrl: `https://mockurl.com/receipts/${orderId}.pdf`
      };
    }
    
    // 使用真實API
    const response = await apiClient.post(`/orders/${orderId}/receipt/generate`);
    return response.data;
  } catch (error) {
    console.error('生成訂單收據失敗:', error);
    throw error;
  }
}; 