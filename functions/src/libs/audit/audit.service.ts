/**
 * 操作日誌 (Audit Log) 模組 - 服務函數
 */
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { AuditLog, AuditLogInput, AuditLogStatus } from './types';
import { logger } from 'firebase-functions';
import { AuditLogEntry, CreateAuditLogParams } from './audit.types';

// 確保已初始化Firebase Admin
try {
  admin.app();
} catch (error) {
  admin.initializeApp();
}

const db = admin.firestore();
const AUDIT_LOGS_COLLECTION = 'auditLogs';

/**
 * 記錄操作日誌事件
 * 
 * 該函數會將操作日誌資訊寫入 Firestore 的 auditLogs 集合
 * 記錄日誌的過程不會阻塞主要業務流程，即使記錄失敗也不會影響主流程
 * 
 * @param logData 操作日誌輸入資料
 * @returns 寫入的操作日誌ID (如果成功)
 */
export const logAuditEvent = async (logData: AuditLogInput): Promise<string | null> => {
  try {
    // 檢查必要欄位
    if (!logData.userId || !logData.action || !logData.targetEntityType || !logData.targetEntityId) {
      console.error('記錄操作日誌失敗: 缺少必要欄位(userId, action, targetEntityType, targetEntityId)');
      return null;
    }

    // 生成日誌ID
    const logId = uuidv4();
    const now = admin.firestore.Timestamp.now();
    
    // 使用輸入資料構建完整的操作日誌對象
    const auditLog: AuditLog = {
      id: logId,
      timestamp: now,
      
      // 操作者資訊
      userId: logData.userId,
      userName: logData.userName,
      userEmail: logData.userEmail,
      userRole: logData.userRole,
      tenantId: logData.tenantId,
      storeId: logData.storeId,
      
      // 操作資訊
      action: logData.action,
      actionCategory: logData.actionCategory,
      status: logData.status || AuditLogStatus.SUCCESS, // 預設為成功
      statusMessage: logData.statusMessage,
      
      // 操作對象
      targetEntityType: logData.targetEntityType,
      targetEntityId: logData.targetEntityId,
      targetEntityName: logData.targetEntityName,
      
      // 詳細資訊
      details: logData.details,
      previousState: logData.previousState,
      newState: logData.newState,
      
      // 環境資訊
      ipAddress: logData.ipAddress,
      userAgent: logData.userAgent,
      requestPath: logData.requestPath,
      requestMethod: logData.requestMethod
    };

    // 寫入 Firestore
    await db.collection(AUDIT_LOGS_COLLECTION).doc(logId).set(auditLog);
    
    // 顯示成功日誌（對於開發環境有用）
    if (process.env.NODE_ENV === 'development') {
      console.log(`操作日誌已記錄: ${logId}, 操作: ${logData.action}, 對象: ${logData.targetEntityType}/${logData.targetEntityId}`);
    }
    
    return logId;
  } catch (error) {
    // 記錄錯誤但不阻止主流程
    console.error('記錄操作日誌時發生錯誤:', error);
    return null;
  }
};

/**
 * 建立分區索引
 * 
 * 為了提高查詢效能，可以使用此函數為操作日誌集合建立分區索引
 * 可視資料量增長情況決定是否啟用此功能
 * 
 * @param datePrefix 日期前綴，格式為 YYYY-MM
 * @returns 成功建立的索引ID
 */
export const createPartitionIndex = async (datePrefix: string): Promise<string | null> => {
  try {
    // 生成分區索引ID
    const indexId = `index-${datePrefix}`;
    
    // 檢查索引是否已經存在
    const indexDoc = await db.collection('auditLogIndices').doc(indexId).get();
    if (indexDoc.exists) {
      console.log(`分區索引 ${indexId} 已存在`);
      return indexId;
    }
    
    // 查詢該時間範圍內的所有日誌
    const startDate = new Date(`${datePrefix}-01T00:00:00Z`);
    let endDate: Date;
    
    // 處理月份邊界
    if (datePrefix.endsWith('12')) { // 12月
      const year = parseInt(datePrefix.split('-')[0]);
      endDate = new Date(`${year + 1}-01-01T00:00:00Z`);
    } else {
      const parts = datePrefix.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      endDate = new Date(`${year}-${month + 1 < 10 ? '0' + (month + 1) : month + 1}-01T00:00:00Z`);
    }
    
    const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
    const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);
    
    // 查詢該時間範圍內的日誌
    const snapshot = await db.collection(AUDIT_LOGS_COLLECTION)
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<', endTimestamp)
      .get();
    
    // 收集日誌ID
    const logIds: string[] = [];
    snapshot.forEach(doc => {
      logIds.push(doc.id);
    });
    
    // 寫入索引文檔
    await db.collection('auditLogIndices').doc(indexId).set({
      datePrefix,
      startTimestamp,
      endTimestamp,
      logCount: logIds.length,
      logIds,
      createdAt: admin.firestore.Timestamp.now()
    });
    
    console.log(`已創建分區索引 ${indexId}，包含 ${logIds.length} 條日誌記錄`);
    return indexId;
  } catch (error) {
    console.error(`創建分區索引時發生錯誤:`, error);
    return null;
  }
};

/**
 * 清理過期的操作日誌
 * 
 * 根據保留策略刪除舊的操作日誌，可設定為定期執行的排程任務
 * 
 * @param retentionDays 保留天數，預設為365天
 * @param batchSize 每批處理的記錄數，預設為500
 * @returns 已刪除的記錄數
 */
export const purgeOldAuditLogs = async (retentionDays: number = 365, batchSize: number = 500): Promise<number> => {
  try {
    // 計算截止日期
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);
    
    // 查詢過期的日誌
    const snapshot = await db.collection(AUDIT_LOGS_COLLECTION)
      .where('timestamp', '<', cutoffTimestamp)
      .limit(batchSize)
      .get();
    
    if (snapshot.empty) {
      console.log(`沒有需要清理的過期操作日誌`);
      return 0;
    }
    
    // 批次刪除
    const batch = db.batch();
    let count = 0;
    
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
      count++;
    });
    
    await batch.commit();
    console.log(`已清理 ${count} 條過期操作日誌`);
    
    // 如果刪除數量等於批次大小，可能還有更多需要清理
    if (count === batchSize) {
      // 遞歸調用以處理剩餘記錄
      const moreDeleted = await purgeOldAuditLogs(retentionDays, batchSize);
      return count + moreDeleted;
    }
    
    return count;
  } catch (error) {
    console.error('清理操作日誌時發生錯誤:', error);
    return 0;
  }
};

/**
 * 記錄審計事件
 * @param logData 審計日誌數據
 * @returns Promise<string> 返回創建的日誌文檔ID
 */
export const logAction = async (logData: CreateAuditLogParams): Promise<string> => {
  try {
    // 設置時間戳，如果沒有提供
    const finalLogData: AuditLogEntry = {
      ...logData,
      timestamp: logData.timestamp || admin.firestore.Timestamp.now(),
    };

    // 移除任何未定義的字段，以防Firestore寫入錯誤
    Object.keys(finalLogData).forEach(key => {
      if (finalLogData[key as keyof AuditLogEntry] === undefined) {
        delete finalLogData[key as keyof AuditLogEntry];
      }
    });

    // 記錄到Firestore
    const docRef = await db.collection(AUDIT_LOGS_COLLECTION).add(finalLogData);
    
    logger.info(`審計日誌已記錄，ID: ${docRef.id}`, {
      action: finalLogData.action,
      resourceType: finalLogData.resourceType,
      resourceId: finalLogData.resourceId,
      status: finalLogData.status
    });
    
    return docRef.id;
  } catch (error) {
    // 記錄審計失敗不應阻止主操作，僅記錄錯誤
    logger.error('審計日誌記錄失敗', error);
    throw new Error(`審計日誌記錄失敗: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * 批量記錄審計事件
 * @param logDataArray 審計日誌數據陣列
 * @returns Promise<string[]> 返回創建的日誌文檔ID陣列
 */
export const logActions = async (logDataArray: CreateAuditLogParams[]): Promise<string[]> => {
  if (!logDataArray.length) return [];
  
  try {
    const batch = db.batch();
    const docRefs: admin.firestore.DocumentReference[] = [];
    
    // 準備批處理操作
    logDataArray.forEach(logData => {
      const finalLogData: AuditLogEntry = {
        ...logData,
        timestamp: logData.timestamp || admin.firestore.Timestamp.now(),
      };
      
      // 移除任何未定義的字段
      Object.keys(finalLogData).forEach(key => {
        if (finalLogData[key as keyof AuditLogEntry] === undefined) {
          delete finalLogData[key as keyof AuditLogEntry];
        }
      });
      
      const docRef = db.collection(AUDIT_LOGS_COLLECTION).doc();
      docRefs.push(docRef);
      batch.set(docRef, finalLogData);
    });
    
    // 執行批處理
    await batch.commit();
    
    logger.info(`已批量記錄 ${docRefs.length} 條審計日誌`);
    
    return docRefs.map(docRef => docRef.id);
  } catch (error) {
    logger.error('批量審計日誌記錄失敗', error);
    throw new Error(`批量審計日誌記錄失敗: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * 獲取單一審計日誌
 * @param logId 審計日誌ID
 * @returns Promise<AuditLogEntry | null> 返回審計日誌或null（如果不存在）
 */
export const getAuditLog = async (logId: string): Promise<AuditLogEntry | null> => {
  try {
    const docSnapshot = await db.collection(AUDIT_LOGS_COLLECTION).doc(logId).get();
    
    if (!docSnapshot.exists) {
      return null;
    }
    
    return docSnapshot.data() as AuditLogEntry;
  } catch (error) {
    logger.error(`獲取審計日誌 ${logId} 失敗`, error);
    throw new Error(`獲取審計日誌失敗: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * 查詢審計日誌
 * @param options 查詢選項
 * @returns Promise<AuditLogEntry[]> 返回符合條件的審計日誌
 */
export const queryAuditLogs = async (options: {
  userId?: string;
  tenantId?: string;
  storeId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  status?: 'success' | 'failure';
  startTime?: admin.firestore.Timestamp;
  endTime?: admin.firestore.Timestamp;
  limit?: number;
  orderBy?: 'asc' | 'desc';
}): Promise<AuditLogEntry[]> => {
  try {
    let query = db.collection(AUDIT_LOGS_COLLECTION) as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
    
    // 應用查詢條件
    if (options.userId) {
      query = query.where('userId', '==', options.userId);
    }
    
    if (options.tenantId) {
      query = query.where('tenantId', '==', options.tenantId);
    }
    
    if (options.storeId) {
      query = query.where('storeId', '==', options.storeId);
    }
    
    if (options.action) {
      query = query.where('action', '==', options.action);
    }
    
    if (options.resourceType) {
      query = query.where('resourceType', '==', options.resourceType);
    }
    
    if (options.resourceId) {
      query = query.where('resourceId', '==', options.resourceId);
    }
    
    if (options.status) {
      query = query.where('status', '==', options.status);
    }
    
    // 時間範圍查詢
    if (options.startTime) {
      query = query.where('timestamp', '>=', options.startTime);
    }
    
    if (options.endTime) {
      query = query.where('timestamp', '<=', options.endTime);
    }
    
    // 排序
    query = query.orderBy('timestamp', options.orderBy || 'desc');
    
    // 限制返回數量
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const querySnapshot = await query.get();
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data() as AuditLogEntry;
      return data;
    });
  } catch (error) {
    logger.error('查詢審計日誌失敗', error);
    throw new Error(`查詢審計日誌失敗: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * 為當前HTTP請求創建審計日誌參數
 * @param req Express請求對象
 * @param baseParams 基本審計參數
 * @returns CreateAuditLogParams 完整的審計日誌參數
 */
export const createHttpAuditLogParams = (
  req: any,
  baseParams: Omit<CreateAuditLogParams, 'ipAddress' | 'userAgent'> & { ipAddress?: string; userAgent?: string }
): CreateAuditLogParams => {
  // 嘗試獲取IP地址，考慮可能的代理情況
  const ipAddress = baseParams.ipAddress || 
    (req.headers['x-forwarded-for'] || '').split(',').shift() || 
    req.connection?.remoteAddress || 
    req.socket?.remoteAddress || 
    req.connection?.socket?.remoteAddress || 
    '';
  
  // 獲取用戶代理字符串
  const userAgent = baseParams.userAgent || req.headers['user-agent'] || '';
  
  return {
    ...baseParams,
    ipAddress,
    userAgent
  };
};

export default {
  logAction,
  logActions,
  getAuditLog,
  queryAuditLogs,
  createHttpAuditLogParams
}; 