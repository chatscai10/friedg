import axios from 'axios';
import { Schedule, CreateScheduleRequest, UpdateScheduleRequest } from '../types/scheduling.types';
import { getAuthToken } from './authService';

const API_URL = process.env.REACT_APP_API_URL || 'https://api.example.com/api';

/**
 * 獲取排班列表
 * @param params 查詢參數（可選）
 * @returns 排班列表及分頁資訊
 */
export const listSchedules = async (params?: {
  storeId?: string;
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) => {
  try {
    const token = await getAuthToken();
    const response = await axios.get(`${API_URL}/schedules`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params
    });
    return response.data;
  } catch (error) {
    console.error('獲取排班列表失敗:', error);
    throw error;
  }
};

/**
 * 獲取單個排班詳情
 * @param scheduleId 排班ID
 * @returns 排班詳情
 */
export const getSchedule = async (scheduleId: string) => {
  try {
    const token = await getAuthToken();
    const response = await axios.get(`${API_URL}/schedules/${scheduleId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error(`獲取排班 ${scheduleId} 失敗:`, error);
    throw error;
  }
};

/**
 * 創建新排班
 * @param scheduleData 排班數據
 * @returns 創建的排班資訊
 */
export const createSchedule = async (scheduleData: CreateScheduleRequest) => {
  try {
    const token = await getAuthToken();
    const response = await axios.post(`${API_URL}/schedules`, scheduleData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('創建排班失敗:', error);
    throw error;
  }
};

/**
 * 更新排班
 * @param scheduleId 排班ID
 * @param scheduleData 更新的排班數據
 * @returns 更新後的排班資訊
 */
export const updateSchedule = async (scheduleId: string, scheduleData: UpdateScheduleRequest) => {
  try {
    const token = await getAuthToken();
    const response = await axios.put(`${API_URL}/schedules/${scheduleId}`, scheduleData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`更新排班 ${scheduleId} 失敗:`, error);
    throw error;
  }
};

/**
 * 刪除排班
 * @param scheduleId 排班ID
 * @returns 成功響應
 */
export const deleteSchedule = async (scheduleId: string) => {
  try {
    const token = await getAuthToken();
    const response = await axios.delete(`${API_URL}/schedules/${scheduleId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error(`刪除排班 ${scheduleId} 失敗:`, error);
    throw error;
  }
};

/**
 * 批量創建排班
 * @param schedulesData 多個排班數據
 * @returns 創建的排班列表
 */
export const bulkCreateSchedules = async (schedulesData: CreateScheduleRequest[]) => {
  try {
    const token = await getAuthToken();
    const response = await axios.post(`${API_URL}/schedules/bulk`, { schedules: schedulesData }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('批量創建排班失敗:', error);
    throw error;
  }
};

/**
 * 獲取可用的排班角色
 * @returns 排班角色列表
 */
export const getScheduleRoles = async () => {
  try {
    const token = await getAuthToken();
    const response = await axios.get(`${API_URL}/schedules/roles`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('獲取排班角色失敗:', error);
    throw error;
  }
}; 