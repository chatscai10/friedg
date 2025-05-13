import axios, { AxiosError } from 'axios';
import { TenantItem } from '../types/tenant';
import { ApiError, ErrorResponse } from '../types/api'; // 假设 ErrorResponse 已在 types/api.ts 定义

// API 基础 URL，应该配置在环境变量或者集中配置中
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

// const MOCK_TENANTS_DATA: TenantItem[] = [
//   { id: 'tenant-001', name: '演示租戶 Alpha' },
//   { id: 'tenant-002', name: '測試公司 Beta' },
//   { id: 'tenant-003', name: '示例集團 Gamma' },
//   { id: 'tenant-004', name: 'FriedG 主租戶' },
// ];

/**
 * 辅助函数：从 AxiosError 创建 ApiError
 * (与 roleService.ts/permissionService.ts 中的版本保持一致)
 */
const createApiError = (error: AxiosError<ErrorResponse>, defaultMessage: string): ApiError => {
  if (error.response) {
    return new ApiError(
      error.response.status,
      error.response.data?.message || error.message || defaultMessage,
      error.response.data?.errors // 包含后端可能返回的详细错误
    );
  }
  // 如果没有 error.response (例如网络错误), 返回一个通用错误
  return new ApiError(500, error.message || defaultMessage);
};


/**
 * 獲取所有可用租戶列表
 * @returns Promise<TenantItem[]>
 */
export const getAllTenants = async (): Promise<TenantItem[]> => {
  try {
    const response = await axios.get<{ status?: string; data: TenantItem[]; message?: string } | TenantItem[]>(
      `${API_BASE_URL}/v1/tenants`
    );

    // 检查响应数据是否直接是 TenantItem[]
    if (Array.isArray(response.data)) {
      return response.data;
    }
    // 检查响应数据是否是 { data: TenantItem[] } 结构
    if (response.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    
    // 如果响应格式不符合预期
    console.warn('getAllTenants: API response format unexpected.', response.data);
    // 根据实际需求，可以返回空数组或抛出一个更具体的错误
    // return []; 
    throw new ApiError(500, '獲取租戶列表失敗：後端響應格式不正確');

  } catch (error) {
    console.error('Error fetching all tenants:', error);
    throw createApiError(error as AxiosError<ErrorResponse>, '獲取所有可用租戶列表失敗');
  }
}; 