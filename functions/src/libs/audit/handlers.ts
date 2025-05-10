/**
 * 操作日誌 (Audit Log) 模組 - API 處理函數
 */
import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { AuditLogStatus } from './types';

// Firestore 參考
const db = admin.firestore();
const auditLogsCollection = db.collection('auditLogs');

/**
 * 查詢操作日誌
 * 
 * 支持多種查詢條件，包括時間範圍、操作類型、操作對象等
 */
export const queryAuditLogs = async (req: Request, res: Response) => {
  try {
    // 驗證超級管理員或租戶管理員權限
    const user = (req as any).user;
    
    // 只有超級管理員和租戶管理員可以查詢日誌
    if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
      return res.status(403).json({
        status: 'error',
        message: '沒有足夠的權限執行此操作'
      });
    }
    
    // 獲取查詢參數
    const {
      startDate,         // 開始日期 (ISO 格式)
      endDate,           // 結束日期 (ISO 格式)
      userId,            // 操作者ID
      action,            // 操作類型
      targetEntityType,  // 操作對象類型
      targetEntityId,    // 操作對象ID
      status,            // 操作狀態
      tenantId,          // 租戶ID
      limit = 50,        // 每頁數量
      page = 1           // 頁碼
    } = req.query;
    
    // 非超級管理員只能查詢自己租戶的日誌
    const targetTenantId = (user.role === 'super_admin' && tenantId) 
      ? tenantId as string 
      : user.tenantId;
    
    // 構建查詢
    let query: any = auditLogsCollection;
    
    // 過濾租戶
    if (targetTenantId) {
      query = query.where('tenantId', '==', targetTenantId);
    }
    
    // 時間範圍過濾
    if (startDate) {
      const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(startDate as string));
      query = query.where('timestamp', '>=', startTimestamp);
    }
    
    if (endDate) {
      const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(endDate as string));
      query = query.where('timestamp', '<=', endTimestamp);
    }
    
    // 操作者過濾
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    // 操作類型過濾
    if (action) {
      query = query.where('action', '==', action);
    }
    
    // 操作對象類型過濾
    if (targetEntityType) {
      query = query.where('targetEntityType', '==', targetEntityType);
    }
    
    // 操作對象ID過濾
    if (targetEntityId) {
      query = query.where('targetEntityId', '==', targetEntityId);
    }
    
    // 操作狀態過濾
    if (status && Object.values(AuditLogStatus).includes(status as AuditLogStatus)) {
      query = query.where('status', '==', status);
    }
    
    // 計算分頁
    const pageSize = Math.min(parseInt(limit as string), 100); // 最大100條/頁
    const offset = (parseInt(page as string) - 1) * pageSize;
    
    // 按時間降序排序並應用分頁
    query = query.orderBy('timestamp', 'desc').limit(pageSize);
    
    // 如果有偏移量，需要使用 startAfter 實現
    if (offset > 0) {
      // 獲取偏移文檔
      const offsetSnapshot = await auditLogsCollection
        .orderBy('timestamp', 'desc')
        .limit(offset)
        .get();
      
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }
    
    // 執行查詢
    const snapshot = await query.get();
    
    // 格式化結果
    const logs = snapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      // 轉換時間戳為 ISO 字符串，便於前端處理
      return {
        ...data,
        timestamp: data.timestamp.toDate().toISOString(),
        completedAt: data.completedAt ? data.completedAt.toDate().toISOString() : null
      };
    });
    
    // 獲取總記錄數 (注意: 這種方法對大數據集效率低)
    // 實際應用中可能需要更複雜的分頁策略
    let totalCountQuery: any = auditLogsCollection;
    
    if (targetTenantId) {
      totalCountQuery = totalCountQuery.where('tenantId', '==', targetTenantId);
    }
    
    if (startDate) {
      const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(startDate as string));
      totalCountQuery = totalCountQuery.where('timestamp', '>=', startTimestamp);
    }
    
    if (endDate) {
      const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(endDate as string));
      totalCountQuery = totalCountQuery.where('timestamp', '<=', endTimestamp);
    }
    
    const totalCountSnapshot = await totalCountQuery.get();
    const totalCount = totalCountSnapshot.size;
    
    // 返回結果
    return res.status(200).json({
      status: 'success',
      data: {
        logs,
        pagination: {
          page: parseInt(page as string),
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize)
        }
      },
      message: '成功獲取操作日誌'
    });
    
  } catch (error: any) {
    console.error('查詢操作日誌時發生錯誤:', error);
    return res.status(500).json({
      status: 'error',
      message: '查詢操作日誌時出錯',
      error: error.message
    });
  }
};

/**
 * 獲取單個操作日誌詳情
 */
export const getAuditLogDetail = async (req: Request, res: Response) => {
  try {
    // 驗證超級管理員或租戶管理員權限
    const user = (req as any).user;
    
    // 只有超級管理員和租戶管理員可以查詢日誌
    if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
      return res.status(403).json({
        status: 'error',
        message: '沒有足夠的權限執行此操作'
      });
    }
    
    const logId = req.params.id;
    if (!logId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少日誌ID'
      });
    }
    
    // 獲取日誌文檔
    const logDoc = await auditLogsCollection.doc(logId).get();
    if (!logDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: '找不到指定的操作日誌'
      });
    }
    
    const logData = logDoc.data();
    
    // 非超級管理員只能查看自己租戶的日誌
    if (user.role !== 'super_admin' && logData?.tenantId !== user.tenantId) {
      return res.status(403).json({
        status: 'error',
        message: '沒有權限查看此操作日誌'
      });
    }
    
    // 格式化時間戳
    const formattedLog = {
      ...logData,
      timestamp: logData?.timestamp?.toDate()?.toISOString(),
      completedAt: logData?.completedAt?.toDate()?.toISOString()
    };
    
    return res.status(200).json({
      status: 'success',
      data: formattedLog,
      message: '成功獲取操作日誌詳情'
    });
    
  } catch (error: any) {
    console.error('獲取操作日誌詳情時發生錯誤:', error);
    return res.status(500).json({
      status: 'error',
      message: '獲取操作日誌詳情時出錯',
      error: error.message
    });
  }
}; 