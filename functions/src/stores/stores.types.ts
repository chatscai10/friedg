import { firestore } from 'firebase-admin';

/**
 * 地理位置資訊
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

/**
 * GPS 圍欄配置
 */
export interface GPSFence {
  enabled: boolean;
  radius: number; // 單位: 米
  center: {
    latitude: number;
    longitude: number;
  };
  allowedDeviation?: number; // 允許的偏差，單位: 米
}

/**
 * 考勤設定
 */
export interface AttendanceSettings {
  lateThresholdMinutes: number;  // 遲到閾值（分鐘）
  earlyThresholdMinutes: number; // 早退閾值（分鐘）
  flexTimeMinutes: number;       // 彈性時間（分鐘），允許提前打卡和延後打卡的彈性範圍
  requireApprovalForCorrection: boolean; // 補打卡是否需要審批
  autoClockOutEnabled: boolean;  // 是否啟用自動下班打卡功能
  autoClockOutTime?: string;     // 自動下班打卡時間（HH:MM 格式）
}

/**
 * 營業時間配置
 * 使用一個對象，key 為星期幾或 'holidays'，value 為時間範圍陣列
 */
export interface BusinessHours {
  [key: string]: TimeRange[]; // 星期幾 (monday, tuesday, etc.) 或 holidays
}

/**
 * 時間範圍
 */
export interface TimeRange {
  start: string; // 格式: "HH:MM"
  end: string;   // 格式: "HH:MM"
}

/**
 * 印表機配置 - 根據 API 規格調整
 */
export interface PrinterSettings {
  enabled: boolean;
  apiUrl?: string;
  apiKey?: string;
  printerType?: 'thermal' | 'label' | 'normal';
  templates?: { // 不同單據的模板設定
    receipt?: string;
    kitchen?: string;
    takeout?: string;
  };
}

/**
 * 店鋪定義 - 根據最終確認的 Markdown 表格和 API 規格調整
 */
export interface Store {
  storeId: string;            // 分店唯一識別碼
  tenantId: string;           // 租戶 ID
  name: string;               // 店鋪名稱
  storeCode: string;          // 店鋪代碼 (用於報表和識別)
  description?: string;       // 店鋪描述
  status: 'active' | 'inactive' | 'temporary_closed' | 'permanently_closed'; // 店鋪狀態
  address?: {                 // 地址子結構
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  location?: {                // 地理位置子結構
    latitude: number;
    longitude: number;
  };
  contactInfo?: {             // 聯絡資訊子結構
    email?: string;
    phone?: string;
    managerId?: string;       // 店長用戶ID
  };
  operatingHours?: BusinessHours; // 營業時間
  gpsFence?: GPSFence;        // GPS 圍欄設定
  printerSettings?: PrinterSettings; // 印表機設定
  attendanceSettings?: AttendanceSettings; // 考勤設定
  settings?: {                 // 店鋪設定
    [key: string]: any;       // 其他設定
  };
  createdAt: firestore.Timestamp | string;  // 創建時間
  updatedAt: firestore.Timestamp | string;  // 更新時間
  createdBy: string;          // 創建者 UID
  updatedBy: string;          // 更新者 UID
  isDeleted?: boolean;        // 是否被標記為刪除 (邏輯刪除), 僅內部使用或特定場景返回
}

/**
 * 創建分店請求 - 根據 API 規格調整
 */
export interface CreateStoreRequest {
  tenantId: string;
  name: string;
  storeCode?: string;
  description?: string;
  status: 'active' | 'inactive' | 'temporary_closed' | 'permanently_closed';
  address?: { 
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  location?: { 
    latitude: number;
    longitude: number;
  };
  contactInfo?: { 
    email?: string;
    phone?: string;
    managerId?: string;
  };
  operatingHours?: BusinessHours;
  gpsFence?: GPSFence;
  printerSettings?: PrinterSettings;
  attendanceSettings?: AttendanceSettings;
  settings?: { 
    [key: string]: any;
  };
}

/**
 * 更新分店請求 - 根據 API 規格調整
 */
export interface UpdateStoreRequest {
  name?: string;
  storeCode?: string;
  description?: string;
  status?: 'active' | 'inactive' | 'temporary_closed' | 'permanently_closed';
  address?: { 
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  location?: { 
    latitude: number;
    longitude: number;
  };
  contactInfo?: { 
    email?: string;
    phone?: string;
    managerId?: string;
  };
  operatingHours?: BusinessHours;
  gpsFence?: GPSFence;
  printerSettings?: PrinterSettings;
  attendanceSettings?: AttendanceSettings;
  settings?: { 
    [key: string]: any;
  };
}

/**
 * 更新分店狀態請求
 */
export interface UpdateStoreStatusRequest {
  isActive: boolean;
}

/**
 * GPS 圍欄請求
 */
export interface GPSFenceRequest {
  enabled: boolean;
  radius: number;
  center: {
    latitude: number;
    longitude: number;
  };
  allowedDeviation?: number;
}

/**
 * 印表機配置請求
 */
export interface PrinterConfigRequest {
  receiptPrinter?: {
    name: string;
    model: string;
    ipAddress?: string;
    port?: number;
    connectionType: 'usb' | 'network' | 'bluetooth';
    enabled: boolean;
    paperWidth?: number;
    paperHeight?: number;
  };
  kitchenPrinters?: {
    [category: string]: {
      name: string;
      model: string;
      ipAddress?: string;
      port?: number;
      connectionType: 'usb' | 'network' | 'bluetooth';
      enabled: boolean;
    };
  };
  settings?: {
    autoPrint: boolean;
    printCustomerCopy: boolean;
    printMerchantCopy: boolean;
    printLogo: boolean;
    printQRCode: boolean;
    fontSize?: number;
    customHeader?: string;
    customFooter?: string;
  };
}

/**
 * 考勤設定請求
 */
export interface AttendanceSettingsRequest {
  lateThresholdMinutes: number;
  earlyThresholdMinutes: number;
  flexTimeMinutes: number;
  requireApprovalForCorrection: boolean;
  autoClockOutEnabled: boolean;
  autoClockOutTime?: string;
}

/**
 * 分頁回應的元數據
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 分頁分店列表回應
 */
export interface PaginatedStoreResponse {
  status: 'success';
  data: Store[];
  pagination: PaginationMeta;
}

/**
 * 用戶上下文（JWT解碼後的用戶資料）
 * 應由驗證中介軟體設置到 req.user
 */
export interface UserContext {
  uid: string;
  email?: string;
  role: string;
  roleLevel: number;
  tenantId?: string;
  storeId?: string;
  additionalStoreIds?: string[];
  permissions?: { // 使用簡化結構，實際應依賴 RBAC 庫
    [resource: string]: {
      create: boolean;
      read: boolean;
      update: boolean;
      delete: boolean;
    };
  };
} 