import axios from 'axios';
import { 
  User, 
  UsersResponse, 
  UserResponse, 
  UpdateUserStatusPayload, 
  UpdateUserRolesPayload,
  CreateUserPayload,
  UpdateUserPayload
} from '../types/user.types';

// API基礎URL，應該配置在環境變量或者集中配置中
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

/**
 * 獲取工作區用戶列表（專門用於管理界面）
 * @returns 工作區用戶列表
 */
export const WorkspaceUsers = async (): Promise<User[]> => {
  try {
    const response = await fetchUsers({
      limit: 100 // 獲取足夠多的用戶以確保所有工作區用戶都被加載
    });
    return response.data;
  } catch (error) {
    console.error('獲取工作區用戶列表失敗:', error);
    throw error;
  }
};

/**
 * 獲取用戶列表
 * @param params 查詢參數(可選)
 * @returns 用戶列表響應
 */
export const fetchUsers = async (params?: {
  tenantId?: string;
  storeId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params?.tenantId) {
      queryParams.append('tenantId', params.tenantId);
    }
    
    if (params?.storeId) {
      queryParams.append('storeId', params.storeId);
    }
    
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    
    if (params?.limit) {
      queryParams.append('limit', params.limit.toString());
    }
    
    const queryString = queryParams.toString();
    const url = `${API_BASE_URL}/v1/users${queryString ? `?${queryString}` : ''}`;
    
    const response = await axios.get<UsersResponse>(url);
    return response.data;
  } catch (error) {
    console.error('獲取用戶列表失敗:', error);
    throw error;
  }
};

/**
 * 獲取單個用戶詳情
 * @param userId 用戶ID
 * @returns 用戶詳情響應
 */
export const fetchUserById = async (userId: string) => {
  try {
    const response = await axios.get<UserResponse>(`${API_BASE_URL}/v1/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`獲取用戶詳情失敗 (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * 更新用戶狀態
 * @param userId 用戶ID
 * @param statusData 狀態更新數據
 * @returns 更新後的用戶響應
 */
export const updateUserStatus = async (userId: string, statusData: UpdateUserStatusPayload) => {
  try {
    const response = await axios.put<UserResponse>(`${API_BASE_URL}/v1/users/${userId}/status`, statusData);
    return response.data;
  } catch (error) {
    console.error(`更新用戶狀態失敗 (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * 更新用戶角色
 * @param userId 用戶ID
 * @param roleData 角色更新數據
 * @returns 更新後的用戶響應
 */
export const updateUserRoles = async (userId: string, roleData: UpdateUserRolesPayload) => {
  try {
    const response = await axios.put<UserResponse>(`${API_BASE_URL}/v1/users/${userId}/roles`, roleData);
    return response.data;
  } catch (error) {
    console.error(`更新用戶角色失敗 (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * 創建新用戶
 * @param payload 創建用戶的數據
 * @returns 創建後的用戶響應
 */
export const createUser = async (payload: CreateUserPayload) => {
  try {
    const response = await axios.post<UserResponse>(`${API_BASE_URL}/v1/users`, payload);
    return response.data;
  } catch (error) {
    console.error('創建用戶失敗:', error);
    throw error;
  }
};

/**
 * 更新用戶基本資料
 * @param userId 用戶ID
 * @param payload 基本資料更新數據
 * @returns 更新後的用戶響應
 */
export const updateUser = async (userId: string, payload: UpdateUserPayload) => {
  try {
    const response = await axios.put<UserResponse>(`${API_BASE_URL}/v1/users/${userId}`, payload);
    return response.data;
  } catch (error) {
    console.error(`更新用戶資料失敗 (ID: ${userId}):`, error);
    throw error;
  }
}; 