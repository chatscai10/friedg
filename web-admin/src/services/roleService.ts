import apiClient from './api'; // 引入API客戶端實例
import { Role, RoleScope } from '../types/role';

// 獲取角色列表的參數接口
export interface GetRolesParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  scope?: RoleScope;
  query?: string;
}

// 分頁響應接口
export interface RolesResponse {
  data: Role[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

// 獲取角色列表
export const getRoles = async (params?: GetRolesParams): Promise<RolesResponse> => {
  try {
    const response = await apiClient.get<RolesResponse>('/api/roles', { params });
    return response.data;
  } catch (error) {
    console.error('獲取角色列表失敗:', error);
    throw error;
  }
};

// 獲取單個角色詳情
export const getRoleById = async (id: string): Promise<Role> => {
  try {
    const response = await apiClient.get<Role>(`/api/roles/${id}`);
    return response.data;
  } catch (error) {
    console.error(`獲取角色詳情失敗 (ID: ${id}):`, error);
    throw error;
  }
};

// 創建新角色
export const createRole = async (roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> => {
  try {
    const response = await apiClient.post<Role>('/api/roles', roleData);
    return response.data;
  } catch (error) {
    console.error('創建角色失敗:', error);
    throw error;
  }
};

// 更新角色信息
export const updateRole = async (
  id: string,
  roleData: Partial<Omit<Role, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Role> => {
  try {
    const response = await apiClient.put<Role>(`/api/roles/${id}`, roleData);
    return response.data;
  } catch (error) {
    console.error(`更新角色失敗 (ID: ${id}):`, error);
    throw error;
  }
};

// 刪除角色
export const deleteRole = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(`/api/roles/${id}`);
  } catch (error) {
    console.error(`刪除角色失敗 (ID: ${id}):`, error);
    throw error;
  }
};

// 指派角色給用戶
export const assignRoleToUser = async (userId: string, roleId: string): Promise<void> => {
  try {
    await apiClient.post(`/api/users/${userId}/roles`, { roleId });
  } catch (error) {
    console.error(`指派角色給用戶失敗 (UserID: ${userId}, RoleID: ${roleId}):`, error);
    throw error;
  }
}; 