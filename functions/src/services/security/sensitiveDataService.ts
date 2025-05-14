/**
 * 敏感資料處理服務
 * 負責處理和保護敏感資料
 */

import * as admin from 'firebase-admin';
import { encryptionService, EncryptedData, EncryptionAlgorithm } from './encryptionService';

// 敏感欄位類型
export enum SensitiveFieldType {
  PHONE_NUMBER = 'phoneNumber',
  EMAIL = 'email',
  ID_NUMBER = 'idNumber',
  CREDIT_CARD = 'creditCard',
  BANK_ACCOUNT = 'bankAccount',
  ADDRESS = 'address',
  LINE_ID = 'lineId',
  CUSTOM = 'custom'
}

// 敏感欄位配置
export interface SensitiveFieldConfig {
  type: SensitiveFieldType;
  fieldPath: string;
  maskingPattern?: string;
  encryptionRequired: boolean;
  accessLevel: number; // 訪問級別（數字越小，權限越高）
}

/**
 * 敏感資料處理服務類
 */
export class SensitiveDataService {
  private static instance: SensitiveDataService;
  private initialized: boolean = false;
  private sensitiveFieldsConfig: Map<string, SensitiveFieldConfig> = new Map();
  
  /**
   * 私有構造函數，防止直接實例化
   */
  private constructor() {}
  
  /**
   * 獲取單例實例
   */
  public static getInstance(): SensitiveDataService {
    if (!SensitiveDataService.instance) {
      SensitiveDataService.instance = new SensitiveDataService();
    }
    return SensitiveDataService.instance;
  }
  
  /**
   * 初始化敏感資料處理服務
   * @param encryptionKey 加密密鑰
   * @param useKMS 是否使用KMS
   */
  public async initialize(encryptionKey: string, useKMS: boolean = false): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      // 初始化加密服務
      await encryptionService.initialize(encryptionKey, useKMS);
      
      // 從Firestore加載敏感欄位配置
      await this.loadSensitiveFieldsConfig();
      
      this.initialized = true;
    } catch (error) {
      console.error('初始化敏感資料處理服務失敗:', error);
      throw new Error('初始化敏感資料處理服務失敗');
    }
  }
  
  /**
   * 從Firestore加載敏感欄位配置
   */
  private async loadSensitiveFieldsConfig(): Promise<void> {
    try {
      const configSnapshot = await admin.firestore()
        .collection('systemConfig')
        .doc('sensitiveFields')
        .get();
      
      if (configSnapshot.exists) {
        const config = configSnapshot.data() as { fields: SensitiveFieldConfig[] };
        
        if (config && config.fields) {
          config.fields.forEach(field => {
            this.sensitiveFieldsConfig.set(field.fieldPath, field);
          });
        }
      } else {
        // 如果配置不存在，使用默認配置
        this.useDefaultConfig();
      }
    } catch (error) {
      console.error('加載敏感欄位配置失敗:', error);
      // 使用默認配置
      this.useDefaultConfig();
    }
  }
  
  /**
   * 使用默認敏感欄位配置
   */
  private useDefaultConfig(): void {
    // 默認敏感欄位配置
    const defaultConfig: SensitiveFieldConfig[] = [
      {
        type: SensitiveFieldType.PHONE_NUMBER,
        fieldPath: 'customers.phoneNumber',
        maskingPattern: '****-****',
        encryptionRequired: true,
        accessLevel: 2 // 店長以上可訪問
      },
      {
        type: SensitiveFieldType.EMAIL,
        fieldPath: 'customers.email',
        maskingPattern: '***@***.com',
        encryptionRequired: true,
        accessLevel: 2 // 店長以上可訪問
      },
      {
        type: SensitiveFieldType.ID_NUMBER,
        fieldPath: 'employees.idNumber',
        maskingPattern: '********',
        encryptionRequired: true,
        accessLevel: 1 // 租戶管理員以上可訪問
      },
      {
        type: SensitiveFieldType.BANK_ACCOUNT,
        fieldPath: 'employees.bankAccount',
        maskingPattern: '****-****-****',
        encryptionRequired: true,
        accessLevel: 1 // 租戶管理員以上可訪問
      },
      {
        type: SensitiveFieldType.LINE_ID,
        fieldPath: 'customers.lineId',
        encryptionRequired: true,
        accessLevel: 2 // 店長以上可訪問
      },
      {
        type: SensitiveFieldType.CREDIT_CARD,
        fieldPath: 'orders.paymentInfo.cardNumber',
        maskingPattern: '****-****-****-****',
        encryptionRequired: true,
        accessLevel: 1 // 租戶管理員以上可訪問
      }
    ];
    
    defaultConfig.forEach(field => {
      this.sensitiveFieldsConfig.set(field.fieldPath, field);
    });
  }
  
  /**
   * 檢查欄位是否為敏感欄位
   * @param fieldPath 欄位路徑
   * @returns 是否為敏感欄位
   */
  public isSensitiveField(fieldPath: string): boolean {
    return this.sensitiveFieldsConfig.has(fieldPath);
  }
  
  /**
   * 獲取敏感欄位配置
   * @param fieldPath 欄位路徑
   * @returns 敏感欄位配置
   */
  public getSensitiveFieldConfig(fieldPath: string): SensitiveFieldConfig | undefined {
    return this.sensitiveFieldsConfig.get(fieldPath);
  }
  
  /**
   * 加密敏感數據
   * @param fieldPath 欄位路徑
   * @param value 欄位值
   * @returns 加密後的數據
   */
  public async encryptSensitiveData(fieldPath: string, value: string): Promise<EncryptedData> {
    if (!this.initialized) {
      throw new Error('敏感資料處理服務未初始化');
    }
    
    const fieldConfig = this.sensitiveFieldsConfig.get(fieldPath);
    
    if (!fieldConfig || !fieldConfig.encryptionRequired) {
      throw new Error(`欄位 ${fieldPath} 不需要加密或不是敏感欄位`);
    }
    
    return encryptionService.encrypt(value);
  }
  
  /**
   * 解密敏感數據
   * @param fieldPath 欄位路徑
   * @param encryptedData 加密數據
   * @param userAccessLevel 用戶訪問級別
   * @returns 解密後的數據
   */
  public async decryptSensitiveData(fieldPath: string, encryptedData: EncryptedData, userAccessLevel: number): Promise<string> {
    if (!this.initialized) {
      throw new Error('敏感資料處理服務未初始化');
    }
    
    const fieldConfig = this.sensitiveFieldsConfig.get(fieldPath);
    
    if (!fieldConfig) {
      throw new Error(`欄位 ${fieldPath} 不是敏感欄位`);
    }
    
    // 檢查用戶是否有權限訪問此敏感欄位
    if (userAccessLevel > fieldConfig.accessLevel) {
      throw new Error(`用戶無權訪問欄位 ${fieldPath}`);
    }
    
    return encryptionService.decrypt(encryptedData);
  }
  
  /**
   * 遮罩敏感數據
   * @param fieldPath 欄位路徑
   * @param value 欄位值
   * @returns 遮罩後的數據
   */
  public maskSensitiveData(fieldPath: string, value: string): string {
    const fieldConfig = this.sensitiveFieldsConfig.get(fieldPath);
    
    if (!fieldConfig || !fieldConfig.maskingPattern) {
      // 如果沒有配置或沒有遮罩模式，使用默認遮罩
      return this.defaultMask(value);
    }
    
    return this.applyMaskingPattern(value, fieldConfig.maskingPattern, fieldConfig.type);
  }
  
  /**
   * 應用遮罩模式
   * @param value 原始值
   * @param pattern 遮罩模式
   * @param type 欄位類型
   * @returns 遮罩後的值
   */
  private applyMaskingPattern(value: string, pattern: string, type: SensitiveFieldType): string {
    if (!value) return '';
    
    switch (type) {
      case SensitiveFieldType.PHONE_NUMBER:
        return this.maskPhoneNumber(value, pattern);
      case SensitiveFieldType.EMAIL:
        return this.maskEmail(value, pattern);
      case SensitiveFieldType.ID_NUMBER:
        return this.maskIdNumber(value, pattern);
      case SensitiveFieldType.CREDIT_CARD:
        return this.maskCreditCard(value, pattern);
      case SensitiveFieldType.BANK_ACCOUNT:
        return this.maskBankAccount(value, pattern);
      default:
        return this.defaultMask(value);
    }
  }
  
  /**
   * 遮罩電話號碼
   * @param phoneNumber 電話號碼
   * @param pattern 遮罩模式
   * @returns 遮罩後的電話號碼
   */
  private maskPhoneNumber(phoneNumber: string, pattern: string): string {
    // 移除非數字字符
    const digits = phoneNumber.replace(/\D/g, '');
    
    if (digits.length <= 4) {
      return '*'.repeat(digits.length);
    }
    
    // 保留前兩位和後兩位，中間用星號替換
    return digits.substring(0, 2) + '*'.repeat(digits.length - 4) + digits.substring(digits.length - 2);
  }
  
  /**
   * 遮罩電子郵件
   * @param email 電子郵件
   * @param pattern 遮罩模式
   * @returns 遮罩後的電子郵件
   */
  private maskEmail(email: string, pattern: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    
    const username = parts[0];
    const domain = parts[1];
    
    // 遮罩用戶名，保留第一個字符
    const maskedUsername = username.substring(0, 1) + '*'.repeat(Math.max(1, username.length - 1));
    
    return `${maskedUsername}@${domain}`;
  }
  
  /**
   * 遮罩身份證號碼
   * @param idNumber 身份證號碼
   * @param pattern 遮罩模式
   * @returns 遮罩後的身份證號碼
   */
  private maskIdNumber(idNumber: string, pattern: string): string {
    if (idNumber.length <= 4) {
      return '*'.repeat(idNumber.length);
    }
    
    // 保留前兩位和後兩位，中間用星號替換
    return idNumber.substring(0, 2) + '*'.repeat(idNumber.length - 4) + idNumber.substring(idNumber.length - 2);
  }
  
  /**
   * 遮罩信用卡號
   * @param cardNumber 信用卡號
   * @param pattern 遮罩模式
   * @returns 遮罩後的信用卡號
   */
  private maskCreditCard(cardNumber: string, pattern: string): string {
    // 移除非數字字符
    const digits = cardNumber.replace(/\D/g, '');
    
    if (digits.length <= 4) {
      return '*'.repeat(digits.length);
    }
    
    // 只顯示最後四位
    return '*'.repeat(digits.length - 4) + digits.substring(digits.length - 4);
  }
  
  /**
   * 遮罩銀行帳號
   * @param bankAccount 銀行帳號
   * @param pattern 遮罩模式
   * @returns 遮罩後的銀行帳號
   */
  private maskBankAccount(bankAccount: string, pattern: string): string {
    // 移除非數字字符
    const digits = bankAccount.replace(/\D/g, '');
    
    if (digits.length <= 4) {
      return '*'.repeat(digits.length);
    }
    
    // 只顯示最後四位
    return '*'.repeat(digits.length - 4) + digits.substring(digits.length - 4);
  }
  
  /**
   * 默認遮罩方法
   * @param value 原始值
   * @returns 遮罩後的值
   */
  private defaultMask(value: string): string {
    if (!value) return '';
    
    if (value.length <= 2) {
      return '*'.repeat(value.length);
    }
    
    // 保留第一個和最後一個字符，中間用星號替換
    return value.substring(0, 1) + '*'.repeat(value.length - 2) + value.substring(value.length - 1);
  }
  
  /**
   * 處理文檔中的敏感欄位
   * @param data 文檔數據
   * @param parentPath 父路徑
   * @param userAccessLevel 用戶訪問級別
   * @param operation 操作類型（'encrypt'或'decrypt'或'mask'）
   * @returns 處理後的數據
   */
  public async processSensitiveFields(
    data: any,
    parentPath: string = '',
    userAccessLevel: number,
    operation: 'encrypt' | 'decrypt' | 'mask'
  ): Promise<any> {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    const result: any = Array.isArray(data) ? [] : {};
    
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        const currentPath = parentPath ? `${parentPath}.${key}` : key;
        
        if (this.isSensitiveField(currentPath)) {
          // 處理敏感欄位
          if (operation === 'encrypt' && typeof value === 'string') {
            result[key] = await this.encryptSensitiveData(currentPath, value);
          } else if (operation === 'decrypt' && value && typeof value === 'object' && 'ciphertext' in value) {
            try {
              result[key] = await this.decryptSensitiveData(currentPath, value as EncryptedData, userAccessLevel);
            } catch (error) {
              // 如果解密失敗，使用遮罩值
              result[key] = this.maskSensitiveData(currentPath, '********');
            }
          } else if (operation === 'mask' && typeof value === 'string') {
            result[key] = this.maskSensitiveData(currentPath, value);
          } else {
            result[key] = value;
          }
        } else if (value && typeof value === 'object') {
          // 遞歸處理嵌套對象
          result[key] = await this.processSensitiveFields(value, currentPath, userAccessLevel, operation);
        } else {
          // 非敏感欄位，直接複製
          result[key] = value;
        }
      }
    }
    
    return result;
  }
}

// 導出單例實例
export const sensitiveDataService = SensitiveDataService.getInstance();
