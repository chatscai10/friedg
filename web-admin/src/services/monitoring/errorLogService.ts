/**
 * 錯誤日誌服務
 * 負責收集和分析系統錯誤
 */

import { firestore, functions } from '../../firebaseConfig';
import { formatDate, formatDateTime } from '../../utils/dateUtils';

// 錯誤嚴重程度
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// 錯誤日誌
export interface ErrorLog {
  id?: string;
  timestamp: Date;
  message: string;
  code?: string;
  severity: ErrorSeverity;
  source: string;
  userId?: string;
  userName?: string;
  userAgent?: string;
  ipAddress?: string;
  path?: string;
  method?: string;
  stackTrace?: string;
  context?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  notes?: string;
}

// 錯誤統計
export interface ErrorStats {
  totalErrors: number;
  bySeverity: Record<ErrorSeverity, number>;
  bySource: Record<string, number>;
  byDate: Array<{
    date: string;
    count: number;
  }>;
  topErrors: Array<{
    code: string;
    message: string;
    count: number;
  }>;
}

/**
 * 錯誤日誌服務類
 */
export class ErrorLogService {
  private readonly errorLogsCollection = 'errorLogs';
  
  /**
   * 獲取錯誤日誌列表
   * @param limit 限制數量
   * @param offset 偏移量
   * @param filters 過濾條件
   * @returns 錯誤日誌列表
   */
  async getErrorLogs(
    limit: number = 20,
    offset: number = 0,
    filters: {
      severity?: ErrorSeverity;
      source?: string;
      startDate?: Date;
      endDate?: Date;
      resolved?: boolean;
    } = {}
  ): Promise<ErrorLog[]> {
    try {
      let query = firestore.collection(this.errorLogsCollection);
      
      // 應用過濾條件
      if (filters.severity) {
        query = query.where('severity', '==', filters.severity);
      }
      
      if (filters.source) {
        query = query.where('source', '==', filters.source);
      }
      
      if (filters.resolved !== undefined) {
        query = query.where('resolved', '==', filters.resolved);
      }
      
      if (filters.startDate) {
        query = query.where('timestamp', '>=', filters.startDate);
      }
      
      if (filters.endDate) {
        query = query.where('timestamp', '<=', filters.endDate);
      }
      
      // 排序和分頁
      const snapshot = await query
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
        resolvedAt: doc.data().resolvedAt?.toDate()
      } as ErrorLog));
    } catch (error) {
      console.error('獲取錯誤日誌失敗:', error);
      return [];
    }
  }
  
  /**
   * 獲取錯誤日誌詳情
   * @param errorId 錯誤ID
   * @returns 錯誤日誌
   */
  async getErrorLogDetails(errorId: string): Promise<ErrorLog | null> {
    try {
      const doc = await firestore
        .collection(this.errorLogsCollection)
        .doc(errorId)
        .get();
      
      if (!doc.exists) {
        return null;
      }
      
      return {
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data()?.timestamp.toDate(),
        resolvedAt: doc.data()?.resolvedAt?.toDate()
      } as ErrorLog;
    } catch (error) {
      console.error('獲取錯誤日誌詳情失敗:', error);
      return null;
    }
  }
  
  /**
   * 標記錯誤為已解決
   * @param errorId 錯誤ID
   * @param userId 用戶ID
   * @param notes 備註
   * @returns 是否成功
   */
  async markErrorAsResolved(errorId: string, userId: string, notes?: string): Promise<boolean> {
    try {
      await firestore
        .collection(this.errorLogsCollection)
        .doc(errorId)
        .update({
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: userId,
          notes: notes || ''
        });
      
      return true;
    } catch (error) {
      console.error('標記錯誤為已解決失敗:', error);
      return false;
    }
  }
  
  /**
   * 獲取錯誤統計
   * @param days 天數
   * @returns 錯誤統計
   */
  async getErrorStats(days: number = 7): Promise<ErrorStats> {
    try {
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      
      const snapshot = await firestore
        .collection(this.errorLogsCollection)
        .where('timestamp', '>=', startDate)
        .orderBy('timestamp', 'desc')
        .get();
      
      const errors = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      } as ErrorLog));
      
      // 計算總錯誤數
      const totalErrors = errors.length;
      
      // 按嚴重程度分組
      const bySeverity: Record<ErrorSeverity, number> = {
        [ErrorSeverity.INFO]: 0,
        [ErrorSeverity.WARNING]: 0,
        [ErrorSeverity.ERROR]: 0,
        [ErrorSeverity.CRITICAL]: 0
      };
      
      errors.forEach(error => {
        bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      });
      
      // 按來源分組
      const bySource: Record<string, number> = {};
      errors.forEach(error => {
        bySource[error.source] = (bySource[error.source] || 0) + 1;
      });
      
      // 按日期分組
      const byDateMap: Record<string, number> = {};
      errors.forEach(error => {
        const dateStr = formatDate(error.timestamp);
        byDateMap[dateStr] = (byDateMap[dateStr] || 0) + 1;
      });
      
      const byDate = Object.entries(byDateMap).map(([date, count]) => ({
        date,
        count
      })).sort((a, b) => a.date.localeCompare(b.date));
      
      // 計算最常見的錯誤
      const errorCountMap: Record<string, { code: string; message: string; count: number }> = {};
      errors.forEach(error => {
        const key = `${error.code || 'unknown'}-${error.message}`;
        if (!errorCountMap[key]) {
          errorCountMap[key] = {
            code: error.code || 'unknown',
            message: error.message,
            count: 0
          };
        }
        errorCountMap[key].count++;
      });
      
      const topErrors = Object.values(errorCountMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      return {
        totalErrors,
        bySeverity,
        bySource,
        byDate,
        topErrors
      };
    } catch (error) {
      console.error('獲取錯誤統計失敗:', error);
      return {
        totalErrors: 0,
        bySeverity: {
          [ErrorSeverity.INFO]: 0,
          [ErrorSeverity.WARNING]: 0,
          [ErrorSeverity.ERROR]: 0,
          [ErrorSeverity.CRITICAL]: 0
        },
        bySource: {},
        byDate: [],
        topErrors: []
      };
    }
  }
  
  /**
   * 記錄前端錯誤
   * @param error 錯誤對象
   * @param context 上下文
   * @returns 是否成功
   */
  async logFrontendError(error: Error, context: Record<string, any> = {}): Promise<boolean> {
    try {
      const errorLog: Omit<ErrorLog, 'id'> = {
        timestamp: new Date(),
        message: error.message,
        severity: ErrorSeverity.ERROR,
        source: 'frontend',
        stackTrace: error.stack,
        context,
        resolved: false
      };
      
      await firestore
        .collection(this.errorLogsCollection)
        .add(errorLog);
      
      return true;
    } catch (logError) {
      console.error('記錄前端錯誤失敗:', logError);
      return false;
    }
  }
  
  /**
   * 獲取錯誤來源列表
   * @returns 錯誤來源列表
   */
  async getErrorSources(): Promise<string[]> {
    try {
      const snapshot = await firestore
        .collection(this.errorLogsCollection)
        .select('source')
        .get();
      
      const sources = new Set<string>();
      snapshot.docs.forEach(doc => {
        const source = doc.data().source;
        if (source) {
          sources.add(source);
        }
      });
      
      return Array.from(sources);
    } catch (error) {
      console.error('獲取錯誤來源列表失敗:', error);
      return [];
    }
  }
}

export default new ErrorLogService();
