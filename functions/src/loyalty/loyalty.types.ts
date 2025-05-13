import * as admin from 'firebase-admin';

/**
 * 積分交易記錄，用於追蹤積分的變動
 */
export interface LoyaltyPointTransaction {
  transactionId: string;                 // 交易ID
  memberId: string;                      // 會員ID
  tenantId: string;                      // 租戶ID
  storeId?: string;                      // 店鋪ID (如果適用)
  
  amount: number;                        // 積分數量 (正數為增加，負數為扣除)
  balance: number;                       // 交易後餘額
  
  type: 'earn' | 'redeem' | 'expire' | 'adjust' | 'bonus'; // 交易類型
  source: 'purchase' | 'referral' | 'activity' | 'manual' | 'system' | 'refund'; // 來源
  
  sourceId?: string;                     // 關聯來源ID (如訂單ID)
  sourceType?: string;                   // 關聯來源類型 (如 'order', 'campaign')
  
  description: string;                   // 交易描述
  
  // 有效期管理
  expiryDate?: admin.firestore.Timestamp; // 積分到期日期 (如果適用)
  isExpired?: boolean;                   // 是否已過期
  
  // 元數據
  operatedBy?: string;                   // 操作者ID (手動調整時)
  note?: string;                         // 附加備註
  
  createdAt: admin.firestore.Timestamp;  // 創建時間
  updatedAt?: admin.firestore.Timestamp; // 更新時間
}

/**
 * 會員等級規則，定義不同等級的晉級條件和權益
 */
export interface LoyaltyTierRule {
  tierId: string;                        // 等級ID
  tenantId: string;                      // 租戶ID
  
  name: string;                          // 等級名稱
  displayName: string;                   // 顯示名稱
  level: number;                         // 等級數值 (越大等級越高)
  
  // 晉級條件
  pointsThreshold: number;               // 積分門檻
  spendingThreshold?: number;            // 消費金額門檻
  orderCountThreshold?: number;          // 訂單數量門檻
  additionalRequirements?: string[];     // 其他條件描述
  
  // 等級權益
  pointsMultiplier: number;              // 積分倍數 (例如: 1.0, 1.2, 1.5)
  discountPercentage?: number;           // 固定折扣百分比
  birthdayBonus?: number;                // 生日獎勵積分
  freeShipping?: boolean;                // 免運費
  exclusiveAccess?: boolean;             // 專屬活動訪問權
  specialServices?: string[];            // 特殊服務列表
  
  // 會員有效期規則
  validityPeriod: number;                // 有效期 (天數)
  renewalPolicy: 'automatic' | 'points_renewal' | 'annual_review'; // 續期政策
  gracePeriod?: number;                  // 寬限期 (天數)
  
  isActive: boolean;                     // 是否啟用
  
  createdAt: admin.firestore.Timestamp;  // 創建時間
  updatedAt?: admin.firestore.Timestamp; // 更新時間
  createdBy: string;                     // 創建者ID
}

/**
 * 可兌換獎勵，定義積分可兌換的項目
 */
export interface LoyaltyReward {
  rewardId: string;                      // 獎勵ID
  tenantId: string;                      // 租戶ID
  
  name: string;                          // 獎勵名稱
  description: string;                   // 詳細描述
  imageUrl?: string;                     // 圖片URL
  
  type: 'coupon' | 'product' | 'service' | 'discount'; // 獎勵類型
  
  pointsCost: number;                    // 所需積分
  value: number;                         // 獎勵價值 (折抵金額)
  
  // 獎勵細節 (根據類型不同而有所差異)
  details: {
    couponType?: 'percentage' | 'fixed';   // 優惠券類型
    discountValue?: number;                // 折扣值
    validDays?: number;                    // 有效期 (天)
    minOrderAmount?: number;               // 最低訂單金額
    productId?: string;                    // 產品ID
    serviceId?: string;                    // 服務ID
  };
  
  // 可用性控制
  startDate?: admin.firestore.Timestamp;   // 開始提供日期
  endDate?: admin.firestore.Timestamp;     // 結束提供日期
  totalStock?: number;                     // 總庫存量
  remainingStock?: number;                 // 剩餘庫存量
  limitPerMember?: number;                 // 每位會員限制數量
  minimumTier?: string;                    // 最低等級要求
  
  isActive: boolean;                       // 是否啟用
  
  createdAt: admin.firestore.Timestamp;    // 創建時間
  updatedAt?: admin.firestore.Timestamp;   // 更新時間
  createdBy: string;                       // 創建者ID
}

/**
 * 積分兌換記錄，追蹤積分兌換活動
 */
export interface PointRedemption {
  redemptionId: string;                  // 兌換ID
  memberId: string;                      // 會員ID
  tenantId: string;                      // 租戶ID
  storeId?: string;                      // 店鋪ID (如果適用)
  
  rewardId: string;                      // 兌換的獎勵ID
  rewardName: string;                    // 獎勵名稱 (冗餘存儲)
  rewardType: string;                    // 獎勵類型 (冗餘存儲)
  
  pointsUsed: number;                    // 使用的積分
  
  status: 'pending' | 'completed' | 'cancelled' | 'failed'; // 兌換狀態
  
  // 結果信息
  resultId?: string;                     // 產生的結果ID (如優惠券ID)
  resultCode?: string;                   // 產生的結果代碼 (如優惠券代碼)
  
  // 處理信息
  processedBy?: string;                  // 處理人員ID
  processingNote?: string;               // 處理備註
  
  createdAt: admin.firestore.Timestamp;  // 創建時間
  updatedAt?: admin.firestore.Timestamp; // 更新時間
  completedAt?: admin.firestore.Timestamp; // 完成時間
} 