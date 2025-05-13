import { firestore } from 'firebase-admin';
import { z } from 'zod';
import { Coordinates } from '../../src/types/core-params';

/**
 * 打卡請求基本結構
 */
export interface ClockRequest {
  latitude: number;            // 緯度 (必填)
  longitude: number;           // 經度 (必填)
  deviceInfo?: {               // 設備資訊 (選填)
    deviceId?: string;         // 設備 ID
    platform?: string;         // 平台 (iOS/Android/Web)
    model?: string;            // 設備型號
    osVersion?: string;        // 操作系統版本
  };
  notes?: string;              // 備註 (選填)
}

/**
 * 打上班卡請求 - 與基本打卡請求結構相同
 */
export type ClockInRequest = ClockRequest;

/**
 * 打下班卡請求 - 與基本打卡請求結構相同
 */
export type ClockOutRequest = ClockRequest;

/**
 * 出勤狀態枚舉
 */
export enum AttendanceStatus {
  CLOCKED_IN = 'CLOCKED_IN',                   // 已打上班卡
  CLOCKED_OUT = 'CLOCKED_OUT',                 // 已打下班卡
  LATE_CLOCK_IN = 'LATE_CLOCK_IN',             // 遲到打卡
  EARLY_CLOCK_OUT = 'EARLY_CLOCK_OUT',         // 早退打卡
  INVALID_LOCATION = 'INVALID_LOCATION',       // 無效位置打卡
  OUTSIDE_BUSINESS_HOURS = 'OUTSIDE_BUSINESS_HOURS', // 非營業時間打卡
  MISSING_CLOCK_IN = 'MISSING_CLOCK_IN',       // 缺少上班卡
  MISSING_CLOCK_OUT = 'MISSING_CLOCK_OUT',     // 缺少下班卡
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT'      // 手動調整記錄
}

/**
 * 打卡類型枚舉
 */
export enum ClockType {
  CLOCK_IN = 'clock-in',    // 上班打卡
  CLOCK_OUT = 'clock-out'   // 下班打卡
}

/**
 * 打卡來源枚舉
 */
export enum ClockSource {
  MOBILE_APP = 'mobile-app',       // 行動應用程式
  WEB_ADMIN = 'web-admin',         // 網頁管理介面
  KIOSK = 'kiosk',                 // 自助打卡機
  MANUAL_ADJUST = 'manual-adjust'  // 手動調整
}

/**
 * 出勤記錄 (Firestore資料結構)
 */
export interface AttendanceLog {
  attendanceId: string;                        // 出勤記錄唯一識別碼
  employeeId: string;                          // 員工 ID
  storeId: string;                             // 分店 ID
  tenantId: string;                            // 租戶 ID
  date: string;                                // 工作日期 (YYYY-MM-DD格式)
  
  // 上班打卡資訊
  clockInTime: firestore.Timestamp;            // 上班打卡時間
  clockInCoords: Coordinates;                  // 上班打卡位置
  isWithinFence: boolean;                      // 上班打卡是否在電子圍籬內
  clockInDistance?: number;                    // 上班打卡與分店的距離 (公尺)
  clockInDeviceInfo?: {                        // 上班打卡設備資訊
    deviceId?: string;
    platform?: string;
    model?: string;
    osVersion?: string;
  };
  clockInNotes?: string;                       // 上班打卡備註
  source: ClockSource;                         // 上班打卡來源
  
  // 下班打卡資訊 (可能為空，表示尚未打下班卡)
  clockOutTime?: firestore.Timestamp;          // 下班打卡時間
  clockOutCoords?: Coordinates;                // 下班打卡位置
  isWithinFenceClockOut?: boolean;             // 下班打卡是否在電子圍籬內
  clockOutDistance?: number;                   // 下班打卡與分店的距離 (公尺)
  clockOutDeviceInfo?: {                       // 下班打卡設備資訊
    deviceId?: string;
    platform?: string;
    model?: string;
    osVersion?: string;
  };
  clockOutNotes?: string;                      // 下班打卡備註
  clockOutSource?: ClockSource;                // 下班打卡來源
  
  // 計算欄位
  workDurationMinutes?: number;                // 工作時長 (分鐘)
  status: AttendanceStatus;                    // 出勤狀態
  lateMinutes?: number;                        // 遲到分鐘數
  earlyLeaveMinutes?: number;                  // 早退分鐘數
  
  // 參照排班資訊 (如果有排班)
  scheduleId?: string;                         // 對應的排班ID
  scheduledStartTime?: firestore.Timestamp;    // 排定的上班時間
  scheduledEndTime?: firestore.Timestamp;      // 排定的下班時間
  
  // 審計欄位
  createdAt: firestore.Timestamp;              // 記錄創建時間
  createdBy: string;                           // 記錄創建者
  updatedAt?: firestore.Timestamp;             // 記錄更新時間
  updatedBy?: string;                          // 記錄更新者
}

/**
 * 出勤記錄 (API回應用，日期時間轉為ISO字串)
 */
export interface AttendanceLogDTO {
  attendanceId: string;
  employeeId: string;
  employeeName?: string;                      // 關聯員工姓名 (查詢用)
  storeId: string;
  storeName?: string;                         // 關聯店舖名稱 (查詢用)
  tenantId: string;
  date: string;
  
  clockInTime: string;                        // ISO日期時間字串
  clockInCoords: Coordinates;                 // 上班打卡位置
  isWithinFence: boolean;
  clockInDistance?: number;
  clockInDeviceInfo?: {
    deviceId?: string;
    platform?: string;
    model?: string;
    osVersion?: string;
  };
  clockInNotes?: string;
  source: string;
  
  clockOutTime?: string;                      // ISO日期時間字串
  clockOutCoords?: Coordinates;               // 下班打卡位置
  isWithinFenceClockOut?: boolean;
  clockOutDistance?: number;
  clockOutDeviceInfo?: {
    deviceId?: string;
    platform?: string;
    model?: string;
    osVersion?: string;
  };
  clockOutNotes?: string;
  clockOutSource?: string;
  
  workDurationMinutes?: number;
  status: string;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  
  createdAt: string;                          // ISO日期時間字串
  createdBy: string;
  updatedAt?: string;                         // ISO日期時間字串
  updatedBy?: string;
}

/**
 * 打卡成功回應
 */
export interface ClockSuccessResponse {
  status: 'success';
  data: {
    attendanceId: string;                     // 出勤記錄ID
    timestamp: string;                        // 打卡時間 (ISO格式)
    type: ClockType;                          // 打卡類型 (上班/下班)
    isWithinFence: boolean;                   // 是否在電子圍籬內
    distance?: number;                        // 與店舖的距離 (公尺)
    storeName?: string;                       // 店舖名稱
    status: AttendanceStatus;                 // 出勤狀態 (準時/遲到/早退等)
  };
}

/**
 * 打卡錯誤回應
 */
export interface ClockErrorResponse {
  status: 'error';
  message: string;
  errors?: {
    code: string;
    message: string;
  }[];
}

/**
 * 打卡回應 (成功或錯誤)
 */
export type ClockResponse = ClockSuccessResponse | ClockErrorResponse;

/**
 * 計算地理距離的輔助函數
 * @param lat1 第一個位置的緯度
 * @param lon1 第一個位置的經度
 * @param lat2 第二個位置的緯度
 * @param lon2 第二個位置的經度
 * @returns 兩點之間的距離 (公尺)
 */
export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  // 地球半徑 (公尺)
  const R = 6371000;
  
  // 將經緯度轉換為弧度
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  // Haversine 公式
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // 距離 (公尺)
  return R * c;
}

/**
 * 用戶上下文
 */
export interface UserContext {
  uid: string;
  email?: string;
  role: string;
  roleLevel: number;
  tenantId?: string;
  storeId?: string;
  additionalStoreIds?: string[];
  permissions?: {
    [resource: string]: {
      create: boolean;
      read: boolean;
      update: boolean;
      delete: boolean;
    };
  };
}

// 保留舊有的接口定義以保持相容性
// 下面是舊有結構的重新映射與匯出，以確保系統相容性
export type PunchRequest = ClockRequest;
export type PunchResponse = ClockResponse;
export { ClockType as PunchType };

// 其他查詢相關的類型定義...
export interface ListAttendanceLogsQuery {
  employeeId?: string;
  storeId?: string;
  startDate?: string;
  endDate?: string;
  type?: ClockType;
  isWithinFence?: boolean;
  source?: ClockSource;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ExtendedAttendanceLog extends AttendanceLog {
  employeeName?: string;
  storeName?: string;
}

export interface AttendanceLogsResponse {
  status: 'success' | 'error';
  data: AttendanceLogDTO[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    limit: number;
  };
  errors?: {
    code: string;
    message: string;
  }[];
} 