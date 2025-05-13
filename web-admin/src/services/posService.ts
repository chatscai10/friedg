import apiClient from './api';
import { Order, OrderItem } from '../types/order';

// API 端點
const API_ENDPOINTS = {
  ORDERS: '/orders',
  PRINT_ORDER: '/printing/orders',
  CALL_NUMBER: '/orders/notify'
};

// 創建訂單請求
interface CreateOrderRequest {
  storeId: string;
  orderType: 'dine-in' | 'takeout' | 'delivery';
  items: OrderItem[];
  tableNumber?: string;
  note?: string;
  customerId?: string;
  paymentMethod?: 'cash' | 'linepay' | 'creditcard';
}

// 創建訂單響應
interface CreateOrderResponse {
  id: string;
  orderNumber: string;
  status: string;
  totalPrice: number;
  createdAt: string;
}

// 列印請求
interface PrintOrderRequest {
  orderId: string;
  printerType?: 'receipt' | 'kitchen';
}

// 列印響應
interface PrintOrderResponse {
  success: boolean;
  printJobId?: string;
  message?: string;
}

// 叫號請求
interface CallNumberRequest {
  orderId: string;
  displayName?: string;
}

// 叫號響應
interface CallNumberResponse {
  success: boolean;
  message?: string;
}

// 是否使用模擬數據
const isMockDataEnabled = () => {
  return localStorage.getItem('testUserLoggedIn') === 'true' ||
    localStorage.getItem('isTestUser') === 'true' ||
    window.location.search.includes('testMode=true') ||
    import.meta.env.VITE_USE_MOCK_DATA === 'true';
};

/**
 * 創建新訂單
 * @param orderData 訂單數據
 * @returns 創建的訂單信息
 */
export const createOrder = async (orderData: CreateOrderRequest): Promise<CreateOrderResponse> => {
  try {
    const response = await apiClient.post<CreateOrderResponse>(
      API_ENDPOINTS.ORDERS,
      orderData
    );
    return response.data;
  } catch (error) {
    console.error('創建訂單失敗:', error);
    throw error;
  }
};

/**
 * 發送列印訂單請求
 * @param printData 列印請求數據
 * @returns 列印工作信息
 */
export const printOrder = async (printData: PrintOrderRequest): Promise<PrintOrderResponse> => {
  try {
    const response = await apiClient.post<PrintOrderResponse>(
      API_ENDPOINTS.PRINT_ORDER,
      printData
    );
    return response.data;
  } catch (error) {
    console.error('列印訂單失敗:', error);
    throw error;
  }
};

/**
 * 發送叫號請求
 * @param callData 叫號請求數據
 * @returns 叫號結果
 */
export const callOrderNumber = async (callData: CallNumberRequest): Promise<CallNumberResponse> => {
  try {
    const response = await apiClient.post<CallNumberResponse>(
      API_ENDPOINTS.CALL_NUMBER,
      callData
    );
    return response.data;
  } catch (error) {
    console.error('叫號失敗:', error);
    throw error;
  }
};

/**
 * 獲取訂單詳情
 * @param orderId 訂單ID
 * @returns 訂單詳情
 */
export const getOrderById = async (orderId: string) => {
  try {
    const response = await apiClient.get(`${API_ENDPOINTS.ORDERS}/${orderId}`);
    return response.data;
  } catch (error) {
    console.error(`獲取訂單(ID: ${orderId})失敗:`, error);
    throw error;
  }
};

/**
 * 更新訂單狀態
 * @param orderId 訂單ID
 * @param status 新狀態
 * @returns 更新後的訂單
 */
export const updateOrderStatus = async (orderId: string, status: string) => {
  try {
    const response = await apiClient.patch(`${API_ENDPOINTS.ORDERS}/${orderId}/status`, { status });
    return response.data;
  } catch (error) {
    console.error(`更新訂單狀態(ID: ${orderId})失敗:`, error);
    throw error;
  }
};

/**
 * 創建新訂單 (從 POS 介面)
 * 
 * @param orderData 訂單數據
 * @returns 新創建的訂單
 */
export const createPosOrder = async (orderData: Partial<Order>): Promise<Order> => {
  try {
    // 確保必要欄位已設置
    const fullOrderData = {
      ...orderData,
      storeId: orderData.storeId || 'default_store',
      status: 'pending'
    };
    
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務創建 POS 訂單');
      // 模擬 API 回傳
      return {
        id: `order_${Date.now()}`,
        orderNumber: `POS-${Math.floor(Math.random() * 10000)}`,
        ...fullOrderData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Order;
    }
    
    // 使用真實 API
    const response = await apiClient.post<Order>('/orders', fullOrderData);
    return response.data;
  } catch (error) {
    console.error('創建 POS 訂單失敗:', error);
    throw error;
  }
};

/**
 * 請求列印訂單收據
 * 
 * @param orderId 訂單 ID
 * @returns 列印結果
 */
export const printOrderReceipt = async (orderId: string): Promise<{ success: boolean; message: string }> => {
  try {
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務列印訂單收據');
      // 模擬 API 回傳
      return {
        success: true,
        message: '列印請求已發送至收銀機'
      };
    }
    
    // 使用真實 API
    const response = await apiClient.post<{ success: boolean; message: string }>(`/pos/orders/${orderId}/print`);
    return response.data;
  } catch (error) {
    console.error(`請求列印訂單收據失敗 (訂單ID: ${orderId}):`, error);
    throw error;
  }
};

/**
 * 請求叫號 (通知顧客取餐)
 * 
 * @param storeId 商店 ID
 * @param pickupNumber 取餐號碼
 * @returns 叫號結果
 */
export const callPickupNumber = async (
  storeId: string,
  pickupNumber: string
): Promise<{ success: boolean; message: string }> => {
  try {
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務叫號');
      // 模擬 API 回傳
      return {
        success: true,
        message: `號碼 ${pickupNumber} 叫號成功`
      };
    }
    
    // 使用真實 API
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/pickup/stores/${storeId}/call`,
      { pickupNumber }
    );
    return response.data;
  } catch (error) {
    console.error(`叫號請求失敗 (storeId: ${storeId}, pickupNumber: ${pickupNumber}):`, error);
    throw error;
  }
};

/**
 * 保存訂單 (暫存)
 * 
 * @param orderData 訂單數據
 * @returns 保存結果
 */
export const saveOrderDraft = async (orderData: Partial<Order>): Promise<{ success: boolean; draftId: string; message: string }> => {
  try {
    // 這個功能可能是本地實現，但這裡提供一個API版本
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務保存訂單草稿');
      return {
        success: true,
        draftId: `draft_${Date.now()}`,
        message: '訂單已暫存'
      };
    }
    
    // 使用真實 API
    const response = await apiClient.post<{ success: boolean; draftId: string; message: string }>(
      '/pos/drafts',
      orderData
    );
    return response.data;
  } catch (error) {
    console.error('保存訂單草稿失敗:', error);
    throw error;
  }
};

/**
 * 獲取已保存的訂單草稿列表
 * 
 * @param storeId 商店 ID
 * @returns 訂單草稿列表
 */
export const getOrderDrafts = async (storeId: string): Promise<Array<{ draftId: string; orderData: Partial<Order>; savedAt: string }>> => {
  try {
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務獲取訂單草稿列表');
      return [
        {
          draftId: `draft_1`,
          orderData: {
            orderType: 'dine-in',
            items: [{ menuItemId: 'item1', menuItemName: '招牌雞排', quantity: 1, totalPrice: 85 }],
            subtotal: 85,
            totalPrice: 85
          },
          savedAt: new Date(Date.now() - 30 * 60000).toISOString() // 30 分鐘前
        },
        {
          draftId: `draft_2`,
          orderData: {
            orderType: 'takeout',
            items: [{ menuItemId: 'item2', menuItemName: '珍珠奶茶', quantity: 2, totalPrice: 120 }],
            subtotal: 120,
            totalPrice: 120
          },
          savedAt: new Date(Date.now() - 2 * 60 * 60000).toISOString() // 2 小時前
        }
      ];
    }
    
    // 使用真實 API
    const response = await apiClient.get<Array<{ draftId: string; orderData: Partial<Order>; savedAt: string }>>(
      `/pos/stores/${storeId}/drafts`
    );
    return response.data;
  } catch (error) {
    console.error(`獲取訂單草稿列表失敗 (storeId: ${storeId}):`, error);
    throw error;
  }
};

/**
 * 獲取訂單草稿詳情
 * 
 * @param draftId 草稿 ID
 * @returns 訂單草稿詳情
 */
export const getOrderDraftById = async (draftId: string): Promise<{ draftId: string; orderData: Partial<Order>; savedAt: string }> => {
  try {
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務獲取訂單草稿詳情');
      return {
        draftId,
        orderData: {
          orderType: 'dine-in',
          items: [{ menuItemId: 'item1', menuItemName: '招牌雞排', quantity: 1, totalPrice: 85 }],
          subtotal: 85,
          totalPrice: 85
        },
        savedAt: new Date(Date.now() - 30 * 60000).toISOString() // 30 分鐘前
      };
    }
    
    // 使用真實 API
    const response = await apiClient.get<{ draftId: string; orderData: Partial<Order>; savedAt: string }>(
      `/pos/drafts/${draftId}`
    );
    return response.data;
  } catch (error) {
    console.error(`獲取訂單草稿詳情失敗 (draftId: ${draftId}):`, error);
    throw error;
  }
};

/**
 * 刪除訂單草稿
 * 
 * @param draftId 草稿 ID
 * @returns 刪除結果
 */
export const deleteOrderDraft = async (draftId: string): Promise<{ success: boolean; message: string }> => {
  try {
    if (isMockDataEnabled()) {
      console.log('使用模擬數據服務刪除訂單草稿');
      return {
        success: true,
        message: '訂單草稿已刪除'
      };
    }
    
    // 使用真實 API
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/pos/drafts/${draftId}`
    );
    return response.data;
  } catch (error) {
    console.error(`刪除訂單草稿失敗 (draftId: ${draftId}):`, error);
    throw error;
  }
}; 