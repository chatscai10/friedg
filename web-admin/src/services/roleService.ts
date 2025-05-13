import axios from 'axios';
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
import { ApiError } from '../types/api';

// API基础URL，应该配置在环境变量或者集中配置中
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

/**
 * 获取工作区角色列表（专门用于管理界面）
 * @returns 工作区角色列表
 */
export const WorkspaceRoles = async (): Promise<Role[]> => {
  try {
    const response = await fetchRoles({
      // 默认获取全局和当前租户的角色
      scope: 'all',
      limit: 100 // 获取足够多的角色以确保所有工作区角色都被加载
    });
    return response.data;
  } catch (error) {
    console.error('获取工作区角色列表失败:', error);
    throw error;
  }
};

/**
 * 获取角色列表
 * @param params 查询参数(可选)
 * @returns 角色列表响应
 */
export const fetchRoles = async (params?: {
  scope?: string;
  tenantId?: string;
  page?: number;
  limit?: number;
}) => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params?.scope) {
      queryParams.append('scope', params.scope);
    }
    
    if (params?.tenantId) {
      queryParams.append('tenantId', params.tenantId);
    }
    
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    
    if (params?.limit) {
      queryParams.append('limit', params.limit.toString());
    }
    
    const queryString = queryParams.toString();
    const url = `${API_BASE_URL}/v1/roles${queryString ? `?${queryString}` : ''}`;
    
    const response = await axios.get<RolesResponse>(url);
    return response.data;
  } catch (error) {
    console.error('获取角色列表失败:', error);
    throw error;
  }
};

/**
 * 获取单个角色详情
 * @param roleId 角色ID
 * @returns 角色详情响应
 */
export const fetchRoleById = async (roleId: string) => {
  try {
    const response = await axios.get<RoleResponse>(`${API_BASE_URL}/v1/roles/${roleId}`);
    return response.data;
  } catch (error) {
    console.error(`获取角色详情失败 (ID: ${roleId}):`, error);
    throw error;
  }
};

/**
 * 创建新角色
 * @param roleData 角色数据
 * @returns 创建的角色响应
 */
export const createRole = async (roleData: RoleRequest | CreateRolePayload) => {
  try {
    const response = await axios.post<RoleResponse>(`${API_BASE_URL}/v1/roles`, roleData);
    return response.data;
  } catch (error) {
    console.error('创建角色失败:', error);
    throw error;
  }
};

/**
 * 更新现有角色
 * @param roleId 角色ID
 * @param roleData 角色更新数据
 * @returns 更新后的角色响应
 */
export const updateRole = async (roleId: string, roleData: Partial<RoleRequest> | UpdateRolePayload) => {
  try {
    const response = await axios.put<RoleResponse>(`${API_BASE_URL}/v1/roles/${roleId}`, roleData);
    return response.data;
  } catch (error) {
    console.error(`更新角色失败 (ID: ${roleId}):`, error);
    throw error;
  }
};

/**
 * 删除角色
 * @param roleId 角色ID
 * @returns 删除响应
 */
export const deleteRole = async (roleId: string) => {
  try {
    const response = await axios.delete<{ status: string; message: string }>(`${API_BASE_URL}/v1/roles/${roleId}`);
    return response.data;
  } catch (error) {
    console.error(`删除角色失败 (ID: ${roleId}):`, error);
    throw error;
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