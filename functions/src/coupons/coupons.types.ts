import * as admin from 'firebase-admin';

/**
 * 優惠券模板，定義一類優惠券的通用規則
 */
export interface CouponTemplate {
  templateId: string;                    // 模板ID
  tenantId: string;                      // 租戶ID
  
  name: string;                          // 模板名稱
  description: string;                   // 描述
  
  type: 'percentage' | 'fixed' | 'freeItem' | 'shipping'; // 優惠券類型
  value: number;                         // 優惠值 (百分比或固定金額)
  
  // 有效期設定
  validityType: 'fixed' | 'dynamic';     // 固定日期或動態計算
  validStartDate?: admin.firestore.Timestamp; // 固定開始日期
  validEndDate?: admin.firestore.Timestamp;   // 固定結束日期
  validDays?: number;                    // 發放後有效天數
  
  // 生成和使用限制
  maxIssueCount?: number;                // 最大發放數量
  maxUsagePerCoupon: number;             // 每券最大使用次數
  maxUsagePerMember?: number;            // 每會員最大使用次數
  
  // 使用條件
  constraints: {
    minOrderAmount?: number;             // 最低訂單金額
    maxDiscountAmount?: number;          // 最大折扣金額
    applicableProducts?: string[];       // 適用產品ID
    applicableCategories?: string[];     // 適用類別ID
    excludedProducts?: string[];         // 排除產品ID
    excludedCategories?: string[];       // 排除類別ID
    applicableStores?: string[];         // 適用店鋪ID
  };
  
  // 發放方式
  distributionChannels: ('system' | 'manual' | 'campaign' | 'birthday' | 'loyalty')[]; // 發放渠道
  
  // 活動配置
  campaignId?: string;                   // 關聯活動ID
  targetTiers?: string[];                // 目標會員等級
  targetTags?: string[];                 // 目標會員標籤
  
  isActive: boolean;                     // 是否啟用
  
  createdAt: admin.firestore.Timestamp;  // 創建時間
  updatedAt?: admin.firestore.Timestamp; // 更新時間
  createdBy: string;                     // 創建者ID
}

/**
 * 優惠券實例，代表一個具體的優惠券
 */
export interface CouponInstance {
  couponId: string;                      // 優惠券ID
  templateId?: string;                   // 所屬模板ID (如果適用)
  
  code: string;                          // 優惠券代碼 (唯一)
  
  type: 'percentage' | 'fixed' | 'freeItem' | 'shipping'; // 優惠券類型
  value: number;                         // 優惠值 (百分比或固定金額)
  description: string;                   // 描述
  
  memberId: string;                      // 持有會員ID
  tenantId: string;                      // 租戶ID
  storeId?: string;                      // 指定店鋪ID (如果限定)
  
  // 時間管理
  issuedAt: admin.firestore.Timestamp;   // 發放時間
  expiryDate: admin.firestore.Timestamp; // 過期時間
  
  // 使用狀態
  status: 'active' | 'used' | 'expired' | 'cancelled'; // 狀態
  usageCount: number;                    // 已使用次數
  maxUsage: number;                      // 最大使用次數
  
  // 最近使用
  lastUsedAt?: admin.firestore.Timestamp; // 最近使用時間
  lastOrderId?: string;                  // 最近使用訂單ID
  
  // 來源信息
  source: 'system' | 'manual' | 'campaign' | 'birthday' | 'loyalty' | 'referral'; // 來源
  sourceId?: string;                     // 來源ID (如活動ID)
  
  // 使用條件
  constraints: {
    minOrderAmount?: number;             // 最低訂單金額
    maxDiscountAmount?: number;          // 最大折扣金額
    applicableProducts?: string[];       // 適用產品ID
    applicableCategories?: string[];     // 適用類別ID
  };
  
  createdAt: admin.firestore.Timestamp;  // 創建時間
  updatedAt: admin.firestore.Timestamp;  // 更新時間
}

/**
 * 優惠券使用記錄，追蹤優惠券的使用情況
 */
export interface CouponRedemption {
  redemptionId: string;                  // 使用記錄ID
  couponId: string;                      // 優惠券ID
  couponCode: string;                    // 優惠券代碼 (冗餘存儲)
  
  orderId: string;                       // 訂單ID
  memberId: string;                      // 會員ID
  tenantId: string;                      // 租戶ID
  storeId?: string;                      // 店鋪ID
  
  // 使用詳情
  discountType: 'percentage' | 'fixed' | 'freeItem' | 'shipping'; // 折扣類型
  discountValue: number;                 // 折扣值
  discountAmount: number;                // 實際折扣金額
  orderAmount: number;                   // 訂單金額
  
  usedAt: admin.firestore.Timestamp;     // 使用時間
  createdAt: admin.firestore.Timestamp;  // 記錄創建時間
} 