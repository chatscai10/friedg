/**
 * 授權檢查服務
 * 用於檢查系統授權狀態和功能限制
 */

import { api } from './api';

// 授權類型
export enum LicenseType {
  TRIAL = 'trial',
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

// 授權狀態
export enum LicenseStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

// 授權信息
export interface License {
  id: string;
  tenantId: string;
  type: LicenseType;
  status: LicenseStatus;
  features: string[];
  maxStores: number;
  maxUsers: number;
  startDate: any;
  endDate: any;
  createdAt: any;
  updatedAt: any;
  licenseKey: string;
  activationCode?: string;
  notes?: string;
}

// 授權檢查結果
export interface LicenseCheckResult {
  isValid: boolean;
  license?: License;
  message?: string;
  daysRemaining?: number;
}

// 授權緩存
let licenseCache: LicenseCheckResult | null = null;
let lastCheckTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分鐘

/**
 * 授權檢查服務類
 */
export class LicenseService {
  /**
   * 檢查授權狀態
   */
  async checkLicense(forceRefresh = false): Promise<LicenseCheckResult> {
    try {
      const now = Date.now();
      
      // 如果有緩存且未過期且不強制刷新，直接返回緩存
      if (
        !forceRefresh && 
        licenseCache && 
        now - lastCheckTime < CACHE_DURATION
      ) {
        return licenseCache;
      }
      
      // 調用API檢查授權
      const response = await api.get<LicenseCheckResult>('/license/check');
      
      // 更新緩存
      licenseCache = response;
      lastCheckTime = now;
      
      return response;
    } catch (error) {
      console.error('檢查授權失敗:', error);
      
      // 如果有緩存，返回緩存
      if (licenseCache) {
        return licenseCache;
      }
      
      // 否則返回無效授權
      return {
        isValid: false,
        message: '檢查授權失敗: ' + (error.message || '未知錯誤')
      };
    }
  }
  
  /**
   * 激活授權
   */
  async activateLicense(activationCode: string): Promise<LicenseCheckResult> {
    try {
      // 調用API激活授權
      const response = await api.post<LicenseCheckResult>('/license/activate', {
        activationCode
      });
      
      // 更新緩存
      licenseCache = response;
      lastCheckTime = Date.now();
      
      return response;
    } catch (error) {
      console.error('激活授權失敗:', error);
      throw error;
    }
  }
  
  /**
   * 檢查是否有特定功能的權限
   */
  async hasFeature(feature: string): Promise<boolean> {
    try {
      const licenseResult = await this.checkLicense();
      
      // 如果授權無效，返回false
      if (!licenseResult.isValid || !licenseResult.license) {
        return false;
      }
      
      // 檢查授權是否有效
      if (licenseResult.license.status !== LicenseStatus.ACTIVE) {
        return false;
      }
      
      // 檢查是否有該功能
      return licenseResult.license.features.includes(feature);
    } catch (error) {
      console.error('檢查功能權限失敗:', error);
      return false;
    }
  }
  
  /**
   * 檢查是否超過店鋪數量限制
   */
  async checkStoreLimit(currentStoreCount: number): Promise<boolean> {
    try {
      const licenseResult = await this.checkLicense();
      
      // 如果授權無效，返回false
      if (!licenseResult.isValid || !licenseResult.license) {
        return false;
      }
      
      // 檢查授權是否有效
      if (licenseResult.license.status !== LicenseStatus.ACTIVE) {
        return false;
      }
      
      // 檢查是否超過店鋪數量限制
      return currentStoreCount < licenseResult.license.maxStores;
    } catch (error) {
      console.error('檢查店鋪限制失敗:', error);
      return false;
    }
  }
  
  /**
   * 檢查是否超過用戶數量限制
   */
  async checkUserLimit(currentUserCount: number): Promise<boolean> {
    try {
      const licenseResult = await this.checkLicense();
      
      // 如果授權無效，返回false
      if (!licenseResult.isValid || !licenseResult.license) {
        return false;
      }
      
      // 檢查授權是否有效
      if (licenseResult.license.status !== LicenseStatus.ACTIVE) {
        return false;
      }
      
      // 檢查是否超過用戶數量限制
      return currentUserCount < licenseResult.license.maxUsers;
    } catch (error) {
      console.error('檢查用戶限制失敗:', error);
      return false;
    }
  }
  
  /**
   * 獲取授權類型名稱
   */
  getLicenseTypeName(type: LicenseType): string {
    switch (type) {
      case LicenseType.TRIAL:
        return '試用版';
      case LicenseType.BASIC:
        return '基礎版';
      case LicenseType.STANDARD:
        return '標準版';
      case LicenseType.PREMIUM:
        return '高級版';
      case LicenseType.ENTERPRISE:
        return '企業版';
      default:
        return type;
    }
  }
  
  /**
   * 獲取授權狀態名稱
   */
  getLicenseStatusName(status: LicenseStatus): string {
    switch (status) {
      case LicenseStatus.ACTIVE:
        return '有效';
      case LicenseStatus.EXPIRED:
        return '已過期';
      case LicenseStatus.SUSPENDED:
        return '已暫停';
      case LicenseStatus.PENDING:
        return '待啟用';
      default:
        return status;
    }
  }
  
  /**
   * 獲取功能名稱
   */
  getFeatureName(feature: string): string {
    const featureNames: Record<string, string> = {
      'basic_pos': '基本POS功能',
      'advanced_pos': '進階POS功能',
      'basic_inventory': '基本庫存管理',
      'advanced_inventory': '進階庫存管理',
      'basic_employee': '基本員工管理',
      'advanced_employee': '進階員工管理',
      'basic_reports': '基本報表',
      'advanced_reports': '進階報表與分析',
      'basic_customer': '基本顧客管理',
      'advanced_customer': '進階顧客關係管理',
      'offline_mode': '離線模式',
      'api_access': 'API存取',
      'line_pay': 'LINE Pay整合',
      'delivery_integration': '外送平台整合',
      'custom_branding': '自訂品牌',
      'priority_support': '優先支援',
      'data_export': '資料匯出',
      'multi_language': '多語言支援'
    };
    
    return featureNames[feature] || feature;
  }
}

// 創建單例實例
export const licenseService = new LicenseService();
