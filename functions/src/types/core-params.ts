/**
 * 核心參數類型定義
 */

/**
 * 地理座標
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
  radius?: number;
}

/**
 * 每日營業時間
 */
export interface DailyOperatingHours {
  isOpen: boolean;
  openTime?: string;  // 格式: "HH:MM"
  closeTime?: string; // 格式: "HH:MM"
  breaks?: Array<{
    start: string;    // 格式: "HH:MM"
    end: string;      // 格式: "HH:MM"
  }>;
}

/**
 * 營業時間
 */
export interface BusinessHours {
  monday: Array<{ start: string; end: string; }>;
  tuesday: Array<{ start: string; end: string; }>;
  wednesday: Array<{ start: string; end: string; }>;
  thursday: Array<{ start: string; end: string; }>;
  friday: Array<{ start: string; end: string; }>;
  saturday: Array<{ start: string; end: string; }>;
  sunday: Array<{ start: string; end: string; }>;
}

/**
 * 分頁元數據
 */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
}

/**
 * 通用響應格式
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
  pagination?: PaginationMeta;
}

/**
 * 通用查詢參數
 */
export interface QueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

/**
 * 通用 ID 參數
 */
export interface IdParams {
  id: string;
}

/**
 * 通用狀態更新參數
 */
export interface StatusUpdateParams {
  status: string;
  reason?: string;
}

/**
 * 通用審計欄位
 */
export interface AuditFields {
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * 通用地址格式
 */
export interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  formatted?: string;
}

/**
 * 通用聯絡資訊
 */
export interface ContactInfo {
  email?: string;
  phone?: string;
  managerId?: string;
}

/**
 * 通用設備資訊
 */
export interface DeviceInfo {
  deviceId?: string;
  platform?: string;
  model?: string;
  osVersion?: string;
}
