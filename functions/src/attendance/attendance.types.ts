import { firestore } from 'firebase-admin';

/**
 * 考勤打卡記錄
 */
export interface AttendanceLog {
  logId: string;               // 打卡記錄唯一識別碼
  employeeId: string;          // 員工 ID
  storeId: string;             // 分店 ID
  tenantId: string;            // 租戶 ID
  timestamp: firestore.Timestamp;  // 打卡時間
  type: 'punch-in' | 'punch-out';  // 打卡類型 (上班/下班)
  latitude: number;            // 緯度
  longitude: number;           // 經度
  isWithinFence: boolean;      // 是否在允許範圍內
  distance?: number;           // 與分店中心點的距離 (公尺)
  source: 'mobile-app' | 'web-admin-manual' | 'kiosk';  // 來源
  notes?: string;              // 備註 (如：手動調整理由)
  createdAt: firestore.Timestamp;  // 記錄創建時間
  createdBy?: string;          // 記錄創建者 (若為手動調整)
  updatedAt?: firestore.Timestamp;  // 記錄更新時間
  updatedBy?: string;          // 記錄更新者
}

/**
 * 打卡請求
 */
export interface PunchRequest {
  latitude: number;            // 緯度
  longitude: number;           // 經度
  deviceInfo?: {               // 設備資訊 (選填)
    deviceId?: string;         // 設備 ID
    platform?: string;         // 平台 (iOS/Android/Web)
    model?: string;            // 設備型號
    osVersion?: string;        // 操作系統版本
  };
  notes?: string;              // 備註 (選填)
}

/**
 * 打卡回應
 */
export interface PunchResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    logId: string;
    timestamp: string;
    type: 'punch-in' | 'punch-out';
    isWithinFence: boolean;
    distance?: number;
    storeName?: string;
  };
  errors?: {
    code: string;
    message: string;
  }[];
}

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
 * 用戶上下文（從 stores.types.ts 複製）
 * 這裡直接引入來避免循環依賴
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

/**
 * 獲取考勤記錄列表的查詢參數
 */
export interface ListAttendanceLogsQuery {
  employeeId?: string;          // 員工ID
  storeId?: string;             // 分店ID
  startDate?: string;           // 開始日期 (YYYY-MM-DD)
  endDate?: string;             // 結束日期 (YYYY-MM-DD)
  type?: 'punch-in' | 'punch-out';  // 打卡類型
  isWithinFence?: boolean;      // 是否在允許範圍內
  source?: 'mobile-app' | 'web-admin-manual' | 'kiosk';  // 來源
  limit?: number;               // 每頁記錄數
  page?: number;                // 頁碼
  sortBy?: string;              // 排序欄位
  sortOrder?: 'asc' | 'desc';   // 排序方式
}

/**
 * 擴展的考勤記錄 (包含關聯數據)
 */
export interface ExtendedAttendanceLog extends AttendanceLog {
  employeeName?: string;        // 員工姓名
  storeName?: string;           // 分店名稱
}

/**
 * 獲取考勤記錄列表的回應 (API響應格式)
 */
export interface AttendanceLogsResponse {
  status: 'success' | 'error';
  data: Array<{
    logId: string;
    employeeId: string;
    employeeName?: string; 
    storeId: string;
    storeName?: string;
    tenantId: string;
    timestamp: string;        // ISO格式的時間字符串
    type: 'punch-in' | 'punch-out';
    latitude: number;
    longitude: number;
    isWithinFence: boolean;
    distance?: number;
    source: 'mobile-app' | 'web-admin-manual' | 'kiosk';
    notes?: string;
    createdAt: string;        // ISO格式的時間字符串
    createdBy?: string;
    updatedAt?: string;       // ISO格式的時間字符串
    updatedBy?: string;
  }>;
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