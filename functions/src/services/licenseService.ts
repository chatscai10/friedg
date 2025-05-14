/**
 * 授權管理服務
 * 處理系統的授權和試用期限制
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as crypto from 'crypto';

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
  startDate: admin.firestore.Timestamp;
  endDate: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
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

/**
 * 授權管理服務類
 */
export class LicenseService {
  private db: admin.firestore.Firestore;
  private encryptionKey: string;
  
  constructor() {
    this.db = admin.firestore();
    // 從環境變數獲取加密密鑰，或使用默認值
    this.encryptionKey = process.env.LICENSE_ENCRYPTION_KEY || 'friedg-license-key-2023';
  }
  
  /**
   * 創建新授權
   */
  async createLicense(tenantId: string, type: LicenseType, durationDays: number): Promise<License> {
    try {
      const now = admin.firestore.Timestamp.now();
      const endDate = new Date(now.toDate().getTime() + durationDays * 24 * 60 * 60 * 1000);
      
      // 生成授權密鑰
      const licenseKey = this.generateLicenseKey(tenantId, type);
      
      // 根據授權類型設置功能和限制
      const features = this.getFeaturesForLicenseType(type);
      const { maxStores, maxUsers } = this.getLimitsForLicenseType(type);
      
      // 創建授權記錄
      const licenseData: License = {
        id: crypto.randomUUID(),
        tenantId,
        type,
        status: LicenseStatus.ACTIVE,
        features,
        maxStores,
        maxUsers,
        startDate: now,
        endDate: admin.firestore.Timestamp.fromDate(endDate),
        createdAt: now,
        updatedAt: now,
        licenseKey,
        activationCode: this.generateActivationCode()
      };
      
      // 保存到數據庫
      await this.db.collection('licenses').doc(licenseData.id).set(licenseData);
      
      // 更新租戶的授權信息
      await this.db.collection('tenants').doc(tenantId).update({
        licenseId: licenseData.id,
        licenseType: type,
        licenseStatus: LicenseStatus.ACTIVE,
        licenseEndDate: admin.firestore.Timestamp.fromDate(endDate)
      });
      
      return licenseData;
    } catch (error) {
      console.error('創建授權失敗:', error);
      throw new functions.https.HttpsError('internal', '創建授權失敗', error);
    }
  }
  
  /**
   * 檢查租戶的授權狀態
   */
  async checkLicense(tenantId: string): Promise<LicenseCheckResult> {
    try {
      // 獲取租戶信息
      const tenantDoc = await this.db.collection('tenants').doc(tenantId).get();
      
      if (!tenantDoc.exists) {
        return {
          isValid: false,
          message: '租戶不存在'
        };
      }
      
      const tenantData = tenantDoc.data();
      const licenseId = tenantData?.licenseId;
      
      // 如果沒有授權ID，創建試用版授權
      if (!licenseId) {
        const trialLicense = await this.createLicense(tenantId, LicenseType.TRIAL, 30);
        
        return {
          isValid: true,
          license: trialLicense,
          message: '已創建30天試用版授權',
          daysRemaining: 30
        };
      }
      
      // 獲取授權信息
      const licenseDoc = await this.db.collection('licenses').doc(licenseId).get();
      
      if (!licenseDoc.exists) {
        return {
          isValid: false,
          message: '授權記錄不存在'
        };
      }
      
      const license = licenseDoc.data() as License;
      
      // 檢查授權狀態
      if (license.status === LicenseStatus.SUSPENDED) {
        return {
          isValid: false,
          license,
          message: '授權已被暫停'
        };
      }
      
      // 檢查授權是否過期
      const now = admin.firestore.Timestamp.now();
      
      if (license.endDate.toMillis() < now.toMillis()) {
        // 更新授權狀態為過期
        await this.db.collection('licenses').doc(licenseId).update({
          status: LicenseStatus.EXPIRED,
          updatedAt: now
        });
        
        // 更新租戶的授權狀態
        await this.db.collection('tenants').doc(tenantId).update({
          licenseStatus: LicenseStatus.EXPIRED
        });
        
        return {
          isValid: false,
          license: {
            ...license,
            status: LicenseStatus.EXPIRED
          },
          message: '授權已過期'
        };
      }
      
      // 計算剩餘天數
      const daysRemaining = Math.ceil((license.endDate.toMillis() - now.toMillis()) / (24 * 60 * 60 * 1000));
      
      return {
        isValid: true,
        license,
        daysRemaining
      };
    } catch (error) {
      console.error('檢查授權失敗:', error);
      throw new functions.https.HttpsError('internal', '檢查授權失敗', error);
    }
  }
  
  /**
   * 更新授權
   */
  async updateLicense(licenseId: string, updates: Partial<License>): Promise<License> {
    try {
      const now = admin.firestore.Timestamp.now();
      
      // 獲取當前授權
      const licenseDoc = await this.db.collection('licenses').doc(licenseId).get();
      
      if (!licenseDoc.exists) {
        throw new Error('授權記錄不存在');
      }
      
      const license = licenseDoc.data() as License;
      
      // 更新授權
      const updatedLicense = {
        ...license,
        ...updates,
        updatedAt: now
      };
      
      // 保存到數據庫
      await this.db.collection('licenses').doc(licenseId).update(updatedLicense);
      
      // 更新租戶的授權信息
      if (updates.type || updates.status || updates.endDate) {
        const updateData: any = {
          licenseStatus: updates.status || license.status
        };
        
        if (updates.type) {
          updateData.licenseType = updates.type;
        }
        
        if (updates.endDate) {
          updateData.licenseEndDate = updates.endDate;
        }
        
        await this.db.collection('tenants').doc(license.tenantId).update(updateData);
      }
      
      return updatedLicense;
    } catch (error) {
      console.error('更新授權失敗:', error);
      throw new functions.https.HttpsError('internal', '更新授權失敗', error);
    }
  }
  
  /**
   * 延長授權期限
   */
  async extendLicense(licenseId: string, additionalDays: number): Promise<License> {
    try {
      // 獲取當前授權
      const licenseDoc = await this.db.collection('licenses').doc(licenseId).get();
      
      if (!licenseDoc.exists) {
        throw new Error('授權記錄不存在');
      }
      
      const license = licenseDoc.data() as License;
      
      // 計算新的結束日期
      const currentEndDate = license.endDate.toDate();
      const newEndDate = new Date(currentEndDate.getTime() + additionalDays * 24 * 60 * 60 * 1000);
      
      // 更新授權
      return await this.updateLicense(licenseId, {
        endDate: admin.firestore.Timestamp.fromDate(newEndDate),
        status: LicenseStatus.ACTIVE
      });
    } catch (error) {
      console.error('延長授權失敗:', error);
      throw new functions.https.HttpsError('internal', '延長授權失敗', error);
    }
  }
  
  /**
   * 激活授權
   */
  async activateLicense(tenantId: string, activationCode: string): Promise<LicenseCheckResult> {
    try {
      // 查找匹配的授權
      const licensesSnapshot = await this.db.collection('licenses')
        .where('activationCode', '==', activationCode)
        .limit(1)
        .get();
      
      if (licensesSnapshot.empty) {
        return {
          isValid: false,
          message: '無效的激活碼'
        };
      }
      
      const licenseDoc = licensesSnapshot.docs[0];
      const license = licenseDoc.data() as License;
      
      // 檢查授權是否已被使用
      if (license.tenantId && license.tenantId !== tenantId) {
        return {
          isValid: false,
          message: '此激活碼已被其他租戶使用'
        };
      }
      
      // 更新授權
      const now = admin.firestore.Timestamp.now();
      const endDate = new Date(now.toDate().getTime() + 365 * 24 * 60 * 60 * 1000); // 1年
      
      const updatedLicense = await this.updateLicense(license.id, {
        tenantId,
        status: LicenseStatus.ACTIVE,
        startDate: now,
        endDate: admin.firestore.Timestamp.fromDate(endDate)
      });
      
      return {
        isValid: true,
        license: updatedLicense,
        message: '授權激活成功',
        daysRemaining: 365
      };
    } catch (error) {
      console.error('激活授權失敗:', error);
      throw new functions.https.HttpsError('internal', '激活授權失敗', error);
    }
  }
  
  /**
   * 生成授權密鑰
   */
  private generateLicenseKey(tenantId: string, type: LicenseType): string {
    const data = `${tenantId}-${type}-${Date.now()}`;
    const hash = crypto.createHmac('sha256', this.encryptionKey).update(data).digest('hex');
    
    // 格式化為 XXXX-XXXX-XXXX-XXXX 格式
    return [
      hash.substring(0, 4),
      hash.substring(4, 8),
      hash.substring(8, 12),
      hash.substring(12, 16)
    ].join('-').toUpperCase();
  }
  
  /**
   * 生成激活碼
   */
  private generateActivationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
    let code = '';
    
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) {
        code += '-';
      }
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code;
  }
  
  /**
   * 獲取授權類型對應的功能
   */
  private getFeaturesForLicenseType(type: LicenseType): string[] {
    switch (type) {
      case LicenseType.TRIAL:
        return [
          'basic_pos',
          'basic_inventory',
          'basic_employee',
          'basic_reports'
        ];
      case LicenseType.BASIC:
        return [
          'basic_pos',
          'basic_inventory',
          'basic_employee',
          'basic_reports',
          'basic_customer'
        ];
      case LicenseType.STANDARD:
        return [
          'basic_pos',
          'advanced_pos',
          'basic_inventory',
          'advanced_inventory',
          'basic_employee',
          'advanced_employee',
          'basic_reports',
          'advanced_reports',
          'basic_customer',
          'offline_mode'
        ];
      case LicenseType.PREMIUM:
        return [
          'basic_pos',
          'advanced_pos',
          'basic_inventory',
          'advanced_inventory',
          'basic_employee',
          'advanced_employee',
          'basic_reports',
          'advanced_reports',
          'basic_customer',
          'advanced_customer',
          'offline_mode',
          'api_access',
          'line_pay',
          'delivery_integration'
        ];
      case LicenseType.ENTERPRISE:
        return [
          'basic_pos',
          'advanced_pos',
          'basic_inventory',
          'advanced_inventory',
          'basic_employee',
          'advanced_employee',
          'basic_reports',
          'advanced_reports',
          'basic_customer',
          'advanced_customer',
          'offline_mode',
          'api_access',
          'line_pay',
          'delivery_integration',
          'custom_branding',
          'priority_support',
          'data_export',
          'multi_language'
        ];
      default:
        return [];
    }
  }
  
  /**
   * 獲取授權類型對應的限制
   */
  private getLimitsForLicenseType(type: LicenseType): { maxStores: number; maxUsers: number } {
    switch (type) {
      case LicenseType.TRIAL:
        return { maxStores: 1, maxUsers: 5 };
      case LicenseType.BASIC:
        return { maxStores: 1, maxUsers: 10 };
      case LicenseType.STANDARD:
        return { maxStores: 3, maxUsers: 30 };
      case LicenseType.PREMIUM:
        return { maxStores: 10, maxUsers: 100 };
      case LicenseType.ENTERPRISE:
        return { maxStores: 999, maxUsers: 999 };
      default:
        return { maxStores: 0, maxUsers: 0 };
    }
  }
}
