import apiClient from './api'; // 引入API客戶端實例
import { Store, StoreStatus } from '../types/store';

// 獲取分店列表的參數接口
export interface GetStoresParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  status?: StoreStatus;
  tenantId?: string;
  query?: string;
}

// 分頁響應接口
export interface StoresResponse {
  data: Store[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

// 獲取分店列表
export const getStores = async (params?: GetStoresParams): Promise<StoresResponse> => {
  try {
    const response = await apiClient.get<StoresResponse>('/api/stores', { params });
    return response.data;
  } catch (error) {
    console.error('獲取分店列表失敗:', error);
    throw error;
  }
};

// 獲取單個分店詳情
export const getStoreById = async (id: string): Promise<Store> => {
  try {
    const response = await apiClient.get<Store>(`/api/stores/${id}`);
    return response.data;
  } catch (error) {
    console.error(`獲取分店詳情失敗 (ID: ${id}):`, error);
    throw error;
  }
};

// 創建新分店
export const createStore = async (storeData: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>): Promise<Store> => {
  try {
    const response = await apiClient.post<Store>('/api/stores', storeData);
    return response.data;
  } catch (error) {
    console.error('創建分店失敗:', error);
    throw error;
  }
};

// 更新分店信息
export const updateStore = async (
  id: string, 
  storeData: Partial<Omit<Store, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Store> => {
  try {
    const response = await apiClient.put<Store>(`/api/stores/${id}`, storeData);
    return response.data;
  } catch (error) {
    console.error(`更新分店失敗 (ID: ${id}):`, error);
    throw error;
  }
};

// 刪除分店
export const deleteStore = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(`/api/stores/${id}`);
  } catch (error) {
    console.error(`刪除分店失敗 (ID: ${id}):`, error);
    throw error;
  }
};

// 變更分店狀態
export const updateStoreStatus = async (id: string, status: StoreStatus): Promise<Store> => {
  try {
    const response = await apiClient.patch<Store>(`/api/stores/${id}/status`, { status });
    return response.data;
  } catch (error) {
    console.error(`變更分店狀態失敗 (ID: ${id}):`, error);
    throw error;
  }
};

// 為兼容性添加的默認導出
const storeService = {
  getStores,
  getStoreById,
  createStore,
  updateStore,
  deleteStore,
  updateStoreStatus
};

export default storeService; 