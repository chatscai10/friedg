/**
 * 庫存錯誤追蹤工具
 * 
 * 提供增強的錯誤追蹤、重試和診斷功能
 */
import * as admin from 'firebase-admin';
import { ErrorContext, createErrorResponse } from './error-handler';
import { firestoreProvider } from '../db/database.provider';
import { InventoryError } from './errors';

/**
 * 重試策略
 */
export enum RetryStrategy {
  /** 不重試 */
  NONE = 'none',
  /** 固定間隔重試 */
  FIXED = 'fixed',
  /** 指數退避重試 */
  EXPONENTIAL = 'exponential'
}

/**
 * 重試選項
 */
export interface RetryOptions {
  /** 重試策略 */
  strategy: RetryStrategy;
  /** 最大重試次數 */
  maxRetries: number;
  /** 重試間隔 (毫秒) */
  retryInterval?: number;
  /** 是否僅對特定錯誤重試 */
  retryOnlyFor?: string[];
  /** 是否在重試前等待 */
  waitBeforeRetry?: boolean;
}

/**
 * 操作結果追蹤
 */
export interface OperationTracker<T = any> {
  /** 操作ID */
  operationId: string;
  /** 完整的追蹤路徑 */
  tracePath: string[];
  /** 開始時間 */
  startTime: Date;
  /** 操作狀態 */
  status: 'pending' | 'success' | 'failure' | 'retrying' | 'aborted';
  /** 完成時間 */
  endTime?: Date;
  /** 當前嘗試次數 */
  currentAttempt: number;
  /** 剩餘重試次數 */
  retriesLeft: number;
  /** 操作結果 */
  result?: T;
  /** 錯誤信息 */
  error?: any;
  /** 操作參數 */
  params?: Record<string, any>;
  /** 調用時的上下文 */
  context?: ErrorContext;
  /** 重試策略 */
  retryStrategy?: RetryStrategy;
  /** 下次重試時間 */
  nextRetryTime?: Date;
  /** 相關操作IDs */
  relatedOperations?: string[];
}

/**
 * 錯誤追蹤器
 */
export class ErrorTracker {
  private static instance: ErrorTracker;
  private errorLogsCollection: string = 'errorLogs';
  private operationTracksCollection: string = 'operationTracks';
  
  /**
   * 私有構造函數
   */
  private constructor() {}
  
  /**
   * 獲取單例
   */
  public static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }
  
  /**
   * 追蹤操作並自動重試
   * @param operation 要執行的操作函數
   * @param context 錯誤上下文
   * @param retryOptions 重試選項
   * @param operationName 操作名稱
   */
  async trackWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    retryOptions?: RetryOptions,
    operationName?: string
  ): Promise<T> {
    // 默認不重試
    const options: RetryOptions = retryOptions || {
      strategy: RetryStrategy.NONE,
      maxRetries: 0
    };
    
    // 創建操作追蹤
    const operationId = this.generateOperationId();
    const tracker: OperationTracker<T> = {
      operationId,
      tracePath: [context.component, context.operation],
      startTime: new Date(),
      status: 'pending',
      currentAttempt: 1,
      retriesLeft: options.maxRetries,
      context,
      retryStrategy: options.strategy
    };
    
    // 記錄追蹤開始
    await this.saveOperationTrack(tracker);
    
    try {
      // 執行操作
      const result = await operation();
      
      // 更新追蹤為成功
      tracker.status = 'success';
      tracker.endTime = new Date();
      tracker.result = result;
      await this.saveOperationTrack(tracker);
      
      return result;
    } catch (error: any) {
      // 記錄錯誤
      tracker.error = this.serializeError(error);
      
      // 檢查是否需要重試
      if (this.shouldRetry(error, tracker, options)) {
        // 使用重試策略
        return this.retryOperation(operation, tracker, options);
      }
      
      // 不重試，標記為失敗
      tracker.status = 'failure';
      tracker.endTime = new Date();
      await this.saveOperationTrack(tracker);
      
      // 記錄詳細錯誤日誌
      await this.logDetailedError(error, tracker, context);
      
      // 重新拋出錯誤
      throw error;
    }
  }
  
  /**
   * 重試操作
   * @private
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    tracker: OperationTracker<T>,
    options: RetryOptions
  ): Promise<T> {
    let lastError: any;
    
    // 重試循環
    while (tracker.retriesLeft > 0) {
      // 更新追蹤狀態
      tracker.status = 'retrying';
      tracker.currentAttempt++;
      tracker.retriesLeft--;
      
      // 計算下次重試時間
      const delayMs = this.calculateRetryDelay(options, tracker.currentAttempt);
      tracker.nextRetryTime = new Date(Date.now() + delayMs);
      
      // 保存重試狀態
      await this.saveOperationTrack(tracker);
      
      // 等待重試間隔
      if (options.waitBeforeRetry && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      try {
        // 重試操作
        const result = await operation();
        
        // 重試成功
        tracker.status = 'success';
        tracker.endTime = new Date();
        tracker.result = result;
        await this.saveOperationTrack(tracker);
        
        return result;
      } catch (error: any) {
        // 記錄錯誤
        lastError = error;
        tracker.error = this.serializeError(error);
        
        // 檢查是否繼續重試
        if (!this.shouldRetry(error, tracker, options)) {
          break;
        }
      }
    }
    
    // 重試失敗，標記為失敗
    tracker.status = 'failure';
    tracker.endTime = new Date();
    await this.saveOperationTrack(tracker);
    
    // 記錄詳細錯誤日誌
    await this.logDetailedError(lastError, tracker, tracker.context!);
    
    // 重新拋出最後的錯誤
    throw lastError;
  }
  
  /**
   * 判斷是否應該重試
   * @private
   */
  private shouldRetry(
    error: any,
    tracker: OperationTracker,
    options: RetryOptions
  ): boolean {
    // 如果沒有重試次數或不重試，直接返回false
    if (tracker.retriesLeft <= 0 || options.strategy === RetryStrategy.NONE) {
      return false;
    }
    
    // 如果指定了只對特定錯誤重試
    if (options.retryOnlyFor && options.retryOnlyFor.length > 0) {
      // 檢查錯誤類型或代碼是否在允許的列表中
      const errorCode = error.code || (error.name ? error.name.toLowerCase() : null);
      return options.retryOnlyFor.some(allowedError => {
        return errorCode === allowedError || 
               error.name === allowedError || 
               (error instanceof Error && error.name === allowedError);
      });
    }
    
    // 默認可以重試
    return true;
  }
  
  /**
   * 計算重試延遲時間
   * @private
   */
  private calculateRetryDelay(options: RetryOptions, attempt: number): number {
    const baseDelay = options.retryInterval || 1000;
    
    switch (options.strategy) {
      case RetryStrategy.FIXED:
        return baseDelay;
        
      case RetryStrategy.EXPONENTIAL:
        // 指數退避: 基本延遲 * 2^(嘗試次數-1) 並添加一些隨機擾動
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 0.2 * exponentialDelay; // 添加 0-20% 的隨機擾動
        return Math.min(exponentialDelay + jitter, 60000); // 最大延遲60秒
        
      default:
        return 0;
    }
  }
  
  /**
   * 批量追蹤操作
   * @param operationName 操作名稱
   * @param items 要處理的項目
   * @param processor 處理單個項目的函數
   * @param context 錯誤上下文
   */
  async trackBatchOperation<T, R>(
    operationName: string,
    items: T[],
    processor: (item: T, index: number, operationId: string) => Promise<R>,
    context: ErrorContext
  ): Promise<{
    results: R[];
    successCount: number;
    failureCount: number;
    errors: any[];
    operationId: string;
  }> {
    const batchOperationId = this.generateOperationId();
    const results: R[] = [];
    const errors: any[] = [];
    const childOperations: string[] = [];
    
    // 創建批量操作追蹤
    const batchTracker: OperationTracker = {
      operationId: batchOperationId,
      tracePath: [context.component, `批量${context.operation}`],
      startTime: new Date(),
      status: 'pending',
      currentAttempt: 1,
      retriesLeft: 0,
      context: {
        ...context,
        operation: `批量${context.operation}`,
        metadata: {
          ...context.metadata,
          totalItems: items.length
        }
      },
      relatedOperations: []
    };
    
    // 保存批量操作追蹤
    await this.saveOperationTrack(batchTracker);
    
    // 處理每個項目
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // 為每個項目創建單獨的操作ID
      const itemOperationId = this.generateOperationId();
      childOperations.push(itemOperationId);
      
      // 更新批量操作的相關操作
      batchTracker.relatedOperations = childOperations;
      await this.saveOperationTrack(batchTracker);
      
      try {
        // 處理項目
        const result = await processor(item, i, itemOperationId);
        results.push(result);
        successCount++;
      } catch (error: any) {
        // 記錄錯誤
        errors.push(error);
        failureCount++;
        
        // 記錄詳細錯誤日誌
        await this.logDetailedError(error, {
          operationId: itemOperationId,
          tracePath: [...batchTracker.tracePath, `item[${i}]`],
          startTime: new Date(),
          status: 'failure',
          currentAttempt: 1,
          retriesLeft: 0,
          error: this.serializeError(error),
          params: { item, index: i },
          context,
          relatedOperations: [batchOperationId]
        }, {
          ...context,
          operation: `${context.operation} 項目 ${i}`,
          metadata: {
            ...context.metadata,
            itemIndex: i,
            batchOperationId
          }
        });
      }
    }
    
    // 更新批量操作追蹤
    batchTracker.status = failureCount === 0 ? 'success' : 'failure';
    batchTracker.endTime = new Date();
    batchTracker.result = {
      successCount,
      failureCount,
      totalProcessed: successCount + failureCount
    };
    
    if (failureCount > 0) {
      batchTracker.error = {
        message: `批量操作部分失敗: ${failureCount}/${items.length} 項目失敗`,
        failureCount,
        successCount
      };
    }
    
    await this.saveOperationTrack(batchTracker);
    
    return {
      results,
      successCount,
      failureCount,
      errors,
      operationId: batchOperationId
    };
  }
  
  /**
   * 記錄詳細錯誤日誌
   * @private
   */
  private async logDetailedError(
    error: any,
    tracker: OperationTracker,
    context: ErrorContext
  ): Promise<void> {
    try {
      // 處理特殊錯誤類型
      const errorResponse = error.response || 
        (error instanceof InventoryError ? error.toApiResponse().error : null) ||
        createErrorResponse(error, context);
      
      // 創建錯誤日誌
      const errorLog = {
        errorId: this.generateOperationId(),
        operationId: tracker.operationId,
        timestamp: new Date(),
        component: context.component,
        operation: context.operation,
        identity: context.identity,
        error: {
          name: error.name,
          message: error.message,
          code: error.code || errorResponse.code,
          stack: error.stack,
          details: error.details || errorResponse.details
        },
        context: {
          ...context,
          metadata: {
            ...context.metadata,
            tracePath: tracker.tracePath,
            attempts: tracker.currentAttempt,
            duration: tracker.endTime ? 
              tracker.endTime.getTime() - tracker.startTime.getTime() : 
              new Date().getTime() - tracker.startTime.getTime()
          }
        },
        severity: context.isCritical ? 'CRITICAL' : 'ERROR',
        traceId: errorResponse.traceId,
        relatedOperations: tracker.relatedOperations
      };
      
      // 保存錯誤日誌
      const errorRef = firestoreProvider.getCollectionRef(this.errorLogsCollection).doc();
      await errorRef.set(errorLog);
      
      // 如果是關鍵錯誤，也打印到控制台
      if (context.isCritical) {
        console.error('[CRITICAL ERROR]', JSON.stringify({
          errorId: errorLog.errorId,
          component: context.component,
          operation: context.operation,
          message: error.message,
          code: error.code,
          traceId: errorResponse.traceId
        }));
      }
    } catch (logError) {
      // 記錄錯誤日誌失敗不應該影響主要操作
      console.error('記錄錯誤日誌失敗:', logError);
    }
  }
  
  /**
   * 保存操作追蹤
   * @private
   */
  private async saveOperationTrack<T>(tracker: OperationTracker<T>): Promise<void> {
    try {
      // 存儲操作追蹤
      const trackRef = firestoreProvider.getDocRef(
        this.operationTracksCollection,
        tracker.operationId
      );
      
      await trackRef.set(this.sanitizeTracker(tracker), { merge: true });
    } catch (error) {
      // 保存追蹤失敗不應該影響主要操作
      console.warn('保存操作追蹤失敗:', error);
    }
  }
  
  /**
   * 處理追蹤對象，確保可存儲
   * @private
   */
  private sanitizeTracker<T>(tracker: OperationTracker<T>): any {
    // 創建可安全序列化的副本
    const sanitized = { ...tracker };
    
    // 處理錯誤對象
    if (sanitized.error) {
      sanitized.error = this.serializeError(sanitized.error);
    }
    
    // 處理結果對象
    if (sanitized.result) {
      // 如果結果太大或包含循環引用，轉換為簡化版本
      try {
        JSON.stringify(sanitized.result);
      } catch (e) {
        // 如果無法序列化，創建簡化版本
        sanitized.result = { 
          _simplified: true,
          summary: typeof sanitized.result === 'object' ? 
            `Object with ${Object.keys(sanitized.result).length} keys` : 
            `${typeof sanitized.result} value`
        };
      }
    }
    
    return sanitized;
  }
  
  /**
   * 序列化錯誤對象
   * @private
   */
  private serializeError(error: any): any {
    if (!error) return null;
    
    // 如果是標準錯誤對象
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        details: (error as any).details
      };
    }
    
    // 如果是庫存錯誤
    if (error instanceof InventoryError) {
      return {
        name: error.name,
        code: error.code,
        message: error.message,
        details: error.details,
        stack: error.stack
      };
    }
    
    // 如果是字符串
    if (typeof error === 'string') {
      return { message: error };
    }
    
    // 如果是其他對象
    return { ...error };
  }
  
  /**
   * 生成唯一操作ID
   * @private
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  
  /**
   * 獲取操作追蹤
   * @param operationId 操作ID
   */
  async getOperationTrack<T>(operationId: string): Promise<OperationTracker<T> | null> {
    try {
      const trackRef = firestoreProvider.getDocRef(
        this.operationTracksCollection,
        operationId
      );
      
      const trackDoc = await trackRef.get();
      
      if (!trackDoc.exists) {
        return null;
      }
      
      return trackDoc.data() as OperationTracker<T>;
    } catch (error) {
      console.error('獲取操作追蹤失敗:', error);
      return null;
    }
  }
  
  /**
   * 取消操作
   * @param operationId 操作ID
   */
  async abortOperation(operationId: string): Promise<boolean> {
    try {
      const tracker = await this.getOperationTrack(operationId);
      
      if (!tracker || tracker.status !== 'pending') {
        return false;
      }
      
      // 更新追蹤狀態
      tracker.status = 'aborted';
      tracker.endTime = new Date();
      tracker.error = {
        name: 'OperationAbortedError',
        message: '操作被使用者取消'
      };
      
      await this.saveOperationTrack(tracker);
      return true;
    } catch (error) {
      console.error('取消操作失敗:', error);
      return false;
    }
  }
  
  /**
   * 獲取相關操作
   * @param operationId 操作ID
   */
  async getRelatedOperations(operationId: string): Promise<OperationTracker[]> {
    try {
      // 獲取主操作
      const mainOperation = await this.getOperationTrack(operationId);
      
      if (!mainOperation || !mainOperation.relatedOperations || mainOperation.relatedOperations.length === 0) {
        return [];
      }
      
      // 獲取相關操作
      const relatedOperations: OperationTracker[] = [];
      
      for (const relatedId of mainOperation.relatedOperations) {
        const operation = await this.getOperationTrack(relatedId);
        if (operation) {
          relatedOperations.push(operation);
        }
      }
      
      return relatedOperations;
    } catch (error) {
      console.error('獲取相關操作失敗:', error);
      return [];
    }
  }
}

// 導出單例
export const errorTracker = ErrorTracker.getInstance(); 