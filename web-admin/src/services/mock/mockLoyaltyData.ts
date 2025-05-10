import { AxiosRequestConfig } from 'axios';
import { LoyaltyTierRule, LoyaltyReward } from '../loyaltyService';

// 模擬會員等級規則數據
const tierRules: LoyaltyTierRule[] = [
  {
    tierId: 'tier-001',
    tenantId: 'default_tenant',
    name: 'regular',
    displayName: '一般會員',
    level: 1,
    pointsThreshold: 0,
    pointsMultiplier: 1,
    validityPeriod: 365,
    renewalPolicy: 'automatic',
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z') as unknown as string,
    createdBy: 'system'
  },
  {
    tierId: 'tier-002',
    tenantId: 'default_tenant',
    name: 'silver',
    displayName: '銀級會員',
    level: 2,
    pointsThreshold: 1000,
    pointsMultiplier: 1.2,
    discountPercentage: 5,
    birthdayBonus: 100,
    validityPeriod: 365,
    renewalPolicy: 'points_renewal',
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z') as unknown as string,
    createdBy: 'system'
  },
  {
    tierId: 'tier-003',
    tenantId: 'default_tenant',
    name: 'gold',
    displayName: '金級會員',
    level: 3,
    pointsThreshold: 5000,
    spendingThreshold: 10000,
    pointsMultiplier: 1.5,
    discountPercentage: 10,
    birthdayBonus: 200,
    freeShipping: true,
    validityPeriod: 365,
    renewalPolicy: 'points_renewal',
    gracePeriod: 30,
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z') as unknown as string,
    createdBy: 'system'
  },
  {
    tierId: 'tier-004',
    tenantId: 'default_tenant',
    name: 'platinum',
    displayName: '白金會員',
    level: 4,
    pointsThreshold: 10000,
    spendingThreshold: 20000,
    orderCountThreshold: 50,
    pointsMultiplier: 2,
    discountPercentage: 15,
    birthdayBonus: 500,
    freeShipping: true,
    exclusiveAccess: true,
    specialServices: ['優先訂位', '專屬客服', '免費送貨'],
    validityPeriod: 365,
    renewalPolicy: 'annual_review',
    gracePeriod: 60,
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z') as unknown as string,
    createdBy: 'system'
  }
];

// 模擬忠誠度獎勵數據
const rewards: LoyaltyReward[] = [
  {
    rewardId: 'reward-001',
    tenantId: 'default_tenant',
    name: '100元折價券',
    description: '使用100點兌換100元折價券，可用於任何訂單',
    type: 'coupon',
    pointsCost: 100,
    value: 100,
    details: {
      couponType: 'fixed',
      discountValue: 100,
      validDays: 30,
      minOrderAmount: 300
    },
    isActive: true,
    createdAt: new Date('2024-02-01T00:00:00Z') as unknown as string,
    createdBy: 'system'
  },
  {
    rewardId: 'reward-002',
    tenantId: 'default_tenant',
    name: '9折優惠券',
    description: '使用150點兌換9折優惠券，可用於任何訂單',
    type: 'coupon',
    pointsCost: 150,
    value: 10,
    details: {
      couponType: 'percentage',
      discountValue: 10,
      validDays: 30
    },
    isActive: true,
    createdAt: new Date('2024-02-01T00:00:00Z') as unknown as string,
    createdBy: 'system'
  },
  {
    rewardId: 'reward-003',
    tenantId: 'default_tenant',
    name: '免費薯條',
    description: '使用80點兌換一份免費薯條',
    type: 'product',
    pointsCost: 80,
    value: 35,
    details: {
      productId: 'item-003'
    },
    isActive: true,
    createdAt: new Date('2024-02-01T00:00:00Z') as unknown as string,
    createdBy: 'system'
  },
  {
    rewardId: 'reward-004',
    tenantId: 'default_tenant',
    name: '免費飲料',
    description: '使用50點兌換一杯免費飲料',
    type: 'product',
    pointsCost: 50,
    value: 25,
    details: {
      productId: 'item-004'
    },
    isActive: true,
    createdAt: new Date('2024-02-01T00:00:00Z') as unknown as string,
    createdBy: 'system'
  }
];

// 處理請求參數的通用函數
const parseParams = (config: AxiosRequestConfig) => {
  const params = config.params || {};
  const url = config.url || '';
  
  // 從URL提取ID (如果存在)
  let id = '';
  const idMatch = url.match(/\/([^/]+)$/);
  if (idMatch) {
    id = idMatch[1];
  }
  
  return { params, id };
};

// 模擬忠誠度數據處理函數
export const mockLoyaltyData = {
  // 獲取會員等級規則列表
  getTierRules: (config: AxiosRequestConfig) => {
    const { params } = parseParams(config);
    let result = [...tierRules];
    
    // 處理篩選條件
    if (params.onlyActive !== undefined) {
      result = result.filter(tier => tier.isActive === (params.onlyActive === 'true' || params.onlyActive === true));
    }
    
    return result;
  },
  
  // 根據ID獲取會員等級規則
  getTierRuleById: (config: AxiosRequestConfig) => {
    const { id } = parseParams(config);
    const tierRule = tierRules.find(tier => tier.tierId === id);
    
    if (!tierRule) {
      throw {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { message: `會員等級規則不存在: ${id}` }
        }
      };
    }
    
    return tierRule;
  },
  
  // 獲取忠誠度獎勵列表
  getRewards: (config: AxiosRequestConfig) => {
    const { params } = parseParams(config);
    let result = [...rewards];
    
    // 處理篩選條件
    if (params.onlyActive !== undefined) {
      result = result.filter(reward => reward.isActive === (params.onlyActive === 'true' || params.onlyActive === true));
    }
    
    return result;
  },
  
  // 根據ID獲取忠誠度獎勵
  getRewardById: (config: AxiosRequestConfig) => {
    const { id } = parseParams(config);
    const reward = rewards.find(reward => reward.rewardId === id);
    
    if (!reward) {
      throw {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { message: `忠誠度獎勵不存在: ${id}` }
        }
      };
    }
    
    return reward;
  }
}; 