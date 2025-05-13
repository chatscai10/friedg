import { BusinessHours, TimeRange, DailyOperatingHours, Coordinates } from '../../src/types/core-params';

export type StoreStatus = 'active' | 'inactive' | 'temporary_closed' | 'permanently_closed';

export interface StoreLocation {
  latitude: number;
  longitude: number;
}

export interface StoreAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  fullAddress?: string; // 完整地址（用於顯示）
}

export interface StoreContactInfo {
  email?: string;
  phone?: string;
  managerId?: string;
  managerName?: string; // 店長姓名（用於顯示）
}

// 使用核心參數中的 DailyOperatingHours
export { DailyOperatingHours as StoreOperatingHours };

export interface StoreGpsFence {
  enabled: boolean;
  radius?: number; // 單位：公尺
  center?: StoreLocation;
}

export interface StorePrinterSettings {
  enabled: boolean;
  apiUrl?: string;
  apiKey?: string;
  printerType?: 'thermal' | 'label' | 'normal';
  templates?: {
    receipt?: string;
    kitchen?: string;
    takeout?: string;
  };
}

/**
 * 店鋪考勤設定
 */
export interface AttendanceSettings {
  lateThresholdMinutes: number;    // 遲到閾值（分鐘）
  earlyThresholdMinutes: number;   // 早退閾值（分鐘）
  flexTimeMinutes: number;         // 彈性打卡時間（分鐘）
  requireApprovalForCorrection: boolean; // 是否需要審批補卡
  autoClockOutEnabled: boolean;    // 是否啟用自動打下班卡
  autoClockOutTime?: string;       // 自動打下班卡時間 (HH:MM)
}

export interface Store {
  id: string;
  tenantId: string;
  name: string;
  storeCode?: string;
  description?: string;
  status: StoreStatus;
  address?: StoreAddress;
  location?: Coordinates;
  contactInfo?: StoreContactInfo;
  operatingHours?: DailyOperatingHours[];
  businessHours?: BusinessHours;  // 新增標準營業時間格式
  gpsFence?: StoreGpsFence;
  printerSettings?: StorePrinterSettings;
  attendanceSettings?: AttendanceSettings;
  createdAt: string;
  updatedAt: string;
}

/**
 * 分頁響應接口
 */
export interface PaginatedResponse<T> {
  status: string;
  data: T[];
  message?: string;
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * 店鋪列表響應接口
 */
export interface StoresResponse extends PaginatedResponse<Store> {}

/**
 * 單個店鋪響應接口
 */
export interface StoreResponse {
  status: string;
  data: Store;
  message?: string;
}

/**
 * 獲取店鋪列表的參數接口
 */
export interface FetchStoresParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: StoreStatus;
}

/**
 * 創建店鋪的請求數據結構
 */
export interface CreateStorePayload {
  name: string;
  storeCode?: string;
  description?: string;
  status: StoreStatus;
  address?: StoreAddress;
  contactInfo?: StoreContactInfo;
}

/**
 * 更新店鋪的請求數據結構
 */
export interface UpdateStorePayload {
  name?: string;
  storeCode?: string;
  description?: string;
  status?: StoreStatus;
  address?: StoreAddress;
  contactInfo?: StoreContactInfo;
}

/**
 * 更新店鋪地理位置的請求數據結構
 */
export interface UpdateStoreLocationPayload {
  location: StoreLocation;
  gpsFence?: StoreGpsFence;
}

/**
 * 更新店鋪營業時間的請求數據結構 (陣列格式)
 */
export interface UpdateStoreOperatingHoursPayload {
  operatingHours: DailyOperatingHours[];
}

/**
 * 更新店鋪營業時間的請求數據結構 (物件格式)
 */
export interface UpdateStoreBusinessHoursPayload {
  businessHours: BusinessHours;
}

/**
 * 更新店鋪考勤設定的請求數據結構
 */
export interface UpdateStoreAttendanceSettingsPayload {
  attendanceSettings: AttendanceSettings;
}

/**
 * 店鋪狀態接口（用於Redux存儲）
 */
export interface StoreState {
  stores: Store[];
  currentStore: Store | null;
  loading: boolean;
  error: string | null;
  saveLoading: boolean;
  deleteLoading: boolean;
  saveError: string | null;
  deleteError: string | null;
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    search: string;
    status: string;
  };
} 