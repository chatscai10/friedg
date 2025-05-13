/**
 * 優惠券模板模擬數據文件
 * 提供符合API返回格式的優惠券模板模擬數據
 */

import { CouponTemplate } from '../services/couponService';

// 優惠券模板模擬數據
export const mockCouponTemplatesData = {
  data: [
    {
      templateId: 'templ-001',
      tenantId: 'default_tenant',
      name: '新用戶9折優惠',
      description: '新用戶首次購物可享9折優惠',
      type: 'percentage' as const,
      value: 10,
      validityType: 'dynamic' as const,
      validDays: 30,
      maxIssueCount: 1000,
      maxUsagePerCoupon: 1,
      maxUsagePerMember: 1,
      constraints: {
        minOrderAmount: 0,
        maxDiscountAmount: 500
      },
      distributionChannels: ['manual', 'system'] as const,
      targetTags: ['new_user'],
      isActive: true,
      createdAt: new Date('2024-01-15T08:00:00Z'),
      updatedAt: new Date('2024-01-15T08:00:00Z'),
      createdBy: 'system'
    },
    {
      templateId: 'templ-002',
      tenantId: 'default_tenant',
      name: '生日禮金券',
      description: '會員生日月可領取的200元生日禮金券',
      type: 'fixed' as const,
      value: 200,
      validityType: 'dynamic' as const,
      validDays: 30,
      maxUsagePerCoupon: 1,
      constraints: {
        minOrderAmount: 500,
        excludedCategories: ['cat-005'] // 排除甜點類別
      },
      distributionChannels: ['birthday'] as const,
      targetTiers: ['tier-002', 'tier-003', 'tier-004'], // 銀級以上會員
      isActive: true,
      createdAt: new Date('2024-01-20T09:30:00Z'),
      updatedAt: new Date('2024-01-20T09:30:00Z'),
      createdBy: 'admin'
    },
    {
      templateId: 'templ-003',
      tenantId: 'default_tenant',
      name: '免運費券',
      description: '單筆訂單滿1000元可使用的免運費優惠',
      type: 'shipping' as const,
      value: 0,
      validityType: 'fixed' as const,
      validStartDate: new Date('2024-03-01T00:00:00Z'),
      validEndDate: new Date('2024-06-30T23:59:59Z'),
      maxIssueCount: 500,
      maxUsagePerCoupon: 1,
      maxUsagePerMember: 3,
      constraints: {
        minOrderAmount: 1000
      },
      distributionChannels: ['manual', 'campaign'] as const,
      isActive: true,
      createdAt: new Date('2024-02-25T10:00:00Z'),
      updatedAt: new Date('2024-02-25T10:00:00Z'),
      createdBy: 'admin'
    },
    {
      templateId: 'templ-004',
      tenantId: 'default_tenant',
      name: '炸雞買一送一',
      description: '指定炸雞品項買一送一優惠',
      type: 'freeItem' as const,
      value: 1,
      validityType: 'fixed' as const,
      validStartDate: new Date('2024-04-01T00:00:00Z'),
      validEndDate: new Date('2024-04-30T23:59:59Z'),
      maxIssueCount: 300,
      maxUsagePerCoupon: 1,
      constraints: {
        applicableCategories: ['cat-001'], // 僅適用於炸雞系列
        applicableProducts: ['item-001', 'item-002'] // 僅適用於特定產品
      },
      distributionChannels: ['campaign', 'loyalty'] as const,
      isActive: true,
      createdAt: new Date('2024-03-15T11:30:00Z'),
      updatedAt: new Date('2024-03-15T11:30:00Z'),
      createdBy: 'admin'
    },
    {
      templateId: 'templ-005',
      tenantId: 'default_tenant',
      name: '套餐85折優惠',
      description: '套餐系列享85折優惠',
      type: 'percentage' as const,
      value: 15,
      validityType: 'dynamic' as const,
      validDays: 15,
      maxIssueCount: 200,
      maxUsagePerCoupon: 1,
      constraints: {
        applicableCategories: ['cat-004'], // 僅適用於套餐
        minOrderAmount: 250,
        maxDiscountAmount: 300
      },
      distributionChannels: ['manual', 'system'] as const,
      isActive: false, // 未啟用模板，用於測試isActive篩選
      createdAt: new Date('2024-03-20T14:00:00Z'),
      updatedAt: new Date('2024-03-20T14:00:00Z'),
      createdBy: 'admin'
    }
  ],
  pagination: {
    total: 5,
    currentPage: 1,
    totalPages: 1
  }
};

/**
 * 獲取優惠券模板列表的模擬數據
 * 支持根據isActive參數篩選
 */
export const getMockCouponTemplates = (params: Record<string, unknown> = {}) => {
  // 複製一份數據以避免修改原始數據
  const result = { ...mockCouponTemplatesData };
  
  // 根據isActive參數篩選
  if (params.isActive !== undefined) {
    const isActive = params.isActive === 'true' || params.isActive === true;
    result.data = mockCouponTemplatesData.data.filter(template => template.isActive === isActive);
    result.pagination.total = result.data.length;
  }
  
  // 根據type參數篩選
  if (params.type) {
    result.data = result.data.filter(template => template.type === params.type);
    result.pagination.total = result.data.length;
  }
  
  return result;
};

/**
 * 獲取指定ID的優惠券模板
 */
export const getMockCouponTemplateById = (id: string): CouponTemplate | null => {
  return mockCouponTemplatesData.data.find(template => template.templateId === id) || null;
}; 