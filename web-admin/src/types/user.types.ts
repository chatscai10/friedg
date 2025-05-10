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