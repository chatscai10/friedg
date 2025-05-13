import axios, { AxiosError } from 'axios';
import { PermissionItem } from '../types/permission'; // 从新的类型文件导入
import { ApiError, ErrorResponse } from '../types/api'; // 假设 ErrorResponse 已在 types/api.ts 定义

// API 基础 URL，应该配置在环境变量或者集中配置中
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

// 模拟的权限数据 (用于开发和测试，API 就绪后移除)
const MOCK_PERMISSIONS_DATA: PermissionItem[] = [
  { id: 'users:read', name: '查看用戶', resourceType: 'users', action: 'read', description: '允許查看用戶列表和用戶詳情' },
  { id: 'users:create', name: '創建用戶', resourceType: 'users', action: 'create', description: '允許創建新用戶' },
  { id: 'users:update', name: '更新用戶', resourceType: 'users', action: 'update', description: '允許編輯現有用戶信息' },
  { id: 'users:delete', name: '刪除用戶', resourceType: 'users', action: 'delete', description: '允許刪除用戶' },
  { id: 'orders:read', name: '查看訂單', resourceType: 'orders', action: 'read', description: '允許查看訂單列表和訂單詳情' },
  { id: 'orders:update_status', name: '更新訂單狀態', resourceType: 'orders', action: 'update_status', description: '允許修改訂單的狀態' },
  { id: 'products:manage', name: '管理商品', resourceType: 'products', action: 'manage', description: '允許創建、編輯、刪除商品 (manage 通常涵蓋 CRUD)' },
  { id: 'inventory:adjust', name: '調整庫存', resourceType: 'inventory', action: 'adjust', description: '允許創建庫存調整單' },
  { id: 'reports:view_sales', name: '查看銷售報表', resourceType: 'reports', action: 'view_sales', description: '允許查看銷售相關報表' },
];

/**
 * 辅助函数：从 AxiosError 创建 ApiError
 * (与 roleService.ts 中的版本保持一致)
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
 * 获取系统中所有可用的权限列表
 * @returns Promise<PermissionItem[]>
 */
export const getAllPermissions = async (): Promise<PermissionItem[]> => {
  try {
    const response = await axios.get<{ status?: string; data: PermissionItem[]; message?: string } | PermissionItem[]>(
      `${API_BASE_URL}/v1/permissions`
    );

    // 检查响应数据是否直接是 PermissionItem[]
    if (Array.isArray(response.data)) {
      return response.data;
    }
    // 检查响应数据是否是 { data: PermissionItem[] } 结构
    if (response.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    
    // 如果响应格式不符合预期
    console.warn('getAllPermissions: API response format unexpected.', response.data);
    // 根据实际需求，可以返回空数组或抛出一个更具体的错误
    // return []; 
    throw new ApiError(500, '獲取權限列表失敗：後端響應格式不正確');

  } catch (error) {
    console.error('Error fetching all permissions:', error);
    throw createApiError(error as AxiosError<ErrorResponse>, '獲取所有可用權限列表失敗');
  }
}; 