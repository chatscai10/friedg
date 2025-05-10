import axios from 'axios';
import { getAuthToken } from './authService';

const API_URL = process.env.REACT_APP_API_URL || 'https://api.example.com/api';

// 請假類型介面
export interface LeaveType {
  leaveTypeId: string;
  name: string;
  description: string;
  requiresApproval: boolean;
  tenantId?: string;
  affectsSalary?: boolean;
  maxDaysPerYear?: number;
  createdAt?: string;
  updatedAt?: string;
}

// 請假申請介面
export interface LeaveRequest {
  requestId: string;
  employeeId: string;
  employeeName?: string; // 前端顯示用，可能由後端提供或前端聯結
  storeId: string;
  storeName?: string; // 前端顯示用
  tenantId?: string;
  leaveTypeId: string;
  leaveTypeName?: string; // 前端顯示用
  startTime: string;
  endTime: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

// 分頁響應介面
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// 請假申請列表查詢參數
export interface ListLeaveRequestParams {
  employeeId?: string;
  storeId?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 獲取請假類型列表
 * @param tenantId 可選的租戶ID
 * @returns 請假類型列表
 */
export const listLeaveTypes = async (tenantId?: string): Promise<LeaveType[]> => {
  try {
    const token = await getAuthToken();
    const response = await axios.get(`${API_URL}/leave/types`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: tenantId ? { tenantId } : {}
    });
    return response.data.leaveTypes;
  } catch (error) {
    console.error('獲取請假類型列表失敗:', error);
    throw error;
  }
};

/**
 * 獲取請假申請列表
 * @param params 查詢參數
 * @returns 請假申請列表及分頁資訊
 */
export const listLeaveRequests = async (
  params?: ListLeaveRequestParams
): Promise<PaginatedResponse<LeaveRequest>> => {
  try {
    const token = await getAuthToken();
    const response = await axios.get(`${API_URL}/leave/requests`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params
    });
    
    // 轉換API響應為統一格式
    return {
      items: response.data.leaveRequests,
      pagination: {
        total: response.data.pagination?.total || 0,
        page: response.data.pagination?.page || 1,
        pageSize: response.data.pagination?.pageSize || 20,
        totalPages: Math.ceil((response.data.pagination?.total || 0) / (response.data.pagination?.pageSize || 20)),
        hasMore: response.data.pagination?.hasMore || false
      }
    };
  } catch (error) {
    console.error('獲取請假申請列表失敗:', error);
    throw error;
  }
};

/**
 * 更新請假申請狀態（審批/拒絕）
 * @param requestId 請假申請ID
 * @param newStatus 新狀態：approved或rejected
 * @param rejectionReason 拒絕原因（當newStatus為rejected時必須提供）
 * @returns 更新後的請假申請
 */
export const updateLeaveRequestStatus = async (
  requestId: string,
  newStatus: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<LeaveRequest> => {
  try {
    const token = await getAuthToken();
    
    // 構建請求數據
    const requestData: {
      newStatus: 'approved' | 'rejected';
      rejectionReason?: string;
    } = {
      newStatus
    };
    
    // 如果是拒絕，必須提供拒絕原因
    if (newStatus === 'rejected') {
      if (!rejectionReason) {
        throw new Error('拒絕請假申請時必須提供拒絕原因');
      }
      requestData.rejectionReason = rejectionReason;
    }
    
    const response = await axios.patch(
      `${API_URL}/leave/requests/${requestId}/status`,
      requestData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.leaveRequest;
  } catch (error) {
    console.error(`更新請假申請狀態失敗 (ID: ${requestId}):`, error);
    throw error;
  }
};

/**
 * 提交新的請假申請（主要用於員工端）
 * @param leaveData 請假數據
 * @returns 創建的請假申請
 */
export const createLeaveRequest = async (leaveData: {
  leaveTypeId: string;
  startTime: string;
  endTime: string;
  reason: string;
  storeId?: string;
}): Promise<LeaveRequest> => {
  try {
    const token = await getAuthToken();
    const response = await axios.post(`${API_URL}/leave/requests`, leaveData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.leaveRequest;
  } catch (error) {
    console.error('提交請假申請失敗:', error);
    throw error;
  }
}; 