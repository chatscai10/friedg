import axios from 'axios';
import { 
  Store,
  StoresResponse,
  StoreResponse,
  FetchStoresParams,
  CreateStorePayload,
  UpdateStorePayload,
  UpdateStoreLocationPayload,
  UpdateStoreOperatingHoursPayload,
  UpdateStoreAttendanceSettingsPayload
} from '../types/store';

// API基礎URL，從環境變量獲取
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

/**
 * 獲取店鋪列表
 * @param params 查詢參數(可選)
 * @returns 店鋪列表響應
 */
export const fetchStores = async (params?: FetchStoresParams): Promise<StoresResponse> => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    
    if (params?.limit) {
      queryParams.append('limit', params.limit.toString());
    }
    
    if (params?.search) {
      queryParams.append('search', params.search);
    }
    
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    
    const queryString = queryParams.toString();
    const url = `${API_BASE_URL}/v1/stores${queryString ? `?${queryString}` : ''}`;
    
    const response = await axios.get<StoresResponse>(url);
    return response.data;
  } catch (error) {
    console.error('獲取店鋪列表失敗:', error);
    throw error;
  }
};

/**
 * 獲取單個店鋪詳情
 * @param storeId 店鋪ID
 * @returns 店鋪詳情響應
 */
export const fetchStoreById = async (storeId: string): Promise<StoreResponse> => {
  try {
    const response = await axios.get<StoreResponse>(`${API_BASE_URL}/v1/stores/${storeId}`);
    return response.data;
  } catch (error) {
    console.error(`獲取店鋪詳情失敗 (ID: ${storeId}):`, error);
    throw error;
  }
};

/**
 * 創建新店鋪
 * @param storeData 店鋪數據
 * @returns 創建的店鋪響應
 */
export const createStore = async (storeData: CreateStorePayload): Promise<StoreResponse> => {
  try {
    const response = await axios.post<StoreResponse>(`${API_BASE_URL}/v1/stores`, storeData);
    return response.data;
  } catch (error) {
    console.error('創建店鋪失敗:', error);
    throw error;
  }
};

/**
 * 更新店鋪基本信息
 * @param storeId 店鋪ID
 * @param storeData 店鋪更新數據
 * @returns 更新後的店鋪響應
 */
export const updateStore = async (storeId: string, storeData: UpdateStorePayload): Promise<StoreResponse> => {
  try {
    const response = await axios.put<StoreResponse>(`${API_BASE_URL}/v1/stores/${storeId}`, storeData);
    return response.data;
  } catch (error) {
    console.error(`更新店鋪失敗 (ID: ${storeId}):`, error);
    throw error;
  }
};

/**
 * 更新店鋪地理位置
 * @param storeId 店鋪ID
 * @param locationData 地理位置數據
 * @returns 更新後的店鋪響應
 */
export const updateStoreLocation = async (storeId: string, locationData: UpdateStoreLocationPayload): Promise<StoreResponse> => {
  try {
    const response = await axios.put<StoreResponse>(`${API_BASE_URL}/v1/stores/${storeId}/location`, locationData);
    return response.data;
  } catch (error) {
    console.error(`更新店鋪地理位置失敗 (ID: ${storeId}):`, error);
    throw error;
  }
};

/**
 * 更新店鋪營業時間
 * @param storeId 店鋪ID
 * @param hoursData 營業時間數據
 * @returns 更新後的店鋪響應
 */
export const updateStoreOperatingHours = async (storeId: string, hoursData: UpdateStoreOperatingHoursPayload): Promise<StoreResponse> => {
  try {
    const response = await axios.put<StoreResponse>(`${API_BASE_URL}/v1/stores/${storeId}/business-hours`, hoursData);
    return response.data;
  } catch (error) {
    console.error(`更新店鋪營業時間失敗 (ID: ${storeId}):`, error);
    throw error;
  }
};

/**
 * 更新店鋪考勤設定
 * @param storeId 店鋪ID
 * @param attendanceData 考勤設定數據
 * @returns 更新後的店鋪響應
 */
export const updateStoreAttendanceSettings = async (storeId: string, attendanceData: UpdateStoreAttendanceSettingsPayload): Promise<StoreResponse> => {
  try {
    const response = await axios.put<StoreResponse>(`${API_BASE_URL}/v1/stores/${storeId}/attendance-settings`, attendanceData);
    return response.data;
  } catch (error) {
    console.error(`更新店鋪考勤設定失敗 (ID: ${storeId}):`, error);
    throw error;
  }
};

/**
 * 刪除店鋪
 * @param storeId 店鋪ID
 * @returns 刪除響應
 */
export const deleteStore = async (storeId: string): Promise<{status: string; message: string}> => {
  try {
    const response = await axios.delete<{status: string; message: string}>(`${API_BASE_URL}/v1/stores/${storeId}`);
    return response.data;
  } catch (error) {
    console.error(`刪除店鋪失敗 (ID: ${storeId}):`, error);
    throw error;
  }
}; 