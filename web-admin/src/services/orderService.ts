import apiClient from './api'; // Import the configured Axios instance
import { Order, OrderStatus /*, Receipt */ } from '../types/order';
import { authService } from './authService'; // Import authService

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

/**
 * 獲取訂單列表
 * @param params 查詢參數 (來自組件，例如分頁、狀態過濾)
 * @returns 訂單列表及分頁信息
 */
export const getOrders = async (componentParams?: { status?: OrderStatus, page?: number, limit?: number }): Promise<OrdersResponse> => {
  try {
    // --- 快速診斷：暫時硬編碼 storeId --- 
    const storeId = 'default_store'; 
    console.warn('[快速診斷] 硬編碼 storeId:', storeId);
    // --- 下面是原始的讀取 Claims 邏輯，暫時註解掉 ---
    /*
    // 1. Get claims
    const claims = await authService.getUserClaims();
    const storeId = claims?.storeId as string | undefined; // Safely access storeId

    if (!storeId) {
      console.error('Store ID not found in user claims. Cannot fetch orders.');
      // You might want to throw an error or return an empty response depending on UX requirements
      throw new Error('用戶缺少必要的店鋪權限 (Store ID missing in claims)');
    }
    */
    // --- 結束註解區塊 ---

    // 2. Merge storeId with component parameters
    const apiParams = {
      ...componentParams, // Include page, limit, status, etc. from the component
      storeId: storeId,  // Use the hardcoded or fetched storeId
    };

    console.log('Fetching orders with params:', apiParams); // Log parameters for debugging

    // 3. Use apiClient with merged parameters
    const response = await apiClient.get<OrdersResponse>('/orders', { params: apiParams });
    return response.data; // Assuming backend returns { orders: [], pagination: {...} }
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
export const getOrderById = async (orderId: string): Promise<Order> => {
  try {
    // Use apiClient
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
export const updateOrderStatus = async (orderId: string, status: OrderStatus, reason?: string): Promise<Order> => {
  try {
    // Use apiClient
    const response = await apiClient.put(`/orders/${orderId}/status`, { status, reason });
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
export const getOrderReceipt = async (orderId: string): Promise<Record<string, unknown> /* Receipt */> => {
  try {
    // Use apiClient
    const response = await apiClient.get<Record<string, unknown>>(`/orders/${orderId}/receipt`);
    // Assuming backend returns the Receipt object structure directly
    // Adjust if it returns { receiptUrl: '...' } or similar
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
export const createOrder = async (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt' | 'status' | 'totalAmount' | 'subtotal' | 'items' /* Add other backend-generated fields */ >): Promise<Order> => {
  try {
    // Use apiClient
    const response = await apiClient.post('/orders', orderData);
    return response.data;
  } catch (error) {
    console.error('建立訂單失敗:', error);
    throw error;
  }
};

export const recordPayment = async (orderId: string, paymentData: { paymentMethod: string, amount: number, transactionId?: string }): Promise<Order> => {
  try {
    // Use apiClient
    const response = await apiClient.post(`/orders/${orderId}/payment`, paymentData);
    return response.data;
  } catch (error) {
    console.error('記錄支付失敗:', error);
    throw error;
  }
};

// Define a specific type for statistics if the structure is known, otherwise use Record<string, unknown>
export const getOrderStatistics = async (params?: { storeId?: string, from?: string, to?: string, groupBy?: string }): Promise<Record<string, unknown>> => {
  try {
    // Use apiClient
    const response = await apiClient.get<Record<string, unknown>>('/orders/stats', { params });
    return response.data;
  } catch (error) {
    console.error('獲取訂單統計失敗:', error);
    throw error;
  }
};

export const generateOrderReceipt = async (orderId: string): Promise<{ message: string, orderId: string, receiptUrl?: string }> => {
  try {
    // Use apiClient
    const response = await apiClient.post(`/orders/${orderId}/receipt/generate`);
    return response.data;
  } catch (error) {
    console.error('生成訂單收據失敗:', error);
    throw error;
  }
}; 