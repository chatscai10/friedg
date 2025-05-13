import axios, { AxiosError } from 'axios';
import { 
  Role, 
  RolesResponse, 
  RoleResponse, 
  RoleRequest, 
  CreateRolePayload, 
  UpdateRolePayload, 
  RoleScope, 
  PermissionItem
} from '../types/role';
import { ApiError, ErrorResponse, ApiResponse } from '../types/api';

// API基础URL，应该配置在环境变量或者集中配置中
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/friedg-dev-new/asia-east1/api';

/**
 * Helper to create an ApiError from an AxiosError
 */
const createApiError = (error: AxiosError<ErrorResponse>, defaultMessage: string): ApiError => {
  if (error.response) {
    return new ApiError(
      error.response.status,
      error.response.data?.message || error.message || defaultMessage,
      error.response.data?.errors
    );
  }
  return new ApiError(500, error.message || defaultMessage);
};

/**
 * 获取工作区角色列表（专门用于管理界面）
 * @returns 工作区角色列表
 */
export const WorkspaceRoles = async (params?: { search?: string }): Promise<Role[]> => {
  try {
    const response = await fetchRoles({
      // 默认获取全局和当前租户的角色
      scope: 'all',
      limit: 100, // 获取足够多的角色以确保所有工作区角色都被加载
      search: params?.search
    });
    return response.data;
  } catch (error) {
    console.error('获取工作区角色列表失败:', error);
    throw error;
  }
};

/**
 * 获取角色列表 (支持分页、搜索、范围和状态过滤)
 * @param params 查询参数
 * @returns 角色列表响应 (RolesResponse)
 */
export const fetchRoles = async (params?: {
  scope?: RoleScope | 'all'; // 'all' can be a special case for fetching all scopes
  tenantId?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'deleted';
}): Promise<RolesResponse> => {
  try {
    const {
      page = 1,
      limit = 10,
      scope = 'all',
      search,
      status,
      tenantId,
    } = params || {}; // 解構參數並提供預設值

    const queryParams: Record<string, any> = {
      page,
      limit,
      scope: scope === 'all' ? undefined : scope,
      search: search || undefined,
      status: status || undefined,
      tenantId: tenantId || undefined,
    };
    // 清理 undefined 參數，避免它們出現在 URL 中
    Object.keys(queryParams).forEach(key => queryParams[key] === undefined && delete queryParams[key]);

    const response = await axios.get<RolesResponse>(`${API_BASE_URL}/v1/roles`, { params: queryParams });
    return response.data;
  } catch (error) {
    console.error('Error fetching roles:', error);
    throw createApiError(error as AxiosError<ErrorResponse>, '獲取角色列表失敗');
  }
};

/**
 * 获取单个角色详情
 * @param roleId 角色ID
 * @returns 角色详情响应 (RoleResponse)，其 data 属性为 Role 对象
 */
export const fetchRoleById = async (roleId: string): Promise<RoleResponse> => {
  if (!roleId) {
    throw new ApiError(400, '角色ID不能為空');
  }
  try {
    const response = await axios.get<RoleResponse>(`${API_BASE_URL}/v1/roles/${roleId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching role by ID ${roleId}:`, error);
    throw createApiError(error as AxiosError<ErrorResponse>, `獲取角色 (ID: ${roleId}) 詳情失敗`);
  }
};

/**
 * 创建新角色
 * @param roleData 角色创建数据 (CreateRolePayload)
 * @returns 创建的角色响应 (RoleResponse)，其 data 属性为新创建的 Role 对象
 */
export const createRole = async (roleData: CreateRolePayload): Promise<RoleResponse> => {
  try {
    const response = await axios.post<RoleResponse>(`${API_BASE_URL}/v1/roles`, roleData);
    return response.data;
  } catch (error) {
    console.error('Error creating role:', error);
    throw createApiError(error as AxiosError<ErrorResponse>, '創建角色失敗');
  }
};

/**
 * 更新现有角色
 * @param roleId 角色ID
 * @param roleData 角色更新数据 (UpdateRolePayload)
 * @returns 更新后的角色响应 (RoleResponse)，其 data 属性为更新后的 Role 对象
 */
export const updateRole = async (roleId: string, roleData: UpdateRolePayload): Promise<RoleResponse> => {
  if (!roleId) {
    throw new ApiError(400, '更新操作的角色ID不能為空');
  }
  try {
    const response = await axios.put<RoleResponse>(`${API_BASE_URL}/v1/roles/${roleId}`, roleData);
    return response.data;
  } catch (error) {
    console.error(`Error updating role ${roleId}:`, error);
    throw createApiError(error as AxiosError<ErrorResponse>, `更新角色 (ID: ${roleId}) 失敗`);
  }
};

/**
 * 逻辑删除角色 (通过更新角色状态为 'deleted')
 * @param roleId 角色ID
 * @returns 成功响应或 void
 */
export const deleteRole = async (roleId: string): Promise<ApiResponse<{ roleId: string; status: string }>> => {
  if (!roleId) {
    throw new ApiError(400, '刪除操作的角色ID不能為空');
  }
  try {
    // 根據 API 設計，邏輯刪除可能是 PUT 或 PATCH，並更新 status 字段
    // 假設 API 要求 PUT 並在 body 中傳遞 { status: 'deleted' }
    // 或者 API 有專門的 DELETE 端點執行邏輯刪除並返回特定結構
    // 此處示例為 PUT 請求更新 status
    const response = await axios.put<ApiResponse<{ roleId: string; status: string }>>(
        `${API_BASE_URL}/v1/roles/${roleId}/status`, 
        { status: 'deleted' }
    );
    // 如果 API 僅返回 200 OK 或 204 No Content，可以這樣構造返回：
    // await axios.put(`${API_BASE_URL}/v1/roles/${roleId}`, { status: 'deleted' });
    // return { status: 'success', message: `角色 ${roleId} 已被標記為刪除` };
    return response.data; // 假設後端返回類似 { status: 'success', data: { roleId, status: 'deleted' }, message: '...' }
  } catch (error) {
    console.error(`Error deleting role ${roleId}:`, error);
    throw createApiError(error as AxiosError<ErrorResponse>, `刪除角色 (ID: ${roleId}) 失敗`);
  }
};

// 指派角色給用戶
export const assignRoleToUser = async (userId: string, roleId: string): Promise<void> => {
  try {
    await axios.post(`${API_BASE_URL}/v1/users/${userId}/roles`, { roleId });
  } catch (error) {
    console.error(`指派角色給用戶失敗 (UserID: ${userId}, RoleID: ${roleId}):`, error);
    throw error;
  }
};

/**
 * 获取角色列表
 * @param params 筛选和分页参数
 * @returns 角色列表和分页信息
 */
export const getRoles = async (params?: {
  page?: number;
  limit?: number;
  query?: string;
  scope?: RoleScope;
  status?: 'active' | 'inactive' | 'deleted'; // 添加 status 筛选
}): Promise<RolesResponse> => {
  try {
    // 注意：这里的路径 `/roles` 需要与您的 Express 路由定义一致
    const response = await axios.get<RolesResponse>(`${API_BASE_URL}/v1/roles`, { params });
    // 假設 axios 返回的數據結構已經是 RolesResponse
    // 如果不是，這裡需要進行數據轉換
    return response.data;
  } catch (error: any) {
    console.error('Error fetching roles:', error);
    // 拋出標準化的錯誤
    throw new ApiError(error.response?.status || 500, error.response?.data?.message || error.message || '獲取角色列表失敗');
  }
};

/**
 * 获取單個角色詳情
 * @param roleId 角色ID
 * @returns 角色詳情
 */
export const getRoleById = async (roleId: string): Promise<RoleResponse> => {
  try {
    const response = await axios.get<RoleResponse>(`${API_BASE_URL}/v1/roles/${roleId}`);
    // 假設 axios 返回的數據結構已經是 RoleResponse
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching role ${roleId}:`, error);
    throw new ApiError(error.response?.status || 500, error.response?.data?.message || error.message || `獲取角色 ${roleId} 失敗`);
  }
};

/**
 * 創建角色
 * @param roleData 角色數據
 * @returns 創建後的角色詳情
 */
export const createRole = async (roleData: CreateRolePayload): Promise<RoleResponse> => {
  try {
    // 注意：這裡的路徑 `/roles` 需要與您的 Express 路由定義一致
    const response = await axios.post<RoleResponse>(`${API_BASE_URL}/v1/roles`, roleData);
    // 假設 axios 返回的數據結構已經是 RoleResponse
    return response.data;
  } catch (error: any) {
    console.error('Error creating role:', error);
    throw new ApiError(error.response?.status || 500, error.response?.data?.message || error.message || '創建角色失敗');
  }
};

/**
 * 更新角色
 * @param roleId 角色ID
 * @param roleData 更新數據
 * @returns 更新後的角色詳情
 */
export const updateRole = async (roleId: string, roleData: UpdateRolePayload): Promise<RoleResponse> => {
  try {
    const response = await axios.put<RoleResponse>(`${API_BASE_URL}/v1/roles/${roleId}`, roleData);
    // 假設 axios 返回的數據結構已經是 RoleResponse
    return response.data;
  } catch (error: any) {
    console.error(`Error updating role ${roleId}:`, error);
    throw new ApiError(error.response?.status || 500, error.response?.data?.message || error.message || `更新角色 ${roleId} 失敗`);
  }
};

/**
 * 刪除角色 (邏輯刪除)
 * @param roleId 角色ID
 * @returns 成功響應
 */
export const deleteRole = async (roleId: string): Promise<{ status: string; message?: string }> => {
  try {
    // 注意：這裡使用 PUT 而非 DELETE，因為是邏輯刪除，後端 API 可能設計為 PUT /roles/{roleId}/status
    // 或者 PUT /roles/{roleId} 並在 body 中傳遞 status: 'deleted'
    // 請根據您的後端 API 規格調整這裡的調用方式
    // 這裡假設後端是 PUT /roles/{roleId} 並在 body 中傳遞 { status: 'deleted' }
    const response = await axios.put<{ status: string; message?: string }>(`${API_BASE_URL}/v1/roles/${roleId}/status`, { status: 'deleted' });
    // 假設 axios 返回的數據結構包含 status 和 message
    return response.data;
  } catch (error: any) {
    console.error(`Error deleting role ${roleId}:`, error);
    throw new ApiError(error.response?.status || 500, error.response?.data?.message || error.message || `刪除角色 ${roleId} 失敗`);
  }
};

// 您可能還需要添加其他與角色相關的服務函數，例如：
// export const assignRoleToUser = async (userId: string, roleId: string): Promise<any> => { ... };
// export const removeRoleFromUser = async (userId: string, roleId: string): Promise<any> => { ... };

// 注意：上面的 axios 是一個 Mock 實現，實際使用時請替換為您的真實 HTTP 客戶端 