import apiClient from './api';
import { mockConfig, simulateNetworkDelay, mockLog } from '../mockConfig';
import { getMockLoyaltyTiers, getMockLoyaltyRewards, getMockLoyaltyTierById, getMockLoyaltyRewardById } from '../mock-data/loyaltyMockData';

// 會員等級規則相關接口
export interface LoyaltyTierRule {
  tierId: string;
  tenantId: string;
  name: string;
  displayName: string;
  level: number;
  pointsThreshold: number;
  spendingThreshold?: number;
  orderCountThreshold?: number;
  additionalRequirements?: string[];
  pointsMultiplier: number;
  discountPercentage?: number;
  birthdayBonus?: number;
  freeShipping?: boolean;
  exclusiveAccess?: boolean;
  specialServices?: string[];
  validityPeriod: number;
  renewalPolicy: 'automatic' | 'points_renewal' | 'annual_review';
  gracePeriod?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
}

// 忠誠度獎勵相關接口
export interface LoyaltyReward {
  rewardId: string;
  tenantId: string;
  name: string;
  description: string;
  imageUrl?: string;
  type: 'coupon' | 'product' | 'service' | 'discount';
  pointsCost: number;
  value: number;
  details: {
    couponType?: 'percentage' | 'fixed';
    discountValue?: number;
    validDays?: number;
    minOrderAmount?: number;
    productId?: string;
    serviceId?: string;
  };
  startDate?: Date;
  endDate?: Date;
  totalStock?: number;
  remainingStock?: number;
  limitPerMember?: number;
  minimumTier?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
}

// 積分交易相關接口
export interface LoyaltyPointTransaction {
  transactionId: string;
  memberId: string;
  tenantId: string;
  storeId?: string;
  amount: number;
  balance: number;
  type: 'earn' | 'redeem' | 'expire' | 'adjust' | 'bonus';
  source: 'purchase' | 'referral' | 'activity' | 'manual' | 'system' | 'refund';
  sourceId?: string;
  sourceType?: string;
  description: string;
  expiryDate?: Date;
  isExpired?: boolean;
  operatedBy?: string;
  note?: string;
  createdAt: Date;
  updatedAt?: Date;
}

// 忠誠度服務類
class LoyaltyService {
  // 會員等級規則 CRUD 操作
  async createTierRule(tierRuleData: Omit<LoyaltyTierRule, 'tierId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const response = await apiClient.post('/admin/loyalty/tiers', tierRuleData);
      return response.data.tierId;
    } catch (error) {
      console.error('創建會員等級規則錯誤:', error);
      throw error;
    }
  }

  async updateTierRule(tierId: string, tierRuleData: Partial<LoyaltyTierRule>): Promise<boolean> {
    try {
      await apiClient.put(`/admin/loyalty/tiers/${tierId}`, tierRuleData);
      return true;
    } catch (error) {
      console.error('更新會員等級規則錯誤:', error);
      throw error;
    }
  }

  async getTierRule(tierId: string): Promise<LoyaltyTierRule> {
    try {
      // 檢查是否使用模擬數據
      if (mockConfig.USE_MOCK_DATA) {
        mockLog(`獲取會員等級規則 ID: ${tierId} (模擬數據)`);
        await simulateNetworkDelay();
        const tier = getMockLoyaltyTierById(tierId);
        if (!tier) {
          throw new Error(`會員等級規則不存在: ${tierId}`);
        }
        return tier;
      }

      // 使用真實API
      const response = await apiClient.get(`/admin/loyalty/tiers/${tierId}`);
      return response.data;
    } catch (error) {
      console.error('獲取會員等級規則錯誤:', error);
      throw error;
    }
  }

  async listTierRules(onlyActive = false): Promise<{ data: LoyaltyTierRule[], pagination: { total: number } }> {
    try {
      // 檢查是否使用模擬數據
      if (mockConfig.USE_MOCK_DATA) {
        mockLog(`獲取會員等級規則列表 (模擬數據)`);
        await simulateNetworkDelay();
        return getMockLoyaltyTiers({ isActive: onlyActive });
      }

      // 使用真實API
      const response = await apiClient.get('/admin/loyalty/tiers', {
        params: { isActive: onlyActive }
      });
      return response.data;
    } catch (error) {
      console.error('列出會員等級規則錯誤:', error);
      throw error;
    }
  }

  // 忠誠度獎勵 CRUD 操作
  async createReward(rewardData: Omit<LoyaltyReward, 'rewardId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const response = await apiClient.post('/admin/loyalty/rewards', rewardData);
      return response.data.rewardId;
    } catch (error) {
      console.error('創建忠誠度獎勵錯誤:', error);
      throw error;
    }
  }

  async updateReward(rewardId: string, rewardData: Partial<LoyaltyReward>): Promise<boolean> {
    try {
      await apiClient.put(`/admin/loyalty/rewards/${rewardId}`, rewardData);
      return true;
    } catch (error) {
      console.error('更新忠誠度獎勵錯誤:', error);
      throw error;
    }
  }

  async getReward(rewardId: string): Promise<LoyaltyReward> {
    try {
      // 檢查是否使用模擬數據
      if (mockConfig.USE_MOCK_DATA) {
        mockLog(`獲取忠誠度獎勵 ID: ${rewardId} (模擬數據)`);
        await simulateNetworkDelay();
        const reward = getMockLoyaltyRewardById(rewardId);
        if (!reward) {
          throw new Error(`忠誠度獎勵不存在: ${rewardId}`);
        }
        return reward;
      }

      // 使用真實API
      const response = await apiClient.get(`/admin/loyalty/rewards/${rewardId}`);
      return response.data;
    } catch (error) {
      console.error('獲取忠誠度獎勵錯誤:', error);
      throw error;
    }
  }

  async listRewards(onlyActive = false): Promise<{ data: LoyaltyReward[], pagination: { total: number } }> {
    try {
      // 檢查是否使用模擬數據
      if (mockConfig.USE_MOCK_DATA) {
        mockLog(`獲取忠誠度獎勵列表 (模擬數據)`);
        await simulateNetworkDelay();
        return getMockLoyaltyRewards({ isActive: onlyActive });
      }

      // 使用真實API
      const response = await apiClient.get('/admin/loyalty/rewards', {
        params: { isActive: onlyActive }
      });
      return response.data;
    } catch (error) {
      console.error('列出忠誠度獎勵錯誤:', error);
      throw error;
    }
  }

  // 積分管理操作
  async adjustPoints(
    userId: string,
    points: number,
    type: LoyaltyPointTransaction['type'],
    source: LoyaltyPointTransaction['source'],
    description: string,
    options?: {
      sourceId?: string;
      note?: string;
    }
  ): Promise<LoyaltyPointTransaction> {
    try {
      const response = await apiClient.post('/admin/loyalty/adjust-points', {
        userId,
        points,
        type,
        source,
        description,
        sourceId: options?.sourceId,
        note: options?.note
      });
      return response.data;
    } catch (error) {
      console.error('調整用戶積分錯誤:', error);
      throw error;
    }
  }

  // 獲取會員積分交易記錄
  async getMemberPointTransactions(memberId: string, limit = 20): Promise<LoyaltyPointTransaction[]> {
    try {
      const response = await apiClient.get(`/admin/loyalty/members/${memberId}/transactions`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('獲取會員積分交易記錄錯誤:', error);
      throw error;
    }
  }

  // 查詢指定區間的會員積分交易記錄
  async getMemberPointTransactionsByDateRange(
    memberId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<LoyaltyPointTransaction[]> {
    try {
      const response = await apiClient.get(`/admin/loyalty/members/${memberId}/transactions`, {
        params: { 
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });
      return response.data;
    } catch (error) {
      console.error('獲取會員區間積分交易記錄錯誤:', error);
      throw error;
    }
  }
}

export const loyaltyService = new LoyaltyService(); 