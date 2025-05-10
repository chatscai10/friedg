/**
 * 超級管理後台 - 類型定義
 */

/**
 * 租戶狀態枚舉
 */
export enum TenantStatus {
  ACTIVE = 'active',               // 正常營運中
  INACTIVE = 'inactive',           // 暫時停用
  SUSPENDED = 'suspended',         // 已被系統暫停
  PENDING_APPROVAL = 'pending_approval', // 等待審核
  TRIAL = 'trial',                 // 試用期
  EXPIRED = 'expired'              // 已過期
}

/**
 * 租戶資源限制介面
 */
export interface TenantLimits {
  maxStores: number;               // 最大商店數量
  maxUsers: number;                // 最大用戶數量
  maxMenuItems: number;            // 最大菜單項目數量
  storageLimit: number;            // 儲存空間限制 (MB)
  adFree: boolean;                 // 是否無廣告
  premiumSupport: boolean;         // 是否享有高級支援
  [key: string]: any;              // 其他可擴展限制
}

/**
 * 租戶介面
 */
export interface Tenant {
  id: string;                      // 租戶唯一識別碼
  name: string;                    // 租戶名稱
  slug?: string;                   // URL友善名稱
  description?: string;            // 租戶描述
  logo?: string;                   // 租戶Logo URL
  contactInfo: {                   // 聯絡資訊
    email: string;
    phone?: string;
    address?: string;
  };
  status: TenantStatus;            // 租戶狀態
  limits: TenantLimits;            // 資源限制
  storeCount: number;              // 目前商店數量
  userCount: number;               // 目前用戶數量
  plan: string;                    // 方案名稱
  planExpiryDate?: Date;           // 方案到期日
  createdAt: Date;                 // 創建時間
  updatedAt: Date;                 // 更新時間
  lastLoginAt?: Date;              // 最後登入時間
  suspensionReason?: string;       // 暫停原因(若狀態為suspended)
  referredBy?: string;             // 推薦人租戶ID
}

/**
 * 租戶狀態更新請求參數
 */
export interface TenantStatusUpdateParams {
  status: TenantStatus;            // 新狀態
  reason?: string;                 // 變更原因（特別是暫停時）
}

/**
 * 租戶管理API回應介面
 */
export interface TenantResponse {
  status: 'success' | 'error';
  data?: Tenant | Tenant[] | null;
  message?: string;
  errorCode?: string;
}

/**
 * 服務方案狀態枚舉
 */
export enum ServicePlanStatus {
  ACTIVE = 'active',               // 方案可用
  INACTIVE = 'inactive'            // 方案不可用
}

/**
 * This represents allowed features for each plan. Each feature is represented
 * as a string key with boolean value, where true means the feature is available.
 */
export interface PlanFeatures {
  basic_ordering: boolean;         // 基礎訂單管理
  advanced_ordering: boolean;      // 進階訂單管理
  basic_inventory: boolean;        // 基礎庫存管理
  advanced_inventory: boolean;     // 進階庫存管理
  staff_management: boolean;       // 員工管理
  marketing_tools: boolean;        // 行銷工具
  analytics_reports: boolean;      // 分析報表
  customer_management: boolean;    // 客戶管理
  multiple_locations: boolean;     // 多門店管理
  api_access: boolean;             // API訪問權限
  white_label: boolean;            // 白標服務
  [key: string]: boolean;          // 其他可擴展功能
}

/**
 * 服務方案限制介面
 */
export interface PlanLimits {
  maxStores: number;               // 最大商店數量
  maxUsers: number;                // 最大用戶數量
  maxMenuItems: number;            // 最大菜單項目數量
  maxProducts: number;             // 最大商品數量
  maxOrders: number;               // 每月最大訂單數
  storageLimit: number;            // 儲存空間限制 (MB)
  [key: string]: number;           // 其他可擴展限制
}

/**
 * 計費週期枚舉
 */
export enum BillingCycle {
  MONTHLY = 'monthly',             // 月付
  YEARLY = 'yearly'                // 年付
}

/**
 * 服務方案介面
 */
export interface ServicePlan {
  id: string;                      // 方案唯一識別碼
  name: string;                    // 方案名稱
  code: string;                    // 方案代碼 (例：'free', 'basic', 'premium')
  description: string;             // 方案描述
  status: ServicePlanStatus;       // 方案狀態
  price: number;                   // 方案價格
  currency: string;                // 貨幣 (例：'TWD', 'USD')
  billingCycle: BillingCycle;      // 計費週期
  features: PlanFeatures;          // 包含功能
  limits: PlanLimits;              // 資源限制
  isRecommended: boolean;          // 是否為推薦方案
  trialDays: number;               // 試用天數 (0表示無試用期)
  sortOrder: number;               // 顯示排序 (小的數字排前面)
  createdAt: Date;                 // 創建時間
  updatedAt: Date;                 // 更新時間
}

/**
 * 服務方案創建/更新輸入介面
 */
export interface ServicePlanInput {
  name: string;                    // 方案名稱
  code: string;                    // 方案代碼
  description: string;             // 方案描述
  status: ServicePlanStatus;       // 方案狀態
  price: number;                   // 方案價格
  currency: string;                // 貨幣
  billingCycle: BillingCycle;      // 計費週期
  features: PlanFeatures;          // 包含功能
  limits: PlanLimits;              // 資源限制
  isRecommended?: boolean;         // 是否為推薦方案
  trialDays?: number;              // 試用天數
  sortOrder?: number;              // 顯示排序
}

/**
 * 訂閱狀態枚舉
 */
export enum SubscriptionStatus {
  ACTIVE = 'active',               // 有效訂閱
  CANCELLED = 'cancelled',         // 已取消
  PAST_DUE = 'past_due',           // 付款逾期
  TRIAL = 'trial',                 // 試用期
  PENDING = 'pending'              // 等待確認
}

/**
 * 租戶訂閱介面
 */
export interface TenantSubscription {
  id: string;                      // 訂閱唯一識別碼
  tenantId: string;                // 租戶ID
  planId: string;                  // 方案ID
  status: SubscriptionStatus;      // 訂閱狀態
  startDate: Date;                 // 訂閱開始日期
  endDate?: Date;                  // 訂閱結束日期 (如適用)
  trialEndDate?: Date;             // 試用期結束日期 (如適用)
  billingCycleStartDate: Date;     // 當前計費週期開始日
  nextBillingDate: Date;           // 下次扣款日期
  canceledAt?: Date;               // 取消日期 (如適用)
  cancellationReason?: string;     // 取消原因
  price: number;                   // 實際支付價格 (可能包含折扣)
  currency: string;                // 貨幣
  paymentMethod?: string;          // 支付方式
  lastPaymentDate?: Date;          // 最近付款日期
  lastPaymentStatus?: string;      // 最近付款狀態
  createdAt: Date;                 // 創建時間
  updatedAt: Date;                 // 更新時間
}

/**
 * 服務方案API回應介面
 */
export interface ServicePlanResponse {
  status: 'success' | 'error';
  data?: ServicePlan | ServicePlan[] | null;
  message?: string;
  errorCode?: string;
}

/**
 * 全局設定介面 
 * 儲存於 globalSettings/main 單一文檔
 */
export interface GlobalSettings {
  // 系統功能開關
  maintenanceMode: boolean;            // 維護模式開關
  allowNewRegistrations: boolean;      // 允許新租戶註冊
  
  // 預設參數
  defaultCurrency: string;             // 預設貨幣 (例: 'TWD', 'USD')
  defaultLanguage: string;             // 預設語言 (例: 'zh-TW')
  supportedLanguages: string[];        // 支援的語言列表
  
  // 檔案上傳限制
  maxUploadSizeMB: number;             // 最大上傳檔案大小 (MB)
  allowedFileTypes: string[];          // 允許的檔案類型 (例: ['image/jpeg', 'image/png'])
  
  // 安全性設定
  passwordMinLength: number;           // 密碼最小長度
  passwordRequiresSpecialChar: boolean; // 密碼需要特殊字元
  sessionTimeoutMinutes: number;       // 工作階段逾時分鐘數
  
  // 廣告系統設定
  adsEnabled: boolean;                 // 廣告系統全局開關
  defaultAdDisplayLimit: number;       // 預設廣告顯示數量限制
  
  // 推薦系統設定
  referralEnabled: boolean;            // 推薦系統全局開關
  referralActivationOrderCount: number; // 啟動推薦獎勵所需的訂單數量
  
  // 顧客評價設定
  customerRatingEnabled: boolean;      // 顧客評價系統開關
  minimumRatingForPublic: number;      // 公開顯示的最低評分 (1-5)
  
  // LINE相關設定
  lineNotifyEnabled: boolean;          // LINE通知功能開關
  
  // 系統元數據
  version: string;                     // 系統版本
  lastUpdated: Date;                   // 最後更新時間
  updatedBy: string;                   // 最後更新者ID
}

/**
 * 全局設定API回應介面
 */
export interface GlobalSettingsResponse {
  status: 'success' | 'error';
  data?: GlobalSettings | null;
  message?: string;
  errorCode?: string;
} 