/**
 * 動態股權系統 - 法律配置服務
 * 
 * 提供對LegalConfig的管理操作，包括獲取和更新法律配置信息
 */

import * as admin from 'firebase-admin';
import { LegalConfig } from '../equity.types';

export class LegalConfigService {
  private db: FirebaseFirestore.Firestore;
  private legalConfigCollection: FirebaseFirestore.CollectionReference;

  constructor() {
    this.db = admin.firestore();
    this.legalConfigCollection = this.db.collection('legal_configs');
  }

  /**
   * 獲取指定店鋪的法律配置
   * @param storeId 店鋪ID
   * @param tenantId 租戶ID
   * @returns 法律配置對象
   */
  async getLegalConfig(storeId: string, tenantId: string): Promise<LegalConfig | null> {
    try {
      const configId = `${tenantId}_${storeId}`;
      const configDoc = await this.legalConfigCollection.doc(configId).get();
      
      if (!configDoc.exists) {
        return null;
      }
      
      return configDoc.data() as LegalConfig;
    } catch (error) {
      console.error('獲取法律配置時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 更新指定店鋪的法律配置
   * @param storeId 店鋪ID
   * @param tenantId 租戶ID
   * @param configData 更新的配置數據
   * @returns 更新後的配置資料
   */
  async updateLegalConfig(storeId: string, tenantId: string, configData: Partial<LegalConfig>): Promise<LegalConfig> {
    try {
      const configId = `${tenantId}_${storeId}`;
      const configRef = this.legalConfigCollection.doc(configId);
      const now = admin.firestore.Timestamp.now();
      
      const existingConfig = await configRef.get();
      
      if (existingConfig.exists) {
        // 更新現有配置
        await configRef.update({
          ...configData,
          updatedAt: now
        });
      } else {
        // 創建新配置
        await configRef.set({
          configId,
          storeId,
          tenantId,
          ...configData,
          createdAt: now,
          updatedAt: now
        });
      }
      
      // 獲取更新後的配置
      const updatedConfig = await configRef.get();
      return updatedConfig.data() as LegalConfig;
    } catch (error) {
      console.error('更新法律配置時發生錯誤:', error);
      throw error;
    }
  }
}

export default new LegalConfigService(); 