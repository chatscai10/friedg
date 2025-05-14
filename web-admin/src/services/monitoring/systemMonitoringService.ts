/**
 * 系統監控服務
 * 負責收集和分析系統健康指標
 */

import { firestore, functions } from '../../firebaseConfig';
import { formatDate, formatDateTime } from '../../utils/dateUtils';

// 系統健康指標類型
export enum HealthMetricType {
  API_RESPONSE_TIME = 'api_response_time',
  DATABASE_QUERY_PERFORMANCE = 'database_query_performance',
  ERROR_RATE = 'error_rate',
  MEMORY_USAGE = 'memory_usage',
  CPU_USAGE = 'cpu_usage',
  ACTIVE_USERS = 'active_users',
  FUNCTION_EXECUTION_TIME = 'function_execution_time',
  FUNCTION_EXECUTION_COUNT = 'function_execution_count',
  STORAGE_USAGE = 'storage_usage'
}

// 系統健康狀態
export enum HealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown'
}

// 系統健康指標
export interface HealthMetric {
  id?: string;
  type: HealthMetricType;
  value: number;
  unit: string;
  timestamp: Date;
  status: HealthStatus;
  source: string;
  details?: Record<string, any>;
}

// 系統健康摘要
export interface HealthSummary {
  overallStatus: HealthStatus;
  apiResponseTime: {
    average: number;
    status: HealthStatus;
  };
  databasePerformance: {
    average: number;
    status: HealthStatus;
  };
  errorRate: {
    value: number;
    status: HealthStatus;
  };
  activeUsers: {
    count: number;
    status: HealthStatus;
  };
  functionExecutions: {
    count: number;
    averageTime: number;
    status: HealthStatus;
  };
  lastUpdated: Date;
}

// 系統使用情況統計
export interface SystemUsageStats {
  id?: string;
  date: Date;
  activeUsers: number;
  totalRequests: number;
  averageResponseTime: number;
  errorCount: number;
  errorRate: number;
  topFeatures: Array<{
    feature: string;
    usageCount: number;
  }>;
  topErrors: Array<{
    errorCode: string;
    errorMessage: string;
    count: number;
  }>;
  details?: Record<string, any>;
}

/**
 * 系統監控服務類
 */
export class SystemMonitoringService {
  private readonly healthMetricsCollection = 'systemHealthMetrics';
  private readonly systemUsageStatsCollection = 'systemUsageStats';
  private readonly errorLogsCollection = 'errorLogs';
  private readonly auditLogsCollection = 'auditLogs';
  
  /**
   * 獲取系統健康摘要
   * @returns 系統健康摘要
   */
  async getHealthSummary(): Promise<HealthSummary> {
    try {
      // 獲取最近的健康指標
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const metricsSnapshot = await firestore
        .collection(this.healthMetricsCollection)
        .where('timestamp', '>=', oneDayAgo)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();
      
      const metrics: HealthMetric[] = metricsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      } as HealthMetric));
      
      // 計算API響應時間
      const apiResponseTimeMetrics = metrics.filter(m => m.type === HealthMetricType.API_RESPONSE_TIME);
      const avgApiResponseTime = apiResponseTimeMetrics.length > 0
        ? apiResponseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / apiResponseTimeMetrics.length
        : 0;
      
      // 計算數據庫查詢性能
      const dbPerformanceMetrics = metrics.filter(m => m.type === HealthMetricType.DATABASE_QUERY_PERFORMANCE);
      const avgDbPerformance = dbPerformanceMetrics.length > 0
        ? dbPerformanceMetrics.reduce((sum, m) => sum + m.value, 0) / dbPerformanceMetrics.length
        : 0;
      
      // 計算錯誤率
      const errorRateMetrics = metrics.filter(m => m.type === HealthMetricType.ERROR_RATE);
      const latestErrorRate = errorRateMetrics.length > 0
        ? errorRateMetrics[0].value
        : 0;
      
      // 計算活躍用戶數
      const activeUsersMetrics = metrics.filter(m => m.type === HealthMetricType.ACTIVE_USERS);
      const latestActiveUsers = activeUsersMetrics.length > 0
        ? activeUsersMetrics[0].value
        : 0;
      
      // 計算函數執行情況
      const functionTimeMetrics = metrics.filter(m => m.type === HealthMetricType.FUNCTION_EXECUTION_TIME);
      const functionCountMetrics = metrics.filter(m => m.type === HealthMetricType.FUNCTION_EXECUTION_COUNT);
      
      const avgFunctionTime = functionTimeMetrics.length > 0
        ? functionTimeMetrics.reduce((sum, m) => sum + m.value, 0) / functionTimeMetrics.length
        : 0;
      
      const totalFunctionCount = functionCountMetrics.length > 0
        ? functionCountMetrics.reduce((sum, m) => sum + m.value, 0)
        : 0;
      
      // 確定整體狀態
      let overallStatus = HealthStatus.HEALTHY;
      
      // 如果有任何指標處於警告狀態，整體狀態為警告
      if (metrics.some(m => m.status === HealthStatus.WARNING)) {
        overallStatus = HealthStatus.WARNING;
      }
      
      // 如果有任何指標處於嚴重狀態，整體狀態為嚴重
      if (metrics.some(m => m.status === HealthStatus.CRITICAL)) {
        overallStatus = HealthStatus.CRITICAL;
      }
      
      // 如果沒有指標，整體狀態為未知
      if (metrics.length === 0) {
        overallStatus = HealthStatus.UNKNOWN;
      }
      
      return {
        overallStatus,
        apiResponseTime: {
          average: avgApiResponseTime,
          status: this.getStatusForApiResponseTime(avgApiResponseTime)
        },
        databasePerformance: {
          average: avgDbPerformance,
          status: this.getStatusForDatabasePerformance(avgDbPerformance)
        },
        errorRate: {
          value: latestErrorRate,
          status: this.getStatusForErrorRate(latestErrorRate)
        },
        activeUsers: {
          count: latestActiveUsers,
          status: HealthStatus.HEALTHY // 活躍用戶數不影響健康狀態
        },
        functionExecutions: {
          count: totalFunctionCount,
          averageTime: avgFunctionTime,
          status: this.getStatusForFunctionExecutionTime(avgFunctionTime)
        },
        lastUpdated: now
      };
    } catch (error) {
      console.error('獲取系統健康摘要失敗:', error);
      return {
        overallStatus: HealthStatus.UNKNOWN,
        apiResponseTime: { average: 0, status: HealthStatus.UNKNOWN },
        databasePerformance: { average: 0, status: HealthStatus.UNKNOWN },
        errorRate: { value: 0, status: HealthStatus.UNKNOWN },
        activeUsers: { count: 0, status: HealthStatus.UNKNOWN },
        functionExecutions: { count: 0, averageTime: 0, status: HealthStatus.UNKNOWN },
        lastUpdated: new Date()
      };
    }
  }
  
  /**
   * 獲取系統使用情況統計
   * @param days 天數
   * @returns 系統使用情況統計
   */
  async getSystemUsageStats(days: number = 7): Promise<SystemUsageStats[]> {
    try {
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      
      const statsSnapshot = await firestore
        .collection(this.systemUsageStatsCollection)
        .where('date', '>=', startDate)
        .orderBy('date', 'desc')
        .get();
      
      return statsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate()
      } as SystemUsageStats));
    } catch (error) {
      console.error('獲取系統使用情況統計失敗:', error);
      return [];
    }
  }
  
  /**
   * 獲取錯誤日誌
   * @param limit 限制數量
   * @param offset 偏移量
   * @returns 錯誤日誌
   */
  async getErrorLogs(limit: number = 20, offset: number = 0): Promise<any[]> {
    try {
      const logsSnapshot = await firestore
        .collection(this.errorLogsCollection)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
      
      return logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      }));
    } catch (error) {
      console.error('獲取錯誤日誌失敗:', error);
      return [];
    }
  }
  
  /**
   * 獲取操作日誌
   * @param limit 限制數量
   * @param offset 偏移量
   * @returns 操作日誌
   */
  async getAuditLogs(limit: number = 20, offset: number = 0): Promise<any[]> {
    try {
      const logsSnapshot = await firestore
        .collection(this.auditLogsCollection)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
      
      return logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      }));
    } catch (error) {
      console.error('獲取操作日誌失敗:', error);
      return [];
    }
  }
  
  /**
   * 執行系統健康檢查
   * @returns 健康檢查結果
   */
  async performHealthCheck(): Promise<{ status: string; details: Record<string, any> }> {
    try {
      // 調用健康檢查API
      const healthCheckResult = await functions.httpsCallable('healthCheck')();
      return healthCheckResult.data;
    } catch (error) {
      console.error('執行系統健康檢查失敗:', error);
      return {
        status: 'error',
        details: {
          message: '執行系統健康檢查失敗',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
  
  /**
   * 獲取API響應時間的健康狀態
   * @param value API響應時間（毫秒）
   * @returns 健康狀態
   */
  private getStatusForApiResponseTime(value: number): HealthStatus {
    if (value < 300) return HealthStatus.HEALTHY;
    if (value < 1000) return HealthStatus.WARNING;
    return HealthStatus.CRITICAL;
  }
  
  /**
   * 獲取數據庫查詢性能的健康狀態
   * @param value 數據庫查詢時間（毫秒）
   * @returns 健康狀態
   */
  private getStatusForDatabasePerformance(value: number): HealthStatus {
    if (value < 100) return HealthStatus.HEALTHY;
    if (value < 500) return HealthStatus.WARNING;
    return HealthStatus.CRITICAL;
  }
  
  /**
   * 獲取錯誤率的健康狀態
   * @param value 錯誤率（百分比）
   * @returns 健康狀態
   */
  private getStatusForErrorRate(value: number): HealthStatus {
    if (value < 1) return HealthStatus.HEALTHY;
    if (value < 5) return HealthStatus.WARNING;
    return HealthStatus.CRITICAL;
  }
  
  /**
   * 獲取函數執行時間的健康狀態
   * @param value 函數執行時間（毫秒）
   * @returns 健康狀態
   */
  private getStatusForFunctionExecutionTime(value: number): HealthStatus {
    if (value < 1000) return HealthStatus.HEALTHY;
    if (value < 3000) return HealthStatus.WARNING;
    return HealthStatus.CRITICAL;
  }
}

export default new SystemMonitoringService();
