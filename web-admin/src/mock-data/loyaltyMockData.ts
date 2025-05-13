/**
 * 忠誠度計劃模擬數據文件
 * 提供符合API返回格式的會員等級規則和可兌換獎勵模擬數據
 */

import { LoyaltyTierRule, LoyaltyReward } from '../services/loyaltyService';

// 會員等級規則模擬數據
export const mockLoyaltyTiersData = {
  data: [
    {
      tierId: 'tier-001',
      tenantId: 'default_tenant',
      name: 'regular',
      displayName: '一般會員',
      level: 1,
      pointsThreshold: 0,
      pointsMultiplier: 1,
      validityPeriod: 365,
      renewalPolicy: 'automatic' as const,
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
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
      renewalPolicy: 'points_renewal' as const,
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
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
      renewalPolicy: 'points_renewal' as const,
      gracePeriod: 30,
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
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
      orderCountThreshold: 20,
      pointsMultiplier: 2,
      discountPercentage: 15,
      birthdayBonus: 500,
      freeShipping: true,
      exclusiveAccess: true,
      specialServices: ['專屬客服', '優先訂位'],
      validityPeriod: 365,
      renewalPolicy: 'annual_review' as const,
      gracePeriod: 60,
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      createdBy: 'system'
    },
    {
      tierId: 'tier-005',
      tenantId: 'default_tenant',
      name: 'diamond',
      displayName: '鑽石會員',
      level: 5,
      pointsThreshold: 20000,
      spendingThreshold: 50000,
      orderCountThreshold: 50,
      pointsMultiplier: 3,
      discountPercentage: 20,
      birthdayBonus: 1000,
      freeShipping: true,
      exclusiveAccess: true,
      specialServices: ['專屬客服', '優先訂位', '生日禮物', '免費品嚐新品'],
      validityPeriod: 365,
      renewalPolicy: 'annual_review' as const,
      gracePeriod: 90,
      isActive: false, // 未啟用等級，用於測試isActive篩選
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      createdBy: 'system'
    }
  ],
  pagination: {
    total: 5,
    currentPage: 1,
    totalPages: 1
  }
};

// 可兌換獎勵模擬數據
export const mockLoyaltyRewardsData = {
  data: [
    {
      rewardId: 'reward-001',
      tenantId: 'default_tenant',
      name: '九折優惠券',
      description: '可在任何消費中使用的九折優惠券',
      imageUrl: 'https://via.placeholder.com/150?text=10%Off',
      type: 'coupon' as const,
      pointsCost: 500,
      value: 100,
      details: {
        couponType: 'percentage' as const,
        discountValue: 10,
        validDays: 30,
        minOrderAmount: 0
      },
      isActive: true,
      createdAt: new Date('2024-02-01T00:00:00Z'),
      updatedAt: new Date('2024-02-01T00:00:00Z'),
      createdBy: 'system'
    },
    {
      rewardId: 'reward-002',
      tenantId: 'default_tenant',
      name: '100元折價券',
      description: '訂單滿500元可使用的100元折價券',
      imageUrl: 'https://via.placeholder.com/150?text=100NT',
      type: 'coupon' as const,
      pointsCost: 800,
      value: 100,
      details: {
        couponType: 'fixed' as const,
        discountValue: 100,
        validDays: 60,
        minOrderAmount: 500
      },
      isActive: true,
      createdAt: new Date('2024-02-01T00:00:00Z'),
      updatedAt: new Date('2024-02-01T00:00:00Z'),
      createdBy: 'system'
    },
    {
      rewardId: 'reward-003',
      tenantId: 'default_tenant',
      name: '免費小杯飲料',
      description: '可兌換門市任一小杯飲料',
      imageUrl: 'https://via.placeholder.com/150?text=FreeDrink',
      type: 'product' as const,
      pointsCost: 300,
      value: 50,
      details: {
        productId: 'product-001',
        validDays: 30
      },
      limitPerMember: 3,
      minimumTier: 'tier-002', // 銀級會員
      isActive: true,
      createdAt: new Date('2024-02-01T00:00:00Z'),
      updatedAt: new Date('2024-02-01T00:00:00Z'),
      createdBy: 'system'
    },
    {
      rewardId: 'reward-004',
      tenantId: 'default_tenant',
      name: '炸雞套餐8折',
      description: '任何炸雞套餐享有8折優惠',
      imageUrl: 'https://via.placeholder.com/150?text=20%Off',
      type: 'coupon' as const,
      pointsCost: 1200,
      value: 250,
      details: {
        couponType: 'percentage' as const,
        discountValue: 20,
        validDays: 45,
        minOrderAmount: 0
      },
      startDate: new Date('2024-03-01T00:00:00Z'),
      endDate: new Date('2024-12-31T23:59:59Z'),
      totalStock: 1000,
      remainingStock: 850,
      limitPerMember: 2,
      minimumTier: 'tier-003', // 金級會員
      isActive: true,
      createdAt: new Date('2024-02-01T00:00:00Z'),
      updatedAt: new Date('2024-02-01T00:00:00Z'),
      createdBy: 'system'
    },
    {
      rewardId: 'reward-005',
      tenantId: 'default_tenant',
      name: '生日驚喜禮',
      description: '會員生日月專屬兌換禮品',
      imageUrl: 'https://via.placeholder.com/150?text=BirthdayGift',
      type: 'service' as const,
      pointsCost: 2000,
      value: 500,
      details: {
        serviceId: 'birthday-service-001',
        validDays: 30
      },
      startDate: new Date('2024-01-01T00:00:00Z'),
      endDate: new Date('2024-12-31T23:59:59Z'),
      limitPerMember: 1,
      minimumTier: 'tier-004', // 白金會員
      isActive: false, // 測試未啟用獎勵
      createdAt: new Date('2024-02-01T00:00:00Z'),
      updatedAt: new Date('2024-02-01T00:00:00Z'),
      createdBy: 'system'
    }
  ],
  pagination: {
    total: 5,
    currentPage: 1,
    totalPages: 1
  }
};

/**
 * 獲取會員等級規則列表的模擬數據
 * 支持根據isActive參數篩選
 */
export const getMockLoyaltyTiers = (params: Record<string, unknown> = {}) => {
  // 複製一份數據以避免修改原始數據
  const result = { ...mockLoyaltyTiersData };
  
  // 根據isActive參數篩選
  if (params.isActive !== undefined) {
    const isActive = params.isActive === 'true' || params.isActive === true;
    result.data = mockLoyaltyTiersData.data.filter(tier => tier.isActive === isActive);
    result.pagination.total = result.data.length;
  }
  
  return result;
};

/**
 * 獲取可兌換獎勵列表的模擬數據
 * 支持根據isActive參數篩選
 */
export const getMockLoyaltyRewards = (params: Record<string, unknown> = {}) => {
  // 複製一份數據以避免修改原始數據
  const result = { ...mockLoyaltyRewardsData };
  
  // 根據isActive參數篩選
  if (params.isActive !== undefined) {
    const isActive = params.isActive === 'true' || params.isActive === true;
    result.data = mockLoyaltyRewardsData.data.filter(reward => reward.isActive === isActive);
    result.pagination.total = result.data.length;
  }
  
  // 根據minimumTier參數篩選
  if (params.minimumTier) {
    result.data = result.data.filter(reward => 
      !reward.minimumTier || reward.minimumTier === params.minimumTier
    );
    result.pagination.total = result.data.length;
  }
  
  return result;
};

/**
 * 獲取指定ID的會員等級規則
 */
export const getMockLoyaltyTierById = (id: string): LoyaltyTierRule | null => {
  return mockLoyaltyTiersData.data.find(tier => tier.tierId === id) || null;
};

/**
 * 獲取指定ID的可兌換獎勵
 */
export const getMockLoyaltyRewardById = (id: string): LoyaltyReward | null => {
  return mockLoyaltyRewardsData.data.find(reward => reward.rewardId === id) || null;
}; 