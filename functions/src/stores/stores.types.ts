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
 */
export interface BusinessHours {
  monday: TimeRange[];
  tuesday: TimeRange[];
  wednesday: TimeRange[];
  thursday: TimeRange[];
  friday: TimeRange[];
  saturday: TimeRange[];
  sunday: TimeRange[];
  holidays?: TimeRange[];
}

/**
 * 時間範圍
 */
export interface TimeRange {
  start: string; // 格式: "HH:MM"
  end: string;   // 格式: "HH:MM"
}

/**
 * 印表機配置
 */
export interface PrinterConfig {
  receiptPrinter?: {
    name: string;
    model: string;
    ipAddress?: string;
    port?: number;
    connectionType: 'usb' | 'network' | 'bluetooth';
    enabled: boolean;
    paperWidth?: number; // 單位: 毫米
    paperHeight?: number; // 單位: 毫米
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
 * 分店定義
 */
export interface Store {
  storeId: string;            // 分店唯一識別碼
  storeName: string;          // 分店名稱
  storeCode: string;          // 分店代碼 (用於報表和識別)
  address: string;            // 分店地址
  phoneNumber: string;        // 聯絡電話
  contactPerson: string;      // 聯絡人
  email: string;              // 電子郵件
  tenantId: string;           // 租戶 ID
  isActive: boolean;          // 是否啟用
  isDeleted?: boolean;        // 是否被標記為刪除 (邏輯刪除)
  geolocation: GeoLocation | null;  // 地理位置
  gpsFence: GPSFence | null;  // GPS 圍欄設定
  businessHours: BusinessHours | null; // 營業時間
  attendanceSettings: AttendanceSettings | null; // 考勤設定
  printerConfig: PrinterConfig | null; // 印表機設定
  settings: {                 // 店鋪設定
    [key: string]: any;       // 其他設定
  };
  createdAt: firestore.Timestamp | string;  // 創建時間
  updatedAt: firestore.Timestamp | string;  // 更新時間
  createdBy: string;          // 創建者 UID
  updatedBy: string;          // 更新者 UID
}

/**
 * 創建分店請求
 */
export interface CreateStoreRequest {
  storeName: string;
  storeCode: string;
  address: string;
  phoneNumber: string;
  contactPerson: string;
  email: string;
  tenantId: string;
  isActive?: boolean;
  geolocation?: GeoLocation;
  gpsFence?: GPSFence;
  businessHours?: BusinessHours;
  attendanceSettings?: AttendanceSettings;
  printerConfig?: PrinterConfig;
  settings?: {
    [key: string]: any;
  };
}

/**
 * 更新分店請求 (所有欄位均為可選)
 */
export interface UpdateStoreRequest {
  storeName?: string;
  storeCode?: string;
  address?: string;
  phoneNumber?: string;
  contactPerson?: string;
  email?: string;
  isActive?: boolean;
  geolocation?: GeoLocation;
  gpsFence?: GPSFence;
  businessHours?: BusinessHours;
  attendanceSettings?: AttendanceSettings;
  printerConfig?: PrinterConfig;
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
  permissions?: {
    [resource: string]: {
      create: boolean;
      read: boolean;
      update: boolean;
      delete: boolean;
    };
  };
} 