/**
 * 備份服務
 * 負責自動備份和恢復Firestore數據
 */

import { firestore, functions } from '../../firebaseConfig';
import { formatDate, formatDateTime } from '../../utils/dateUtils';

// 備份類型
export enum BackupType {
  FULL = 'full',
  INCREMENTAL = 'incremental',
  COLLECTION = 'collection'
}

// 備份狀態
export enum BackupStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled'
}

// 備份記錄
export interface BackupRecord {
  id?: string;
  type: BackupType;
  status: BackupStatus;
  startTime: Date;
  endTime?: Date;
  fileSize?: number;
  filePath?: string;
  collections?: string[];
  error?: string;
  metadata?: Record<string, any>;
  createdBy: string;
}

// 恢復記錄
export interface RestoreRecord {
  id?: string;
  backupId: string;
  status: BackupStatus;
  startTime: Date;
  endTime?: Date;
  collections?: string[];
  error?: string;
  metadata?: Record<string, any>;
  createdBy: string;
}

// 備份配置
export interface BackupConfig {
  id?: string;
  enabled: boolean;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number; // 0-6, 0 is Sunday
    dayOfMonth?: number; // 1-31
    hour: number; // 0-23
    minute: number; // 0-59
  };
  type: BackupType;
  collections?: string[];
  retentionDays: number;
  storageLocation: string;
  notifyEmail?: string;
  lastUpdated: Date;
  updatedBy: string;
}

/**
 * 備份服務類
 */
export class BackupService {
  private readonly backupRecordsCollection = 'backupRecords';
  private readonly restoreRecordsCollection = 'restoreRecords';
  private readonly backupConfigCollection = 'backupConfigs';
  
  /**
   * 獲取備份記錄列表
   * @param limit 限制數量
   * @param offset 偏移量
   * @returns 備份記錄列表
   */
  async getBackupRecords(limit: number = 20, offset: number = 0): Promise<BackupRecord[]> {
    try {
      const recordsSnapshot = await firestore
        .collection(this.backupRecordsCollection)
        .orderBy('startTime', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
      
      return recordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime.toDate(),
        endTime: doc.data().endTime?.toDate()
      } as BackupRecord));
    } catch (error) {
      console.error('獲取備份記錄失敗:', error);
      return [];
    }
  }
  
  /**
   * 獲取恢復記錄列表
   * @param limit 限制數量
   * @param offset 偏移量
   * @returns 恢復記錄列表
   */
  async getRestoreRecords(limit: number = 20, offset: number = 0): Promise<RestoreRecord[]> {
    try {
      const recordsSnapshot = await firestore
        .collection(this.restoreRecordsCollection)
        .orderBy('startTime', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
      
      return recordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime.toDate(),
        endTime: doc.data().endTime?.toDate()
      } as RestoreRecord));
    } catch (error) {
      console.error('獲取恢復記錄失敗:', error);
      return [];
    }
  }
  
  /**
   * 獲取備份配置
   * @returns 備份配置
   */
  async getBackupConfig(): Promise<BackupConfig | null> {
    try {
      const configSnapshot = await firestore
        .collection(this.backupConfigCollection)
        .limit(1)
        .get();
      
      if (configSnapshot.empty) {
        return null;
      }
      
      const doc = configSnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        lastUpdated: doc.data().lastUpdated.toDate()
      } as BackupConfig;
    } catch (error) {
      console.error('獲取備份配置失敗:', error);
      return null;
    }
  }
  
  /**
   * 更新備份配置
   * @param config 備份配置
   * @returns 更新後的備份配置
   */
  async updateBackupConfig(config: BackupConfig): Promise<BackupConfig> {
    try {
      const configData = {
        ...config,
        lastUpdated: new Date()
      };
      
      if (config.id) {
        // 更新現有配置
        await firestore
          .collection(this.backupConfigCollection)
          .doc(config.id)
          .update(configData);
      } else {
        // 創建新配置
        const docRef = await firestore
          .collection(this.backupConfigCollection)
          .add(configData);
        
        configData.id = docRef.id;
      }
      
      return configData;
    } catch (error) {
      console.error('更新備份配置失敗:', error);
      throw new Error('更新備份配置失敗: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  /**
   * 手動創建備份
   * @param type 備份類型
   * @param collections 要備份的集合
   * @param userId 用戶ID
   * @returns 備份記錄
   */
  async createBackup(type: BackupType, collections: string[] = [], userId: string): Promise<BackupRecord> {
    try {
      // 創建備份記錄
      const backupRecord: Omit<BackupRecord, 'id'> = {
        type,
        status: BackupStatus.PENDING,
        startTime: new Date(),
        collections: collections.length > 0 ? collections : undefined,
        createdBy: userId
      };
      
      // 保存備份記錄
      const docRef = await firestore
        .collection(this.backupRecordsCollection)
        .add(backupRecord);
      
      // 調用Cloud Function執行備份
      await functions.httpsCallable('createBackup')({
        backupId: docRef.id,
        type,
        collections: collections.length > 0 ? collections : undefined
      });
      
      return {
        id: docRef.id,
        ...backupRecord
      };
    } catch (error) {
      console.error('創建備份失敗:', error);
      throw new Error('創建備份失敗: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  /**
   * 從備份恢復數據
   * @param backupId 備份ID
   * @param collections 要恢復的集合
   * @param userId 用戶ID
   * @returns 恢復記錄
   */
  async restoreFromBackup(backupId: string, collections: string[] = [], userId: string): Promise<RestoreRecord> {
    try {
      // 檢查備份是否存在
      const backupDoc = await firestore
        .collection(this.backupRecordsCollection)
        .doc(backupId)
        .get();
      
      if (!backupDoc.exists) {
        throw new Error(`備份ID ${backupId} 不存在`);
      }
      
      // 創建恢復記錄
      const restoreRecord: Omit<RestoreRecord, 'id'> = {
        backupId,
        status: BackupStatus.PENDING,
        startTime: new Date(),
        collections: collections.length > 0 ? collections : undefined,
        createdBy: userId
      };
      
      // 保存恢復記錄
      const docRef = await firestore
        .collection(this.restoreRecordsCollection)
        .add(restoreRecord);
      
      // 調用Cloud Function執行恢復
      await functions.httpsCallable('restoreBackup')({
        restoreId: docRef.id,
        backupId,
        collections: collections.length > 0 ? collections : undefined
      });
      
      return {
        id: docRef.id,
        ...restoreRecord
      };
    } catch (error) {
      console.error('從備份恢復數據失敗:', error);
      throw new Error('從備份恢復數據失敗: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  /**
   * 刪除備份
   * @param backupId 備份ID
   * @returns 是否成功
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      // 調用Cloud Function刪除備份
      await functions.httpsCallable('deleteBackup')({
        backupId
      });
      
      return true;
    } catch (error) {
      console.error('刪除備份失敗:', error);
      throw new Error('刪除備份失敗: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  /**
   * 獲取備份詳情
   * @param backupId 備份ID
   * @returns 備份記錄
   */
  async getBackupDetails(backupId: string): Promise<BackupRecord | null> {
    try {
      const doc = await firestore
        .collection(this.backupRecordsCollection)
        .doc(backupId)
        .get();
      
      if (!doc.exists) {
        return null;
      }
      
      return {
        id: doc.id,
        ...doc.data(),
        startTime: doc.data()?.startTime.toDate(),
        endTime: doc.data()?.endTime?.toDate()
      } as BackupRecord;
    } catch (error) {
      console.error('獲取備份詳情失敗:', error);
      return null;
    }
  }
}

export default new BackupService();
