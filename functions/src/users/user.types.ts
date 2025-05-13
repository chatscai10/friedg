import * as admin from 'firebase-admin'; // 如果需要 Timestamp

/**
 * 用戶狀態枚舉
 */
export enum UserStatus {
  ACTIVE = 'active',       // 活躍狀態
  INACTIVE = 'inactive',   // 非活躍狀態
  SUSPENDED = 'suspended', // 已停用/暫停狀態
  DELETED = 'deleted'      // 標記為已刪除
}

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
  createdAt?: admin.firestore.Timestamp; // 創建時間
  updatedAt?: admin.firestore.Timestamp; // 更新時間
}

/**
 * 客戶備註接口
 */
export interface CustomerNote {
  noteId: string;                   // 備註 ID
  text: string;                     // 備註內容
  addedBy: string;                  // 添加者 ID
  addedByName?: string;             // 添加者姓名
  timestamp: admin.firestore.Timestamp; // 添加時間
  isImportant?: boolean;            // 是否重要
}

// 用戶 Profile 數據接口 (可被用戶查看和部分修改)
export interface UserProfile {
  uid: string;                      // Firebase UID (通常不可修改)
  email?: string | null;            // Email (可能允許修改或唯讀)
  displayName?: string | null;      // 顯示名稱 (允許修改)
  photoURL?: string | null;         // 頭像 URL (允許修改)
  phoneNumber?: string | null;      // 電話號碼 (允許修改)
  
  // CRM 相關字段
  firstName?: string;               // 名
  lastName?: string;                // 姓
  gender?: 'male' | 'female' | 'other'; // 性別
  birthday?: admin.firestore.Timestamp; // 生日
  addresses?: Address[];            // 地址列表
  alternatePhoneNumber?: string;    // 備用電話
  tags?: string[];                  // 客戶標籤
  customerSince?: admin.firestore.Timestamp; // 註冊成為客戶的時間
  lastActivityDate?: admin.firestore.Timestamp; // 最後活動時間
  totalSpent?: number;              // 總消費金額
  orderCount?: number;              // 訂單數量
  
  // 會員忠誠度相關
  membershipTier: string;           // 會員等級 (例如: 'bronze', 'silver', 'gold', 'platinum')
  membershipPoints: number;         // 當前可用積分
  lifetimePoints: number;           // 歷史累計總積分
  tierExpiryDate?: admin.firestore.Timestamp; // 等級有效期
  tierQualificationDate?: admin.firestore.Timestamp; // 獲得當前等級的日期
  pointsToNextTier?: number;        // 距離下一等級所需積分
  nextTierName?: string;            // 下一等級名稱
  
  source?: string;                  // 客戶來源 (例如：referral, organic, ad)
  preferredContactMethod?: 'email' | 'phone' | 'sms' | 'line'; // 偏好聯繫方式
  status?: 'active' | 'inactive' | 'blocked'; // 客戶狀態
  lastUpdated?: admin.firestore.Timestamp; // 上次更新時間
  
  // 注意：tenantId, lineId, role, status, registeredAt, lastLoginAt 通常不應由用戶直接修改
}

// 用於更新 Profile 的數據接口 (只包含可修改的欄位)
export interface UpdateUserProfileInput {
  displayName?: string | null;
  photoURL?: string | null;
  phoneNumber?: string | null;
  
  // CRM 相關可修改字段
  firstName?: string;
  lastName?: string;
  gender?: 'male' | 'female' | 'other';
  birthday?: admin.firestore.Timestamp;
  addresses?: Address[];
  alternatePhoneNumber?: string;
  preferredContactMethod?: 'email' | 'phone' | 'sms' | 'line';
  
  // 其他允許修改的欄位...
} 