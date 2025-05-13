import axios from 'axios';
import { API_BASE_URL } from '../config';
import { CustomerNote, UserProfile } from '../types/user.types';

// 客戶篩選條件接口
export interface CustomerFilters {
  query?: string;
  tags?: string[];
  minTotalSpent?: number;
  maxTotalSpent?: number;
  minOrderCount?: number;
  status?: 'active' | 'inactive' | 'blocked';
  membershipTier?: string;
  source?: string;
  lastActivityDateStart?: string;
  lastActivityDateEnd?: string;
  limit?: number;
  cursor?: string;
}

/**
 * 獲取客戶列表
 * @param filters 篩選條件
 * @returns 客戶列表數據、下一頁游標和總數
 */
export const listCustomers = async (filters: CustomerFilters = {}) => {
  try {
    // 構建查詢參數
    const params = new URLSearchParams();
    
    if (filters.query) params.append('query', filters.query);
    if (filters.tags && filters.tags.length > 0) params.append('tags', filters.tags.join(','));
    if (filters.minTotalSpent) params.append('minTotalSpent', filters.minTotalSpent.toString());
    if (filters.maxTotalSpent) params.append('maxTotalSpent', filters.maxTotalSpent.toString());
    if (filters.minOrderCount) params.append('minOrderCount', filters.minOrderCount.toString());
    if (filters.status) params.append('status', filters.status);
    if (filters.membershipTier) params.append('membershipTier', filters.membershipTier);
    if (filters.source) params.append('source', filters.source);
    if (filters.lastActivityDateStart) params.append('lastActivityDateStart', filters.lastActivityDateStart);
    if (filters.lastActivityDateEnd) params.append('lastActivityDateEnd', filters.lastActivityDateEnd);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.cursor) params.append('cursor', filters.cursor);

    const response = await axios.get(`${API_BASE_URL}/api/crm/customers`, { params });

    return response.data.data;
  } catch (error) {
    console.error('獲取客戶列表失敗', error);
    throw error;
  }
};

/**
 * 獲取客戶詳情
 * @param customerId 客戶 ID
 * @returns 客戶詳情
 */
export const getCustomerById = async (customerId: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/crm/customers/${customerId}`);
    return response.data.data;
  } catch (error) {
    console.error(`獲取客戶 ${customerId} 詳情失敗`, error);
    throw error;
  }
};

/**
 * 更新客戶資料
 * @param customerId 客戶 ID
 * @param data 要更新的資料
 * @returns 更新後的客戶資料
 */
export const updateCustomer = async (customerId: string, data: Partial<UserProfile>) => {
  try {
    const response = await axios.patch(`${API_BASE_URL}/api/crm/customers/${customerId}`, data);
    return response.data.data;
  } catch (error) {
    console.error(`更新客戶 ${customerId} 資料失敗`, error);
    throw error;
  }
};

/**
 * 向客戶添加標籤
 * @param customerId 客戶 ID
 * @param tag 標籤名稱
 * @returns 成功訊息
 */
export const addTag = async (customerId: string, tag: string) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/crm/customers/${customerId}/tags`, { tag });
    return response.data;
  } catch (error) {
    console.error(`向客戶 ${customerId} 添加標籤失敗`, error);
    throw error;
  }
};

/**
 * 從客戶移除標籤
 * @param customerId 客戶 ID
 * @param tag 標籤名稱
 * @returns 成功訊息
 */
export const removeTag = async (customerId: string, tag: string) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/api/crm/customers/${customerId}/tags/${tag}`);
    return response.data;
  } catch (error) {
    console.error(`從客戶 ${customerId} 移除標籤失敗`, error);
    throw error;
  }
};

/**
 * 向客戶添加備註
 * @param customerId 客戶 ID
 * @param noteData 備註數據
 * @returns 添加的備註
 */
export const addNote = async (customerId: string, noteData: { text: string; isImportant?: boolean }) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/crm/customers/${customerId}/notes`, noteData);
    return response.data.data;
  } catch (error) {
    console.error(`向客戶 ${customerId} 添加備註失敗`, error);
    throw error;
  }
};

/**
 * 獲取客戶備註
 * @param customerId 客戶 ID
 * @param limit 限制數量
 * @returns 備註列表
 */
export const getNotes = async (customerId: string, limit?: number) => {
  try {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    
    const response = await axios.get(`${API_BASE_URL}/api/crm/customers/${customerId}/notes`, { params });
    return response.data.data;
  } catch (error) {
    console.error(`獲取客戶 ${customerId} 備註失敗`, error);
    throw error;
  }
}; 