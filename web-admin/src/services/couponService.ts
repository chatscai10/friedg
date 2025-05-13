import apiClient from './api';
import { mockConfig, simulateNetworkDelay, mockLog, USE_MOCK_DATA } from '../mockConfig';
import { getMockCouponTemplates, getMockCouponTemplateById, getMockCouponTemplate, listMockCouponTemplates } from '../mock-data/couponMockData';

// 優惠券模板相關接口
export interface CouponTemplate {
  templateId: string;
  tenantId: string;
  name: string;
  description: string;
  type: 'percentage' | 'fixed' | 'freeItem' | 'shipping';
  value: number;
  validityType: 'fixed' | 'dynamic';
  validStartDate?: Date;
  validEndDate?: Date;
  validDays?: number;
  maxIssueCount?: number;
  maxUsagePerCoupon: number;
  maxUsagePerMember?: number;
  constraints: {
    minOrderAmount?: number;
    maxDiscountAmount?: number;
    applicableProducts?: string[];
    applicableCategories?: string[];
    excludedProducts?: string[];
    excludedCategories?: string[];
    applicableStores?: string[];
  };
  distributionChannels: ('system' | 'manual' | 'campaign' | 'birthday' | 'loyalty')[];
  campaignId?: string;
  targetTiers?: string[];
  targetTags?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
}

// 優惠券實例相關接口
export interface CouponInstance {
  couponId: string;
  templateId?: string;
  code: string;
  type: 'percentage' | 'fixed' | 'freeItem' | 'shipping';
  value: number;
  description: string;
  memberId: string;
  tenantId: string;
  storeId?: string;
  issuedAt: Date;
  expiryDate: Date;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  usageCount: number;
  maxUsage: number;
  lastUsedAt?: Date;
  lastOrderId?: string;
  source: 'system' | 'manual' | 'campaign' | 'birthday' | 'loyalty' | 'referral';
  sourceId?: string;
  constraints: {
    minOrderAmount?: number;
    maxDiscountAmount?: number;
    applicableProducts?: string[];
    applicableCategories?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// 優惠券使用記錄相關接口
export interface CouponRedemption {
  redemptionId: string;
  couponId: string;
  couponCode: string;
  orderId: string;
  memberId: string;
  tenantId: string;
  storeId?: string;
  discountType: 'percentage' | 'fixed' | 'freeItem' | 'shipping';
  discountValue: number;
  discountAmount: number;
  orderAmount: number;
  usedAt: Date;
  createdAt: Date;
}

// 驗證優惠券請求接口
export interface ValidateCouponRequest {
  code: string;
  userId: string;
  orderDetails?: {
    amount: number;
    items?: Array<{
      id: string;
      categoryId: string;
    }>;
  };
}

// 驗證優惠券回應接口
export interface ValidateCouponResponse {
  valid: boolean;
  message?: string;
  couponId?: string;
  couponData?: CouponInstance;
  discountAmount?: number;
  finalAmount?: number;
}

// 發放優惠券請求接口
export interface IssueCouponRequest {
  templateId?: string;
  userId: string;
  type: 'percentage' | 'fixed' | 'freeItem' | 'shipping';
  value: number;
  description: string;
  expiryDate: Date | string;
  maxUsage: number;
  source: 'manual' | 'system' | 'campaign' | 'birthday' | 'loyalty' | 'referral';
  sourceId?: string;
  constraints?: {
    minOrderAmount?: number;
    maxDiscountAmount?: number;
    applicableProducts?: string[];
    applicableCategories?: string[];
  };
}

// 優惠券服務類
class CouponService {
  // 優惠券模板 CRUD 操作
  async createTemplate(templateData: Omit<CouponTemplate, 'templateId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const response = await apiClient.post('/admin/coupons/templates', templateData);
      return response.data.templateId;
    } catch (error) {
      console.error('創建優惠券模板錯誤:', error);
      throw error;
    }
  }

  async updateTemplate(templateId: string, templateData: Partial<CouponTemplate>): Promise<boolean> {
    try {
      await apiClient.put(`/admin/coupons/templates/${templateId}`, templateData);
      return true;
    } catch (error) {
      console.error('更新優惠券模板錯誤:', error);
      throw error;
    }
  }

  async getTemplate(templateId: string): Promise<CouponTemplate> {
    try {
      if (mockConfig.USE_MOCK_DATA) {
        mockLog(`獲取優惠券模板 ID: ${templateId} (模擬數據)`);
        await simulateNetworkDelay();
        const template = getMockCouponTemplateById(templateId);
        if (!template) {
          throw new Error(`優惠券模板不存在: ${templateId}`);
        }
        return template;
      }

      const response = await apiClient.get(`/admin/coupons/templates/${templateId}`);
      return response.data;
    } catch (error) {
      console.error('獲取優惠券模板錯誤:', error);
      throw error;
    }
  }

  async listTemplates(onlyActive = false): Promise<{ data: CouponTemplate[], pagination: { total: number } }> {
    try {
      if (mockConfig.USE_MOCK_DATA) {
        mockLog(`獲取優惠券模板列表 (模擬數據)`);
        await simulateNetworkDelay();
        return getMockCouponTemplates({ isActive: onlyActive });
      }

      const response = await apiClient.get('/admin/coupons/templates', {
        params: { isActive: onlyActive }
      });
      return response.data;
    } catch (error) {
      console.error('列出優惠券模板錯誤:', error);
      throw error;
    }
  }

  // 優惠券實例相關操作
  async issueCoupon(couponData: IssueCouponRequest): Promise<string> {
    try {
      const response = await apiClient.post('/admin/coupons/issue', couponData);
      return response.data.couponId;
    } catch (error) {
      console.error('發放優惠券錯誤:', error);
      throw error;
    }
  }

  async getUserCoupons(userId: string, status: 'active' | 'used' | 'expired' | 'all' = 'active'): Promise<CouponInstance[]> {
    try {
      const response = await apiClient.get('/admin/coupons', {
        params: { userId, status }
      });
      return response.data;
    } catch (error) {
      console.error('獲取用戶優惠券錯誤:', error);
      throw error;
    }
  }

  // 批量發送優惠券（根據用戶標籤或等級）
  async batchIssueCoupons(templateId: string, options: {
    targetTiers?: string[];
    targetTags?: string[];
    expiryDate?: Date | string;
  }): Promise<{ success: boolean; count: number }> {
    try {
      const response = await apiClient.post('/admin/coupons/batch-issue', {
        templateId,
        ...options
      });
      return {
        success: true,
        count: response.data.count
      };
    } catch (error) {
      console.error('批量發放優惠券錯誤:', error);
      throw error;
    }
  }

  // 優惠券驗證相關操作
  async validateCoupon(validateData: ValidateCouponRequest): Promise<ValidateCouponResponse> {
    try {
      const response = await apiClient.post('/coupons/validate', validateData);
      return response.data;
    } catch (error) {
      console.error('驗證優惠券錯誤:', error);
      throw error;
    }
  }

  // 獲取優惠券使用紀錄
  async getCouponRedemptions(couponId: string): Promise<CouponRedemption[]> {
    try {
      const response = await apiClient.get(`/admin/coupons/${couponId}/redemptions`);
      return response.data;
    } catch (error) {
      console.error('獲取優惠券使用紀錄錯誤:', error);
      throw error;
    }
  }

  // 獲取會員優惠券使用紀錄
  async getMemberCouponRedemptions(memberId: string, limit = 20): Promise<CouponRedemption[]> {
    try {
      const response = await apiClient.get(`/admin/members/${memberId}/coupon-redemptions`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('獲取會員優惠券使用紀錄錯誤:', error);
      throw error;
    }
  }

  // 標記優惠券為已使用（通常由訂單處理過程自動處理，這裡提供手動操作的API）
  async markCouponUsed(couponId: string, orderId: string, userId: string): Promise<boolean> {
    try {
      await apiClient.post(`/admin/coupons/${couponId}/use`, {
        orderId,
        userId
      });
      return true;
    } catch (error) {
      console.error('標記優惠券已使用錯誤:', error);
      throw error;
    }
  }

  // 取消優惠券（使優惠券失效）
  async cancelCoupon(couponId: string, reason: string): Promise<boolean> {
    try {
      await apiClient.post(`/admin/coupons/${couponId}/cancel`, { reason });
      return true;
    } catch (error) {
      console.error('取消優惠券錯誤:', error);
      throw error;
    }
  }
}

export const couponService = new CouponService(); 