import { Timestamp } from 'firebase/firestore';

/**
 * 地址接口
 */
export interface Address {
  id?: string;
  type?: 'home' | 'work' | 'other'; // 地址類型
  line1: string;                    // 詳細地址 1
  line2?: string;                   // 詳細地址 2
  city: string;                     // 城市
  state?: string;                   // 州/省
  postalCode: string;               // 郵遞區號
  country: string;                  // 國家
  isPrimary?: boolean;              // 是否為主要地址
  createdAt?: Timestamp;            // 創建時間
  updatedAt?: Timestamp;            // 更新時間
}

/**
 * 客戶備註接口
 */
export interface CustomerNote {
  noteId: string;                   // 備註 ID
  text: string;                     // 備註內容
  addedBy: string;                  // 添加者 ID
  addedByName?: string;             // 添加者姓名
  timestamp: Timestamp;             // 添加時間
  isImportant?: boolean;            // 是否重要
}

/**
 * 用戶 Profile 數據接口
 */
export interface UserProfile {
  uid: string;                      // Firebase UID
  email?: string | null;            // Email
  displayName?: string | null;      // 顯示名稱
  photoURL?: string | null;         // 頭像 URL
  phoneNumber?: string | null;      // 電話號碼
  
  // CRM 相關字段
  firstName?: string;               // 名
  lastName?: string;                // 姓
  gender?: 'male' | 'female' | 'other'; // 性別
  birthday?: Timestamp;             // 生日
  addresses?: Address[];            // 地址列表
  alternatePhoneNumber?: string;    // 備用電話
  tags?: string[];                  // 客戶標籤
  customerSince?: Timestamp;        // 註冊成為客戶的時間
  lastActivityDate?: Timestamp;     // 最後活動時間
  totalSpent?: number;              // 總消費金額
  orderCount?: number;              // 訂單數量
  membershipTier?: string;          // 會員等級
  membershipPoints?: number;        // 會員積分
  source?: string;                  // 客戶來源
  preferredContactMethod?: 'email' | 'phone' | 'sms' | 'line'; // 偏好聯繫方式
  status?: 'active' | 'inactive' | 'blocked'; // 客戶狀態
  lastUpdated?: Timestamp;          // 上次更新時間
}

/**
 * 認證用戶接口 - 用於存儲已登入用戶的資訊和權限
 */
export interface AuthenticatedUser {
  uid: string;                      // Firebase UID
  email?: string | null;            // Email
  displayName?: string | null;      // 顯示名稱
  photoURL?: string | null;         // 頭像 URL
  phoneNumber?: string | null;      // 電話號碼
  
  // 權限和身份相關
  roles: string[];                  // 角色列表，例如 ['admin', 'store_manager']
  permissions: string[];            // 權限列表，例如 ['users:read', 'users:write']
  tenantId?: string | null;         // 租戶ID，對多租戶系統很重要
  storeId?: string | null;          // 店鋪ID，對店長等角色很重要
  additionalStoreIds?: string[];    // 額外管理的店鋪ID列表
  roleLevel?: number;               // 角色等級，數字越小表示權限越高，0 表示最高權限
  
  // 自定義聲明
  customClaims?: {                  // Firebase Custom Claims
    [key: string]: any;             // 任意自定義聲明
  };
  
  // 元數據
  lastLogin?: Date | null;          // 最後登入時間
  createdAt?: Date | null;          // 帳號創建時間
}

/**
 * 用戶狀態類型
 */
export type UserStatus = 'active' | 'inactive' | 'suspended';

/**
 * 用戶介面 - 用於用戶管理頁面
 */
export interface User {
  userId: string;               // 用戶ID
  email: string;                // 電子郵件
  displayName?: string;         // 顯示名稱
  firstName?: string;           // 名
  lastName?: string;            // 姓
  status: UserStatus;           // 用戶狀態
  roles: string[];              // 角色ID列表
  roleNames?: string[];         // 角色名稱列表（用於顯示）
  tenantId?: string;            // 租戶ID
  storeId?: string;             // 店鋪ID
  lastLogin?: string;           // 最後登入時間
  createdAt: string;            // 創建時間
  updatedAt: string;            // 更新時間
  isSystemUser?: boolean;       // 是否系統用戶（不可刪除）
}

/**
 * 用戶列表響應介面
 */
export interface UsersResponse {
  status: string;               // API響應狀態
  data: User[];                 // 用戶列表
  message?: string;             // 可能的訊息
  pagination?: {                // 分頁信息
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * 用戶詳情響應介面
 */
export interface UserResponse {
  status: string;               // API響應狀態
  data: User;                   // 用戶詳情
  message?: string;             // 可能的訊息
}

/**
 * 用戶狀態更新請求介面
 */
export interface UpdateUserStatusPayload {
  status: UserStatus;           // 新的用戶狀態
  reason?: string;              // 狀態變更原因（可選）
}

/**
 * 用戶角色更新請求介面
 */
export interface UpdateUserRolesPayload {
  roles: string[];              // 新的角色ID列表
}

/**
 * 創建用戶請求介面
 */
export interface CreateUserPayload {
  email: string;                // 用戶電子郵件
  password: string;             // 密碼
  displayName?: string;         // 顯示名稱
  firstName?: string;           // 名
  lastName?: string;            // 姓
  roles: string[];              // 角色ID列表
  status?: UserStatus;          // 用戶狀態，預設為active
  tenantId?: string;            // 租戶ID
  storeId?: string;             // 店鋪ID
}

/**
 * 用戶資料更新請求介面
 */
export interface UpdateUserPayload {
  displayName?: string;         // 顯示名稱
  firstName?: string;           // 名
  lastName?: string;            // 姓
  email?: string;               // 電子郵件 (通常不建議直接修改)
}

/**
 * 用戶狀態介面（用於Redux存儲）
 */
export interface UserState {
  users: User[];                // 用戶列表
  currentUser: User | null;     // 當前選中的用戶
  loading: boolean;             // 加載狀態
  error: string | null;         // 錯誤信息
  saveLoading: boolean;         // 保存過程中的加載狀態
  deleteLoading: boolean;       // 刪除過程中的加載狀態
  saveError: string | null;     // 保存過程中的錯誤信息
  deleteError: string | null;   // 刪除過程中的錯誤信息
  statusUpdateLoading: boolean; // 狀態更新的加載狀態
  rolesUpdateLoading: boolean;  // 角色更新的加載狀態
  pagination: {                 // 分頁信息
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
} 