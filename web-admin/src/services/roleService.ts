import axios from 'axios';
import { 
  Role, 
  RolesResponse, 
  RoleResponse, 
  RoleRequest, 
  CreateRolePayload, 
  UpdateRolePayload 
} from '../types/role';

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