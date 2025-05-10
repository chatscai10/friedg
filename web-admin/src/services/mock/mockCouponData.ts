import { AxiosRequestConfig } from 'axios';
import { CouponTemplate } from '../couponService';

// 模擬優惠券模板數據
const templates: CouponTemplate[] = [
  {
    templateId: 'template-001',
    tenantId: 'default_tenant',
    name: '新用戶優惠',
    description: '新用戶首次消費享9折優惠',
    type: 'percentage',
    value: 10,
    validityType: 'dynamic',
    validDays: 30,
    maxIssueCount: 1000,
    maxUsagePerCoupon: 1,
    maxUsagePerMember: 1,
    constraints: {
      minOrderAmount: 200,
      maxDiscountAmount: 100
    },
    distributionChannels: ['system', 'campaign'],
    isActive: true,
    createdAt: new Date('2024-01-15T00:00:00Z') as unknown as string,
    createdBy: 'admin'
  },
  {
    templateId: 'template-002',
    tenantId: 'default_tenant',
    name: '生日禮券',
    description: '會員生日月份消費享8折優惠',
    type: 'percentage',
    value: 20,
    validityType: 'dynamic',
    validDays: 30,
    maxUsagePerCoupon: 1,
    constraints: {
      minOrderAmount: 300,
      maxDiscountAmount: 200
    },
    distributionChannels: ['birthday', 'manual'],
    targetTiers: ['tier-002', 'tier-003', 'tier-004'],
    isActive: true,
    createdAt: new Date('2024-01-20T00:00:00Z') as unknown as string,
    createdBy: 'admin'
  },
  {
    templateId: 'template-003',
    tenantId: 'default_tenant',
    name: '100元折扣券',
    description: '消費滿500元現折100元',
    type: 'fixed',
    value: 100,
    validityType: 'fixed',
    validStartDate: new Date('2024-05-01T00:00:00Z') as unknown as string,
    validEndDate: new Date('2024-05-31T23:59:59Z') as unknown as string,
    maxIssueCount: 500,
    maxUsagePerCoupon: 1,
    constraints: {
      minOrderAmount: 500
    },
    distributionChannels: ['campaign', 'manual'],
    isActive: true,
    createdAt: new Date('2024-04-20T00:00:00Z') as unknown as string,
    createdBy: 'admin'
  },
  {
    templateId: 'template-004',
    tenantId: 'default_tenant',
    name: '飲料免費券',
    description: '消費任何品項即贈送飲料一杯',
    type: 'freeItem',
    value: 0,
    validityType: 'fixed',
    validStartDate: new Date('2024-06-01T00:00:00Z') as unknown as string,
    validEndDate: new Date('2024-06-30T23:59:59Z') as unknown as string,
    maxIssueCount: 200,
    maxUsagePerCoupon: 1,
    constraints: {
      applicableProducts: ['item-004'],
      minOrderAmount: 200
    },
    distributionChannels: ['loyalty', 'manual'],
    targetTiers: ['tier-003', 'tier-004'],
    isActive: true,
    createdAt: new Date('2024-05-15T00:00:00Z') as unknown as string,
    createdBy: 'admin'
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

// 模擬優惠券數據處理函數
export const mockCouponData = {
  // 獲取優惠券模板列表
  getTemplates: (config: AxiosRequestConfig) => {
    const { params } = parseParams(config);
    let result = [...templates];
    
    // 處理篩選條件
    if (params.onlyActive !== undefined) {
      result = result.filter(template => template.isActive === (params.onlyActive === 'true' || params.onlyActive === true));
    }
    
    return result;
  },
  
  // 根據ID獲取優惠券模板
  getTemplateById: (config: AxiosRequestConfig) => {
    const { id } = parseParams(config);
    const template = templates.find(template => template.templateId === id);
    
    if (!template) {
      throw {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { message: `優惠券模板不存在: ${id}` }
        }
      };
    }
    
    return template;
  }
}; 