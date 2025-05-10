import apiClient from './api';
import {
  InventoryItem,
  CreateInventoryItemRequest,
  UpdateInventoryItemRequest,
  InventoryItemsFilter,
  ApiResponse,
  PaginatedResponse,
  StockLevel,
  UpsertStockLevelRequest,
  StockAdjustment,
  CreateStockAdjustmentRequest,
  StockAdjustmentsFilter
} from '../types/inventory.types';

// API端點 - 相對路徑
const API_ENDPOINTS = {
  INVENTORY_ITEMS: '/api/inventory/items',
  INVENTORY_STOCK_LEVELS: '/api/inventory/stock-levels',
  INVENTORY_ADJUSTMENTS: '/api/inventory/adjustments'
};

/**
 * 獲取庫存品項列表
 * @param filters 過濾條件
 * @returns 庫存品項列表（分頁）
 */
export const getInventoryItems = async (filters?: InventoryItemsFilter): Promise<PaginatedResponse<InventoryItem>> => {
  try {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<InventoryItem>>>(
      API_ENDPOINTS.INVENTORY_ITEMS,
      { params: filters }
    );
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '獲取庫存品項列表失敗');
    }
    
    return response.data.data;
  } catch (error) {
    console.error('獲取庫存品項列表失敗:', error);
    throw error;
  }
};

/**
 * 根據ID獲取庫存品項詳情
 * @param itemId 品項ID
 * @param storeId 可選，特定分店ID
 * @returns 庫存品項詳情
 */
export const getInventoryItemById = async (itemId: string, storeId?: string): Promise<InventoryItem> => {
  try {
    const params = storeId ? { storeId } : undefined;
    const response = await apiClient.get<ApiResponse<InventoryItem>>(
      `${API_ENDPOINTS.INVENTORY_ITEMS}/${itemId}`,
      { params }
    );
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || `獲取庫存品項(ID: ${itemId})失敗`);
    }
    
    return response.data.data;
  } catch (error) {
    console.error(`獲取庫存品項(ID: ${itemId})失敗:`, error);
    throw error;
  }
};

/**
 * 創建新庫存品項
 * @param itemData 庫存品項數據
 * @returns 創建的庫存品項
 */
export const createInventoryItem = async (itemData: CreateInventoryItemRequest): Promise<InventoryItem> => {
  try {
    const response = await apiClient.post<ApiResponse<InventoryItem>>(
      API_ENDPOINTS.INVENTORY_ITEMS,
      itemData
    );
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '創建庫存品項失敗');
    }
    
    return response.data.data;
  } catch (error) {
    console.error('創建庫存品項失敗:', error);
    throw error;
  }
};

/**
 * 更新庫存品項
 * @param itemId 品項ID
 * @param itemData 更新的數據
 * @returns 更新後的庫存品項
 */
export const updateInventoryItem = async (itemId: string, itemData: UpdateInventoryItemRequest): Promise<InventoryItem> => {
  try {
    const response = await apiClient.put<ApiResponse<InventoryItem>>(
      `${API_ENDPOINTS.INVENTORY_ITEMS}/${itemId}`,
      itemData
    );
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || `更新庫存品項(ID: ${itemId})失敗`);
    }
    
    return response.data.data;
  } catch (error) {
    console.error(`更新庫存品項(ID: ${itemId})失敗:`, error);
    throw error;
  }
};

/**
 * 刪除庫存品項 (軟刪除)
 * @param itemId 品項ID
 * @returns 操作結果
 */
export const deleteInventoryItem = async (itemId: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `${API_ENDPOINTS.INVENTORY_ITEMS}/${itemId}`
    );
    
    if (!response.data.success) {
      throw new Error(response.data.error || `刪除庫存品項(ID: ${itemId})失敗`);
    }
    
    return {
      success: true,
      message: response.data.data?.message || '庫存品項已成功標記為不活躍'
    };
  } catch (error) {
    console.error(`刪除庫存品項(ID: ${itemId})失敗:`, error);
    throw error;
  }
};

/**
 * 設置或更新特定分店的庫存水平
 * @param itemId 品項ID
 * @param storeId 分店ID
 * @param stockData 庫存數據
 * @returns 更新後的庫存水平
 */
export const upsertStockLevel = async (
  itemId: string,
  storeId: string,
  stockData: UpsertStockLevelRequest
): Promise<StockLevel> => {
  try {
    const response = await apiClient.put<ApiResponse<StockLevel>>(
      `${API_ENDPOINTS.INVENTORY_ITEMS}/${itemId}/stock-levels/${storeId}`,
      stockData
    );
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '更新庫存水平失敗');
    }
    
    return response.data.data;
  } catch (error) {
    console.error('更新庫存水平失敗:', error);
    throw error;
  }
};

/**
 * 獲取特定分店的所有庫存水平
 * @param storeId 分店ID
 * @param filters 過濾條件
 * @returns 庫存水平列表
 */
export const getStoreStockLevels = async (
  storeId: string,
  filters?: {
    category?: string;
    name?: string;
    lowStock?: boolean;
    page?: number;
    pageSize?: number;
  }
): Promise<PaginatedResponse<StockLevel & { item: Partial<InventoryItem> }>> => {
  try {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<StockLevel & { item: Partial<InventoryItem> }>>>(
      `${API_ENDPOINTS.INVENTORY_STOCK_LEVELS}/${storeId}`,
      { params: filters }
    );
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || `獲取分店(ID: ${storeId})庫存水平失敗`);
    }
    
    return response.data.data;
  } catch (error) {
    console.error(`獲取分店(ID: ${storeId})庫存水平失敗:`, error);
    throw error;
  }
};

/**
 * 獲取庫存調整記錄列表
 * @param filters 過濾條件
 * @returns 庫存調整記錄列表（分頁）
 */
export const getStockAdjustments = async (filters?: StockAdjustmentsFilter): Promise<PaginatedResponse<StockAdjustment>> => {
  try {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<StockAdjustment>>>(
      API_ENDPOINTS.INVENTORY_ADJUSTMENTS,
      { params: filters }
    );
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '獲取庫存調整記錄列表失敗');
    }
    
    return response.data.data;
  } catch (error) {
    console.error('獲取庫存調整記錄列表失敗:', error);
    throw error;
  }
};

/**
 * 創建庫存調整記錄
 * @param adjustmentData 庫存調整記錄數據
 * @returns 創建的庫存調整記錄
 */
export const createStockAdjustment = async (adjustmentData: CreateStockAdjustmentRequest): Promise<StockAdjustment> => {
  try {
    const response = await apiClient.post<ApiResponse<StockAdjustment>>(
      API_ENDPOINTS.INVENTORY_ADJUSTMENTS,
      adjustmentData
    );
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '創建庫存調整記錄失敗');
    }
    
    return response.data.data;
  } catch (error) {
    console.error('創建庫存調整記錄失敗:', error);
    throw error;
  }
};

/**
 * 獲取特定品項在特定分店的庫存水平
 * @param itemId 品項ID
 * @param storeId 分店ID
 * @returns 庫存水平資訊
 */
export const getStockLevelForItemInStore = async (itemId: string, storeId: string): Promise<StockLevel> => {
  try {
    const response = await apiClient.get<ApiResponse<StockLevel>>(
      `${API_ENDPOINTS.INVENTORY_ITEMS}/${itemId}/stock-levels/${storeId}`
    );
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '獲取庫存水平失敗');
    }
    
    return response.data.data;
  } catch (error) {
    console.error('獲取庫存水平失敗:', error);
    throw error;
  }
}; 