/**
 * 庫存資料恢復服務
 * 
 * 處理庫存模組中的軟刪除與資料恢復功能
 */
import * as admin from 'firebase-admin';
import { firestoreProvider } from '../db/database.provider';
import { withErrorHandling, ErrorContext } from '../utils/error-handler';
import { RecordDeletedError, PermissionDeniedError } from '../utils/errors';
import { cacheManager, CacheLevel, CachePrefix } from '../cache/cache-manager';

/**
 * 恢復操作結果
 */
export interface RestorationResult {
  /** 操作是否成功 */
  success: boolean;
  /** 恢復的記錄ID */
  recordId: string;
  /** 記錄類型 */
  recordType: string;
  /** 恢復時間戳 */
  restoredAt: Date;
  /** 操作執行者ID */
  restoredBy: string;
  /** 恢復前的狀態 */
  previousState?: any;
  /** 恢復後的狀態 */
  currentState?: any;
}

/**
 * 刪除操作結果
 */
export interface DeletionResult {
  /** 操作是否成功 */
  success: boolean;
  /** 刪除的記錄ID */
  recordId: string;
  /** 記錄類型 */
  recordType: string;
  /** 是否永久刪除 */
  isPermanent: boolean;
  /** 刪除時間戳 */
  deletedAt: Date;
  /** 操作執行者ID */
  deletedBy: string;
}

/**
 * 刪除歷史記錄
 */
export interface DeletionHistory {
  /** 記錄ID */
  recordId: string;
  /** 記錄類型 */
  recordType: string;
  /** 刪除時間戳 */
  deletedAt: Date;
  /** 刪除操作執行者ID */
  deletedBy: string;
  /** 刪除原因 */
  reason?: string;
  /** 是否永久刪除 */
  isPermanent: boolean;
  /** 刪除前的記錄狀態 */
  previousState?: any;
  /** 恢復狀態 */
  restorationStatus?: {
    /** 是否已恢復 */
    isRestored: boolean;
    /** 恢復時間戳 */
    restoredAt?: Date;
    /** 恢復操作執行者ID */
    restoredBy?: string;
    /** 恢復原因 */
    reason?: string;
  };
}

/**
 * 記錄審計活動類型
 */
export enum AuditActivityType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SOFT_DELETE = 'soft_delete',
  RESTORE = 'restore',
  VIEW = 'view'
}

/**
 * 庫存資料恢復服務類
 */
export class RestorationService {
  private readonly deletionHistoryCollection = 'deletionHistory';
  private readonly restorationHistoryCollection = 'restorationHistory';
  
  /**
   * 軟刪除記錄
   * @param collectionPath 集合路徑
   * @param recordId 記錄ID
   * @param userId 執行操作的用戶ID
   * @param tenantId 租戶ID
   * @param reason 刪除原因
   */
  async softDeleteRecord(
    collectionPath: string,
    recordId: string,
    userId: string,
    tenantId: string,
    reason?: string
  ): Promise<DeletionResult> {
    const errorContext: ErrorContext = {
      component: 'RestorationService',
      operation: '軟刪除記錄',
      identity: { userId, tenantId },
      metadata: { collectionPath, recordId }
    };
    
    return withErrorHandling(async () => {
      // 記錄類型是集合名稱的最後一部分
      const recordType = this.getCollectionName(collectionPath);
      
      // 取得記錄引用
      const recordRef = firestoreProvider.getDocRef(
        collectionPath,
        recordId,
        { tenantId }
      );
      
      // 使用事務處理刪除和歷史記錄
      return firestoreProvider.runTransaction(async (transaction) => {
        // 獲取當前記錄
        const recordSnapshot = await transaction.get(recordRef);
        
        if (!recordSnapshot.exists) {
          throw new Error(`找不到記錄: ${recordId}`);
        }
        
        const recordData = recordSnapshot.data() as any;
        
        // 檢查記錄是否已被刪除
        if (recordData.deletedAt) {
          throw new RecordDeletedError(recordType, recordId);
        }
        
        const now = admin.firestore.FieldValue.serverTimestamp();
        
        // 更新記錄為已刪除狀態
        transaction.update(recordRef, {
          deletedAt: now,
          updatedAt: now,
          deletedBy: userId
        });
        
        // 創建刪除歷史記錄
        const historyRef = firestoreProvider.getCollectionRef(
          this.deletionHistoryCollection,
          { tenantId }
        ).doc();
        
        // 存儲刪除歷史
        transaction.set(historyRef, {
          recordId,
          recordType,
          collectionPath,
          deletedAt: now,
          deletedBy: userId,
          reason: reason || null,
          isPermanent: false,
          tenantId,
          previousState: {
            ...recordData,
            _path: recordRef.path
          },
          restorationStatus: {
            isRestored: false
          },
          createdAt: now
        });
        
        // 清除相關緩存
        this.invalidateRelatedCaches(tenantId, recordType, recordId);
        
        // 記錄審計日誌
        this.logAuditActivity(
          transaction,
          tenantId,
          userId,
          AuditActivityType.SOFT_DELETE,
          recordType,
          recordId,
          reason
        );
        
        return {
          success: true,
          recordId,
          recordType,
          isPermanent: false,
          deletedAt: new Date(),
          deletedBy: userId
        };
      });
    }, errorContext);
  }
  
  /**
   * 永久刪除記錄
   * @param collectionPath 集合路徑
   * @param recordId 記錄ID
   * @param userId 執行操作的用戶ID
   * @param tenantId 租戶ID
   * @param reason 刪除原因
   */
  async permanentlyDeleteRecord(
    collectionPath: string,
    recordId: string,
    userId: string,
    tenantId: string,
    reason?: string
  ): Promise<DeletionResult> {
    const errorContext: ErrorContext = {
      component: 'RestorationService',
      operation: '永久刪除記錄',
      identity: { userId, tenantId },
      metadata: { collectionPath, recordId },
      isCritical: true // 標記為關鍵操作
    };
    
    return withErrorHandling(async () => {
      // 記錄類型是集合名稱的最後一部分
      const recordType = this.getCollectionName(collectionPath);
      
      // 取得記錄引用
      const recordRef = firestoreProvider.getDocRef(
        collectionPath,
        recordId,
        { tenantId }
      );
      
      // 使用事務處理刪除和歷史記錄
      return firestoreProvider.runTransaction(async (transaction) => {
        // 獲取當前記錄
        const recordSnapshot = await transaction.get(recordRef);
        
        if (!recordSnapshot.exists) {
          throw new Error(`找不到記錄: ${recordId}`);
        }
        
        const recordData = recordSnapshot.data() as any;
        const now = admin.firestore.FieldValue.serverTimestamp();
        
        // 創建刪除歷史記錄
        const historyRef = firestoreProvider.getCollectionRef(
          this.deletionHistoryCollection,
          { tenantId }
        ).doc();
        
        // 存儲刪除歷史
        transaction.set(historyRef, {
          recordId,
          recordType,
          collectionPath,
          deletedAt: now,
          deletedBy: userId,
          reason: reason || null,
          isPermanent: true,
          tenantId,
          previousState: {
            ...recordData,
            _path: recordRef.path
          },
          restorationStatus: {
            isRestored: false
          },
          createdAt: now
        });
        
        // 永久刪除記錄
        transaction.delete(recordRef);
        
        // 清除相關緩存
        this.invalidateRelatedCaches(tenantId, recordType, recordId);
        
        // 記錄審計日誌
        this.logAuditActivity(
          transaction,
          tenantId,
          userId,
          AuditActivityType.DELETE,
          recordType,
          recordId,
          reason
        );
        
        return {
          success: true,
          recordId,
          recordType,
          isPermanent: true,
          deletedAt: new Date(),
          deletedBy: userId
        };
      });
    }, errorContext);
  }
  
  /**
   * 恢復已軟刪除的記錄
   * @param recordId 記錄ID
   * @param recordType 記錄類型
   * @param userId 執行操作的用戶ID
   * @param tenantId 租戶ID
   * @param reason 恢復原因
   */
  async restoreRecord(
    recordId: string,
    recordType: string,
    userId: string,
    tenantId: string,
    reason?: string
  ): Promise<RestorationResult> {
    const errorContext: ErrorContext = {
      component: 'RestorationService',
      operation: '恢復已刪除記錄',
      identity: { userId, tenantId },
      metadata: { recordId, recordType }
    };
    
    return withErrorHandling(async () => {
      // 查找刪除歷史記錄
      const historyQuery = await firestoreProvider.query(
        this.deletionHistoryCollection,
        [
          { field: 'recordId', operator: '==', value: recordId },
          { field: 'recordType', operator: '==', value: recordType },
          { field: 'tenantId', operator: '==', value: tenantId },
          { field: 'restorationStatus.isRestored', operator: '==', value: false }
        ],
        { 
          tenantId,
          orderBy: [{ field: 'deletedAt', direction: 'desc' }],
          limit: 1
        }
      );
      
      if (!historyQuery.success || historyQuery.data.length === 0) {
        throw new Error(`找不到 ${recordType} ${recordId} 的刪除記錄`);
      }
      
      const deletionHistory = historyQuery.data[0];
      
      // 檢查是否為永久刪除
      if (deletionHistory.isPermanent) {
        throw new Error(`記錄 ${recordType} ${recordId} 已被永久刪除，無法恢復`);
      }
      
      // 獲取原始集合路徑
      const collectionPath = deletionHistory.collectionPath || 
        this.inferCollectionPath(recordType, tenantId);
      
      // 取得記錄引用
      const recordRef = firestoreProvider.getDocRef(
        collectionPath,
        recordId,
        { tenantId }
      );
      
      // 取得刪除歷史引用
      const historyRef = firestoreProvider.getDocRef(
        this.deletionHistoryCollection,
        deletionHistory.id,
        { tenantId }
      );
      
      // 使用事務處理恢復
      return firestoreProvider.runTransaction(async (transaction) => {
        // 檢查記錄目前狀態
        const recordSnapshot = await transaction.get(recordRef);
        
        if (!recordSnapshot.exists) {
          throw new Error(`記錄 ${recordType} ${recordId} 不存在，無法恢復`);
        }
        
        const recordData = recordSnapshot.data() as any;
        
        // 檢查是否已恢復
        if (!recordData.deletedAt) {
          throw new Error(`記錄 ${recordType} ${recordId} 未被刪除`);
        }
        
        const now = admin.firestore.FieldValue.serverTimestamp();
        
        // 更新記錄為已恢復狀態
        transaction.update(recordRef, {
          deletedAt: null,
          updatedAt: now,
          restoredAt: now,
          restoredBy: userId
        });
        
        // 更新刪除歷史記錄
        transaction.update(historyRef, {
          'restorationStatus.isRestored': true,
          'restorationStatus.restoredAt': now,
          'restorationStatus.restoredBy': userId,
          'restorationStatus.reason': reason || null,
          updatedAt: now
        });
        
        // 創建恢復歷史記錄
        const restorationRef = firestoreProvider.getCollectionRef(
          this.restorationHistoryCollection,
          { tenantId }
        ).doc();
        
        // 存儲恢復歷史
        transaction.set(restorationRef, {
          recordId,
          recordType,
          collectionPath,
          restoredAt: now,
          restoredBy: userId,
          reason: reason || null,
          tenantId,
          previousState: {
            ...recordData,
            _path: recordRef.path
          },
          deletionHistoryId: deletionHistory.id,
          createdAt: now
        });
        
        // 清除相關緩存
        this.invalidateRelatedCaches(tenantId, recordType, recordId);
        
        // 記錄審計日誌
        this.logAuditActivity(
          transaction,
          tenantId,
          userId,
          AuditActivityType.RESTORE,
          recordType,
          recordId,
          reason
        );
        
        return {
          success: true,
          recordId,
          recordType,
          restoredAt: new Date(),
          restoredBy: userId,
          previousState: recordData,
          currentState: {
            ...recordData,
            deletedAt: null,
            restoredAt: now,
            restoredBy: userId
          }
        };
      });
    }, errorContext);
  }
  
  /**
   * 獲取已刪除記錄列表
   * @param tenantId 租戶ID
   * @param recordType 記錄類型（可選）
   * @param page 頁碼
   * @param pageSize 每頁大小
   */
  async listDeletedRecords(
    tenantId: string,
    recordType?: string,
    page = 1,
    pageSize = 20
  ) {
    const errorContext: ErrorContext = {
      component: 'RestorationService',
      operation: '查詢已刪除記錄列表',
      identity: { tenantId }
    };
    
    return withErrorHandling(async () => {
      // 構建查詢條件
      const conditions = [
        { field: 'tenantId', operator: '==', value: tenantId },
        { field: 'restorationStatus.isRestored', operator: '==', value: false }
      ];
      
      if (recordType) {
        conditions.push({ field: 'recordType', operator: '==', value: recordType });
      }
      
      // 查詢刪除歷史
      return firestoreProvider.queryWithPagination(
        this.deletionHistoryCollection,
        conditions,
        page,
        pageSize,
        {
          tenantId,
          orderBy: [{ field: 'deletedAt', direction: 'desc' }],
          countTotal: true
        }
      );
    }, errorContext);
  }
  
  /**
   * 獲取記錄刪除歷史
   * @param recordId 記錄ID
   * @param recordType 記錄類型
   * @param tenantId 租戶ID
   */
  async getRecordDeletionHistory(
    recordId: string,
    recordType: string,
    tenantId: string
  ): Promise<DeletionHistory[]> {
    const errorContext: ErrorContext = {
      component: 'RestorationService',
      operation: '獲取記錄刪除歷史',
      identity: { tenantId },
      metadata: { recordId, recordType }
    };
    
    return withErrorHandling(async () => {
      // 查詢刪除歷史
      const result = await firestoreProvider.query(
        this.deletionHistoryCollection,
        [
          { field: 'recordId', operator: '==', value: recordId },
          { field: 'recordType', operator: '==', value: recordType },
          { field: 'tenantId', operator: '==', value: tenantId }
        ],
        { 
          tenantId,
          orderBy: [{ field: 'deletedAt', direction: 'desc' }]
        }
      );
      
      if (!result.success) {
        throw new Error(`獲取 ${recordType} ${recordId} 的刪除歷史失敗`);
      }
      
      return result.data as DeletionHistory[];
    }, errorContext);
  }
  
  /**
   * 清空已刪除記錄（僅允許有權限的用戶）
   * @param tenantId 租戶ID
   * @param olderThan 清除特定日期前的記錄
   * @param userId 執行操作的用戶ID
   * @param isAdmin 是否為管理員
   */
  async purgeDeletedRecords(
    tenantId: string,
    olderThan: Date,
    userId: string,
    isAdmin: boolean
  ) {
    const errorContext: ErrorContext = {
      component: 'RestorationService',
      operation: '清空已刪除記錄',
      identity: { userId, tenantId },
      isCritical: true // 標記為關鍵操作
    };
    
    return withErrorHandling(async () => {
      // 檢查權限
      if (!isAdmin) {
        throw new PermissionDeniedError('清空已刪除記錄');
      }
      
      // 查詢符合條件的刪除歷史
      const result = await firestoreProvider.query(
        this.deletionHistoryCollection,
        [
          { field: 'tenantId', operator: '==', value: tenantId },
          { field: 'deletedAt', operator: '<', value: olderThan },
          { field: 'isPermanent', operator: '==', value: false },
          { field: 'restorationStatus.isRestored', operator: '==', value: false }
        ],
        { tenantId }
      );
      
      if (!result.success || result.data.length === 0) {
        return { success: true, purgedCount: 0 };
      }
      
      const records = result.data;
      let purgedCount = 0;
      
      // 分批處理記錄
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        // 使用批量寫入永久刪除記錄
        const operations = batch.flatMap(record => {
          const recordRef = firestoreProvider.getDocRef(
            record.collectionPath,
            record.recordId,
            { tenantId }
          );
          
          const historyRef = firestoreProvider.getDocRef(
            this.deletionHistoryCollection,
            record.id,
            { tenantId }
          );
          
          return [
            {
              type: 'delete' as const,
              collection: record.collectionPath,
              id: record.recordId,
              options: { tenantId }
            },
            {
              type: 'update' as const,
              collection: this.deletionHistoryCollection,
              id: record.id,
              data: {
                isPermanent: true,
                purgedAt: admin.firestore.FieldValue.serverTimestamp(),
                purgedBy: userId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              },
              options: { tenantId }
            }
          ];
        });
        
        const batchResult = await firestoreProvider.batchWrite(operations);
        
        if (batchResult.success) {
          purgedCount += batch.length;
        }
      }
      
      return { success: true, purgedCount };
    }, errorContext);
  }
  
  // #region 輔助方法
  
  /**
   * 從集合路徑獲取集合名稱
   * @private
   */
  private getCollectionName(collectionPath: string): string {
    const parts = collectionPath.split('/');
    return parts[parts.length - 1];
  }
  
  /**
   * 根據記錄類型推斷集合路徑
   * @private
   */
  private inferCollectionPath(recordType: string, tenantId: string): string {
    // 根據記錄類型推斷集合路徑
    // 例如: 'inventoryItems' => 'inventoryItems'
    //       'stockLevels' => 'stockLevels'
    return recordType;
  }
  
  /**
   * 清除相關緩存
   * @private
   */
  private invalidateRelatedCaches(
    tenantId: string,
    recordType: string,
    recordId: string
  ): void {
    // 根據記錄類型清除相關緩存
    switch (recordType) {
      case 'inventoryItems':
        cacheManager.invalidateByPrefix(`${CachePrefix.INVENTORY_ITEM}${tenantId}_${recordId}`);
        cacheManager.invalidateByPrefix(`${CachePrefix.LIST}inventoryItems_${tenantId}`);
        break;
        
      case 'stockLevels':
        cacheManager.invalidateByPrefix(`${CachePrefix.STOCK_LEVEL}${tenantId}_${recordId}`);
        cacheManager.invalidateByPrefix(`${CachePrefix.LIST}stockLevels_${tenantId}`);
        break;
        
      case 'stockAdjustments':
        cacheManager.invalidateByPrefix(`${CachePrefix.STOCK_ADJUSTMENT}${tenantId}_${recordId}`);
        cacheManager.invalidateByPrefix(`${CachePrefix.LIST}adjustments_${tenantId}`);
        break;
        
      default:
        // 對於未知類型，清除該類型的列表緩存
        cacheManager.invalidateByPrefix(`${CachePrefix.LIST}${recordType}_${tenantId}`);
        break;
    }
  }
  
  /**
   * 記錄審計活動
   * @private
   */
  private logAuditActivity(
    transaction: admin.firestore.Transaction,
    tenantId: string,
    userId: string,
    activityType: AuditActivityType,
    recordType: string,
    recordId: string,
    reason?: string
  ): void {
    try {
      // 創建審計日誌
      const auditRef = firestoreProvider.getCollectionRef(
        'auditLogs',
        { tenantId }
      ).doc();
      
      transaction.set(auditRef, {
        tenantId,
        userId,
        activityType,
        recordType,
        recordId,
        reason: reason || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: null, // 在實際應用中，可以從上下文取得
        userAgent: null  // 在實際應用中，可以從上下文取得
      });
    } catch (error) {
      // 審計日誌寫入失敗不應影響主要操作
      console.error('記錄審計活動失敗:', error);
    }
  }
  
  // #endregion 輔助方法
} 