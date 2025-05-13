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

// 仮のAPIエラー型定義 (本来は共通ファイルからインポートすべき)
interface ErrorResponse {
  message: string;
  code?: string;
  details?: any;
}

export class ApiError extends Error {
  public code?: string;
  public details?: any;
  public statusCode?: number;

  constructor(message: string, statusCode?: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html#support-for-newtarget
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const createApiError = (error: any): ApiError => {
  if (axios.isAxiosError(error) && error.response) {
    const errorData = error.response.data as ErrorResponse;
    return new ApiError(
      errorData.message || error.message || 'An unknown API error occurred',
      error.response.status,
      errorData.code,
      errorData.details
    );
  }
  // 如果不是 Axios 错误，或者没有 response，则返回通用错误
  if (error instanceof Error) {
    return new ApiError(error.message || 'An unexpected error occurred');
  }
  return new ApiError('An unexpected error occurred');
};

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
    // console.error('獲取店鋪列表失敗:', error);
    throw createApiError(error); // 使用 '獲取店鋪列表失敗' 作為預設訊息，createApiError內部已有預設
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
    // console.error(`獲取店鋪詳情失敗 (ID: ${storeId}):`, error);
    throw createApiError(error); // 使用 '獲取店鋪詳情失敗'
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
    // console.error('創建店鋪失敗:', error);
    throw createApiError(error); // 使用 '創建店鋪失敗'
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
    // console.error(`更新店鋪失敗 (ID: ${storeId}):`, error);
    throw createApiError(error); // 使用 '更新店鋪基本信息失敗'
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
    // console.error(`更新店鋪地理位置失敗 (ID: ${storeId}):`, error);
    throw createApiError(error); // 使用 '更新店鋪地理位置失敗'
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
    // console.error(`更新店鋪營業時間失敗 (ID: ${storeId}):`, error);
    throw createApiError(error); // 使用 '更新店鋪營業時間失敗'
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
    // console.error(`更新店鋪考勤設定失敗 (ID: ${storeId}):`, error);
    throw createApiError(error); // 使用 '更新店鋪考勤設定失敗'
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
    // console.error(`刪除店鋪失敗 (ID: ${storeId}):`, error);
    throw createApiError(error); // 使用 '刪除店鋪失敗'
  }
};

/**
 * 根據 Tenant ID 獲取店鋪列表
 * @param tenantId 租戶ID
 * @returns 店鋪列表 (Store[])
 */
export const getStoresByTenantId = async (tenantId: string): Promise<Store[]> => {
  if (!tenantId) {
    throw new ApiError('Tenant ID is required to fetch stores.', 400, 'INVALID_ARGUMENT');
  }
  try {
    const response = await axios.get<StoresResponse>(`${API_BASE_URL}/v1/stores`, {
      params: { tenantId },
    });
    // 假設 StoresResponse 的 data 屬性是 Store[]，且API返回的 response.data 直接就是 StoresResponse
    // 如果 StoresResponse 結構是 { data: Store[], pagination: ... } 則需要返回 response.data.data
    // 根據用戶指示，我們返回 response.data.data
    if (response.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    // 如果 API 返回的格式與預期不符（例如，tenantId篩選時直接返回 Store[] 而不是 StoresResponse）
    // 這裡可以添加額外的判斷邏輯，或假設總是 StoresResponse 結構
    // 為簡化，如果 response.data.data 不是預期的數組，返回空數組或拋出錯誤
    console.warn('Unexpected response structure for getStoresByTenantId:', response.data);
    return []; // 或者拋出一個更具體的錯誤

  } catch (error) {
    throw createApiError(error);
  }
}; 