/**
 * 敏感資料加密服務
 * 負責對個人資料、支付資訊等進行加密和解密
 */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

// 加密算法
export enum EncryptionAlgorithm {
  AES_256_GCM = 'aes-256-gcm',
  AES_256_CBC = 'aes-256-cbc'
}

// 加密數據
export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag?: string;
  algorithm: EncryptionAlgorithm;
}

/**
 * 敏感資料加密服務類
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private encryptionKey: Buffer | null = null;
  private kmsClient: admin.kms.Key | null = null;
  private defaultAlgorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_256_GCM;
  
  /**
   * 私有構造函數，防止直接實例化
   */
  private constructor() {}
  
  /**
   * 獲取單例實例
   */
  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }
  
  /**
   * 初始化加密服務
   * @param keyOrKeyName 加密密鑰或KMS密鑰名稱
   * @param useKMS 是否使用KMS
   */
  public async initialize(keyOrKeyName: string, useKMS: boolean = false): Promise<void> {
    if (useKMS) {
      // 使用Google Cloud KMS
      try {
        // 初始化KMS客戶端
        const keyName = keyOrKeyName;
        this.kmsClient = admin.kms().key(keyName);
      } catch (error) {
        console.error('初始化KMS客戶端失敗:', error);
        throw new Error('初始化加密服務失敗');
      }
    } else {
      // 使用本地密鑰
      try {
        // 將密鑰轉換為Buffer
        const key = keyOrKeyName;
        // 如果密鑰長度不是32字節(256位)，則使用SHA-256哈希
        if (Buffer.from(key).length !== 32) {
          this.encryptionKey = crypto.createHash('sha256').update(key).digest();
        } else {
          this.encryptionKey = Buffer.from(key);
        }
      } catch (error) {
        console.error('初始化加密密鑰失敗:', error);
        throw new Error('初始化加密服務失敗');
      }
    }
  }
  
  /**
   * 加密數據
   * @param plaintext 明文
   * @param algorithm 加密算法
   * @returns 加密後的數據
   */
  public async encrypt(plaintext: string, algorithm: EncryptionAlgorithm = this.defaultAlgorithm): Promise<EncryptedData> {
    if (this.kmsClient) {
      // 使用KMS加密
      return this.encryptWithKMS(plaintext);
    } else if (this.encryptionKey) {
      // 使用本地密鑰加密
      return this.encryptWithLocalKey(plaintext, algorithm);
    } else {
      throw new Error('加密服務未初始化');
    }
  }
  
  /**
   * 解密數據
   * @param encryptedData 加密數據
   * @returns 明文
   */
  public async decrypt(encryptedData: EncryptedData): Promise<string> {
    if (this.kmsClient) {
      // 使用KMS解密
      return this.decryptWithKMS(encryptedData);
    } else if (this.encryptionKey) {
      // 使用本地密鑰解密
      return this.decryptWithLocalKey(encryptedData);
    } else {
      throw new Error('加密服務未初始化');
    }
  }
  
  /**
   * 使用本地密鑰加密
   * @param plaintext 明文
   * @param algorithm 加密算法
   * @returns 加密後的數據
   */
  private encryptWithLocalKey(plaintext: string, algorithm: EncryptionAlgorithm): EncryptedData {
    if (!this.encryptionKey) {
      throw new Error('加密密鑰未初始化');
    }
    
    // 生成隨機初始化向量
    const iv = crypto.randomBytes(16);
    
    let cipher: crypto.CipherGCM | crypto.Cipher;
    if (algorithm === EncryptionAlgorithm.AES_256_GCM) {
      cipher = crypto.createCipheriv(algorithm, this.encryptionKey, iv) as crypto.CipherGCM;
    } else {
      cipher = crypto.createCipheriv(algorithm, this.encryptionKey, iv);
    }
    
    // 加密數據
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // 構建加密數據對象
    const encryptedData: EncryptedData = {
      ciphertext: encrypted,
      iv: iv.toString('base64'),
      algorithm
    };
    
    // 如果是GCM模式，添加認證標籤
    if (algorithm === EncryptionAlgorithm.AES_256_GCM) {
      const authTag = (cipher as crypto.CipherGCM).getAuthTag();
      encryptedData.authTag = authTag.toString('base64');
    }
    
    return encryptedData;
  }
  
  /**
   * 使用本地密鑰解密
   * @param encryptedData 加密數據
   * @returns 明文
   */
  private decryptWithLocalKey(encryptedData: EncryptedData): string {
    if (!this.encryptionKey) {
      throw new Error('加密密鑰未初始化');
    }
    
    const { ciphertext, iv, authTag, algorithm } = encryptedData;
    
    // 將Base64編碼的IV轉換為Buffer
    const ivBuffer = Buffer.from(iv, 'base64');
    
    let decipher: crypto.DecipherGCM | crypto.Decipher;
    if (algorithm === EncryptionAlgorithm.AES_256_GCM) {
      decipher = crypto.createDecipheriv(algorithm, this.encryptionKey, ivBuffer) as crypto.DecipherGCM;
      
      // 設置認證標籤
      if (authTag) {
        (decipher as crypto.DecipherGCM).setAuthTag(Buffer.from(authTag, 'base64'));
      } else {
        throw new Error('GCM模式解密需要認證標籤');
      }
    } else {
      decipher = crypto.createDecipheriv(algorithm, this.encryptionKey, ivBuffer);
    }
    
    // 解密數據
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * 使用KMS加密
   * @param plaintext 明文
   * @returns 加密後的數據
   */
  private async encryptWithKMS(plaintext: string): Promise<EncryptedData> {
    if (!this.kmsClient) {
      throw new Error('KMS客戶端未初始化');
    }
    
    try {
      // 使用KMS加密
      const [encryptResponse] = await this.kmsClient.encrypt({
        plaintext: Buffer.from(plaintext).toString('base64')
      });
      
      // 構建加密數據對象
      const encryptedData: EncryptedData = {
        ciphertext: encryptResponse.ciphertext || '',
        iv: '', // KMS不需要IV
        algorithm: EncryptionAlgorithm.AES_256_GCM // KMS使用AES-256-GCM
      };
      
      return encryptedData;
    } catch (error) {
      console.error('KMS加密失敗:', error);
      throw new Error('加密失敗');
    }
  }
  
  /**
   * 使用KMS解密
   * @param encryptedData 加密數據
   * @returns 明文
   */
  private async decryptWithKMS(encryptedData: EncryptedData): Promise<string> {
    if (!this.kmsClient) {
      throw new Error('KMS客戶端未初始化');
    }
    
    try {
      // 使用KMS解密
      const [decryptResponse] = await this.kmsClient.decrypt({
        ciphertext: encryptedData.ciphertext
      });
      
      // 解析明文
      const plaintext = Buffer.from(decryptResponse.plaintext || '', 'base64').toString('utf8');
      
      return plaintext;
    } catch (error) {
      console.error('KMS解密失敗:', error);
      throw new Error('解密失敗');
    }
  }
  
  /**
   * 生成隨機密鑰
   * @param length 密鑰長度（字節）
   * @returns 隨機密鑰（Base64編碼）
   */
  public static generateRandomKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64');
  }
  
  /**
   * 哈希密碼
   * @param password 密碼
   * @param salt 鹽（可選，如果不提供則生成隨機鹽）
   * @returns 哈希結果和鹽
   */
  public static hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    // 如果沒有提供鹽，則生成隨機鹽
    const useSalt = salt || crypto.randomBytes(16).toString('hex');
    
    // 使用PBKDF2算法哈希密碼
    const hash = crypto.pbkdf2Sync(password, useSalt, 10000, 64, 'sha512').toString('hex');
    
    return { hash, salt: useSalt };
  }
  
  /**
   * 驗證密碼
   * @param password 待驗證的密碼
   * @param hash 存儲的哈希值
   * @param salt 存儲的鹽
   * @returns 是否匹配
   */
  public static verifyPassword(password: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return verifyHash === hash;
  }
}

// 導出單例實例
export const encryptionService = EncryptionService.getInstance();
