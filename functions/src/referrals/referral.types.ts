import { firestore } from 'firebase-admin';

/**
 * 定義推薦記錄的結構
 * 對應 referralRecords 集合的文檔
 */
export interface ReferralRecord {
  id?: string;
  referrerId: string;
  refereeId: string;
  referralCode: string;
  status: 'pending' | 'processed' | 'invalid';
  rewardStatus: 'pending' | 'issued' | 'failed';
  createdAt: firestore.Timestamp;
  updatedAt: firestore.Timestamp;
  rewardIssuedAt?: firestore.Timestamp;
  tenantId: string;
  storeId?: string;
  type?: 'referrer' | 'referee'; // 用於 API 返回時表示記錄類型
}

/**
 * 定義推薦獎勵配置的結構
 * 對應 referralRewardConfigs 集合的文檔
 */
export interface ReferralRewardConfig {
  id?: string;
  tenantId: string;
  isActive: boolean;
  createdAt: firestore.Timestamp;
  updatedAt: firestore.Timestamp;
  referrerReward?: {
    type: 'percentage' | 'fixed';
    value: number;
    validDays: number;
  };
  refereeReward?: {
    type: 'percentage' | 'fixed';
    value: number;
    validDays: number;
  };
}

/**
 * 應用推薦碼的輸入參數
 */
export interface ApplyReferralCodeInput {
  code: string;
}

/**
 * 應用推薦碼的結果
 */
export interface ApplyReferralCodeResult {
  success: boolean;
  referrerId: string;
  referralRecordId: string;
}

/**
 * 生成推薦碼的結果
 */
export interface GenerateReferralCodeResult {
  referralCode: string;
}

/**
 * 獲取會員推薦記錄的參數
 */
export interface GetMemberReferralsParams {
  type?: 'referrer' | 'referee' | 'all';
}

/**
 * 會員在推薦系統中的屬性
 * 用於定義 members 集合中與推薦相關的字段
 */
export interface MemberReferralAttributes {
  referralCode?: string;
  referredBy?: string;
  referredAt?: firestore.Timestamp;
  referralCount?: number;
}

/**
 * 創建優惠券的參數
 */
export interface CreateCouponParams {
  memberId: string;
  type: 'percentage' | 'fixed';
  value: number;
  validDays: number;
  description: string;
  tenantId: string;
  storeId?: string;
  source?: string;
} 