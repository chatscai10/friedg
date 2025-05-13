/**
 * 庫存管理模組的錯誤處理工具
 * 
 * 提供統一的錯誤處理和回應格式
 */
import * as admin from 'firebase-admin';
import { 
  NegativeStockError, 
  TransactionTooLargeError, 
  ItemNotFoundError,
  InventoryError 
} from './errors';
import { ErrorTracker } from './error-tracker';

/**
 * 錯誤嚴重性級別
 */
export enum ErrorSeverity {
  /** 低嚴重性 - 用戶輸入錯誤 */
  LOW = 'low',
  /** 中嚴重性 - 業務邏輯錯誤 */
  MEDIUM = 'medium',
  /** 高嚴重性 - 系統或基礎設施錯誤 */
  HIGH = 'high',
  /** 緊急嚴重性 - 需要立即處理的錯誤 */
  CRITICAL = 'critical'
}

/**
 * 錯誤來源類型
 */
export enum ErrorSource {
  /** 用戶操作造成的錯誤 */
  USER = 'user',
  /** 系統內部錯誤 */
  SYSTEM = 'system',
  /** 第三方服務錯誤 */
  EXTERNAL = 'external',
  /** 未知來源錯誤 */
  UNKNOWN = 'unknown'
}

/**
 * 錯誤上下文接口
 */
export interface ErrorContext {
  /** 模組/組件名稱 */
  component: string;
  /** 操作名稱 */
  operation: string;
  /** 操作者身份 */
  identity?: {
    /** 租戶ID */
    tenantId?: string;
    /** 用戶ID */
    userId?: string;
  };
  /** 額外參數 */
  params?: Record<string, any>;
  /** 嚴重性等級 */
  severity?: ErrorSeverity;
  /** 錯誤來源 */
  source?: ErrorSource;
  /** 關連ID，用於追蹤相關錯誤 */
  correlationId?: string;
}

/**
 * 應用錯誤基類
 */
export class AppError extends Error {
  /** 錯誤代碼 */
  code: string;
  /** HTTP狀態碼 */
  httpCode: number;
  /** 錯誤嚴重性 */
  severity: ErrorSeverity;
  /** 錯誤來源 */
  source: ErrorSource;
  /** 錯誤上下文 */
  context?: ErrorContext;
  /** 內部錯誤 */
  innerError?: Error;
  /** 發生時間 */
  timestamp: Date;
  /** 關連ID */
  correlationId?: string;
  
  /**
   * 構造函數
   * @param message 錯誤訊息
   * @param code 錯誤代碼
   * @param httpCode HTTP狀態碼
   * @param severity 嚴重性
   * @param source 錯誤來源
   * @param context 錯誤上下文
   * @param innerError 內部錯誤
   */
  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    httpCode: number = 500,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    source: ErrorSource = ErrorSource.SYSTEM,
    context?: ErrorContext,
    innerError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpCode = httpCode;
    this.severity = severity;
    this.source = source;
    this.context = context;
    this.innerError = innerError;
    this.timestamp = new Date();
    
    // 使用上下文中的關連ID或生成新的
    this.correlationId = context?.correlationId || this.generateCorrelationId();
    
    // 捕獲堆疊跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * 生成關連ID
   */
  private generateCorrelationId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  /**
   * 獲取包含所有錯誤詳細信息的JSON
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      httpCode: this.httpCode,
      severity: this.severity,
      source: this.source,
      context: this.context,
      innerError: this.innerError ? 
        (this.innerError instanceof AppError ? 
          this.innerError.toJSON() : 
          { message: this.innerError.message, stack: this.innerError.stack }
        ) : undefined,
      timestamp: this.timestamp,
      correlationId: this.correlationId,
      stack: this.stack
    };
  }
}

/**
 * 參數驗證錯誤
 */
export class ValidationError extends AppError {
  /** 驗證失敗欄位 */
  fields: Record<string, string>;
  
  constructor(message: string, fields: Record<string, string>, context?: ErrorContext) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      ErrorSeverity.LOW,
      ErrorSource.USER,
      context
    );
    this.fields = fields;
  }
  
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      fields: this.fields
    };
  }
}

/**
 * 未找到資源錯誤
 */
export class NotFoundError extends AppError {
  /** 資源類型 */
  resourceType: string;
  /** 資源ID */
  resourceId: string;
  
  constructor(resourceType: string, resourceId: string, context?: ErrorContext) {
    super(
      `找不到${resourceType} (ID: ${resourceId})`,
      'RESOURCE_NOT_FOUND',
      404,
      ErrorSeverity.LOW,
      ErrorSource.USER,
      context
    );
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
  
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      resourceType: this.resourceType,
      resourceId: this.resourceId
    };
  }
}

/**
 * 權限不足錯誤
 */
export class ForbiddenError extends AppError {
  /** 需要的權限 */
  requiredPermission?: string;
  
  constructor(message: string, requiredPermission?: string, context?: ErrorContext) {
    super(
      message,
      'FORBIDDEN',
      403,
      ErrorSeverity.MEDIUM,
      ErrorSource.USER,
      context
    );
    this.requiredPermission = requiredPermission;
  }
  
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      requiredPermission: this.requiredPermission
    };
  }
}

/**
 * 業務邏輯錯誤
 */
export class BusinessLogicError extends AppError {
  constructor(message: string, code = 'BUSINESS_ERROR', context?: ErrorContext) {
    super(
      message,
      code,
      400,
      ErrorSeverity.MEDIUM,
      ErrorSource.SYSTEM,
      context
    );
  }
}

/**
 * 系統錯誤
 */
export class SystemError extends AppError {
  constructor(message: string, innerError?: Error, context?: ErrorContext) {
    super(
      message,
      'SYSTEM_ERROR',
      500,
      ErrorSeverity.HIGH,
      ErrorSource.SYSTEM,
      context,
      innerError
    );
  }
}

/**
 * 第三方服務錯誤
 */
export class ExternalServiceError extends AppError {
  /** 服務名稱 */
  serviceName: string;
  
  constructor(serviceName: string, message: string, innerError?: Error, context?: ErrorContext) {
    super(
      `${serviceName} 服務錯誤: ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      ErrorSeverity.HIGH,
      ErrorSource.EXTERNAL,
      context,
      innerError
    );
    this.serviceName = serviceName;
  }
  
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      serviceName: this.serviceName
    };
  }
}

/**
 * 處理錯誤的選項
 */
export interface ErrorHandlingOptions {
  /** 是否重試 */
  retry?: boolean;
  /** 最大重試次數 */
  maxRetries?: number;
  /** 重試延遲(毫秒) */
  retryDelay?: number;
  /** 是否記錄到資料庫 */
  logToDatabase?: boolean;
  /** 是否捕獲並格式化所有錯誤 */
  catchAll?: boolean;
  /** 是否拋出由外部代碼處理 */
  rethrow?: boolean;
  /** 自定義處理函數 */
  onError?: (error: any, context?: ErrorContext) => void;
}

/**
 * 包裝函數以統一錯誤處理
 * @param fn 要執行的函數
 * @param context 錯誤上下文
 * @param options 處理選項
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: ErrorContext,
  options: ErrorHandlingOptions = {}
): Promise<T> {
  // 合併預設選項
  const defaultOptions: ErrorHandlingOptions = {
    retry: false,
    maxRetries: 3,
    retryDelay: 300,
    logToDatabase: true,
    catchAll: true,
    rethrow: false
  };
  
  const finalOptions = { ...defaultOptions, ...options };
  let retries = 0;
  let lastError: any;
  
  // 重試邏輯
  while (retries <= (finalOptions.maxRetries || 0)) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // 處理和格式化錯誤
      const formattedError = formatError(error, context);
      
      // 記錄錯誤
      logError(formattedError, context);
      
      // 執行自定義處理
      if (finalOptions.onError) {
        finalOptions.onError(formattedError, context);
      }
      
      // 儲存到資料庫
      if (finalOptions.logToDatabase) {
        await storeErrorInDatabase(formattedError, context);
      }
      
      // 是否重試
      if (finalOptions.retry && retries < (finalOptions.maxRetries || 0) && isRetryableError(error)) {
        retries++;
        // 延遲後重試
        await delay(calculateRetryDelay(retries, finalOptions.retryDelay || 300));
        continue;
      }
      
      // 如果需要重新拋出
      if (finalOptions.rethrow) {
        throw formattedError;
      }
      
      // 如果需要捕獲所有錯誤
      if (finalOptions.catchAll) {
        return null as any;
      }
      
      throw formattedError;
    }
  }
  
  // 如果所有重試失敗
  if (finalOptions.rethrow) {
    throw lastError;
  }
  
  if (finalOptions.catchAll) {
    return null as any;
  }
  
  throw lastError;
}

/**
 * 格式化錯誤
 * @param error 原始錯誤
 * @param context 錯誤上下文
 */
function formatError(error: any, context?: ErrorContext): AppError {
  // 已經是 AppError
  if (error instanceof AppError) {
    // 如果沒有上下文但提供了新的上下文，就添加上下文
    if (!error.context && context) {
      error.context = context;
    }
    return error;
  }
  
  // Firestore 錯誤處理
  if (error.code && error.name === 'FirebaseError') {
    return handleFirebaseError(error, context);
  }
  
  // 一般錯誤轉換為系統錯誤
  return new SystemError(
    error.message || '發生未知系統錯誤',
    error,
    context
  );
}

/**
 * 處理 Firebase 特定錯誤
 * @param error Firebase 錯誤
 * @param context 錯誤上下文
 */
function handleFirebaseError(error: any, context?: ErrorContext): AppError {
  let appError: AppError;
  
  switch (error.code) {
    case 'permission-denied':
      appError = new ForbiddenError(
        '沒有執行此操作的權限',
        undefined,
        context
      );
      break;
    case 'not-found':
      appError = new NotFoundError(
        context?.params?.resourceType || '資源',
        context?.params?.resourceId || '未知',
        context
      );
      break;
    case 'failed-precondition':
      appError = new BusinessLogicError(
        error.message || '操作無法完成，條件檢查失敗',
        'PRECONDITION_FAILED',
        context
      );
      break;
    case 'aborted':
      appError = new BusinessLogicError(
        error.message || '操作被中止',
        'OPERATION_ABORTED',
        context
      );
      break;
    case 'already-exists':
      appError = new BusinessLogicError(
        error.message || '資源已存在',
        'RESOURCE_ALREADY_EXISTS',
        context
      );
      break;
    case 'resource-exhausted':
      appError = new BusinessLogicError(
        error.message || '資源配額已用盡或速率限制已達到',
        'RESOURCE_EXHAUSTED',
        context
      );
      break;
    case 'cancelled':
      appError = new BusinessLogicError(
        error.message || '操作已取消',
        'OPERATION_CANCELLED',
        context
      );
      break;
    case 'data-loss':
      appError = new SystemError(
        error.message || '發生資料損失',
        error,
        context
      );
      break;
    case 'internal':
      appError = new SystemError(
        error.message || '內部服務器錯誤',
        error,
        context
      );
      break;
    case 'unavailable':
      appError = new ExternalServiceError(
        'Firebase',
        error.message || '服務暫時不可用',
        error,
        context
      );
      break;
    default:
      appError = new SystemError(
        error.message || '發生未知 Firebase 錯誤',
        error,
        context
      );
  }
  
  return appError;
}

/**
 * 記錄錯誤到控制台
 * @param error 錯誤對象
 * @param context 錯誤上下文
 */
function logError(error: AppError, context?: ErrorContext): void {
  const errorLog = {
    timestamp: new Date().toISOString(),
    correlationId: error.correlationId,
    message: error.message,
    code: error.code,
    severity: error.severity,
    source: error.source,
    component: context?.component || 'unknown',
    operation: context?.operation || 'unknown',
    identity: context?.identity,
    params: context?.params,
    stack: error.stack,
    innerError: error.innerError
  };
  
  // 根據嚴重性使用不同的日志級別
  switch (error.severity) {
    case ErrorSeverity.LOW:
      console.info('[ERROR_INFO]', JSON.stringify(errorLog));
      break;
    case ErrorSeverity.MEDIUM:
      console.warn('[ERROR_WARN]', JSON.stringify(errorLog));
      break;
    case ErrorSeverity.HIGH:
    case ErrorSeverity.CRITICAL:
      console.error('[ERROR_CRITICAL]', JSON.stringify(errorLog));
      break;
    default:
      console.error('[ERROR]', JSON.stringify(errorLog));
  }
}

/**
 * 存儲錯誤到資料庫
 * @param error 錯誤對象
 * @param context 錯誤上下文
 */
async function storeErrorInDatabase(error: AppError, context?: ErrorContext): Promise<void> {
  try {
    const errorTracker = new ErrorTracker();
    
    await errorTracker.trackError({
      correlationId: error.correlationId || '',
      message: error.message,
      code: error.code,
      severity: error.severity,
      source: error.source,
      component: context?.component || 'unknown',
      operation: context?.operation || 'unknown',
      tenantId: context?.identity?.tenantId,
      userId: context?.identity?.userId,
      params: context?.params,
      stackTrace: error.stack,
      innerError: error.innerError ? JSON.stringify(error.innerError) : undefined,
      timestamp: error.timestamp || new Date()
    });
  } catch (dbError) {
    // 如果存儲過程中發生錯誤，只記錄但不中斷處理
    console.error('Error storing error in database:', dbError);
  }
}

/**
 * 判斷錯誤是否可重試
 * @param error 錯誤對象
 */
function isRetryableError(error: any): boolean {
  // Firebase暫時性錯誤
  if (error.code) {
    return ['unavailable', 'resource-exhausted', 'deadline-exceeded', 'cancelled'].includes(error.code);
  }
  
  // 網絡錯誤或超時錯誤
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('network') || 
           message.includes('timeout') || 
           message.includes('unavailable') ||
           message.includes('econnreset') ||
           message.includes('econnrefused');
  }
  
  return false;
}

/**
 * 計算重試延遲時間(使用指數退避)
 * @param retryCount 重試次數
 * @param baseDelay 基本延遲時間
 */
function calculateRetryDelay(retryCount: number, baseDelay: number): number {
  // 指數退避 (2^n) 加一個隨機抖動來避免同步
  const exponentialDelay = Math.pow(2, retryCount) * baseDelay;
  const jitter = Math.random() * 100;
  return exponentialDelay + jitter;
}

/**
 * 延遲函數
 * @param ms 毫秒數
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 標準錯誤回應
 */
export interface ErrorResponse {
  /** 錯誤代碼 */
  code: string;
  /** 錯誤訊息 */
  message: string;
  /** 錯誤詳情 */
  details?: any;
  /** 時間戳 */
  timestamp: string;
  /** 追蹤識別碼 */
  traceId?: string;
}

/**
 * 生成唯一的錯誤追蹤識別碼
 * @private
 */
function generateTraceId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * 生成標準錯誤回應
 * @param error 錯誤對象
 * @param context 錯誤上下文
 * @returns 標準錯誤回應
 */
export function createErrorResponse(error: any, context: ErrorContext): ErrorResponse {
  const traceId = generateTraceId();
  let code = 'INVENTORY_ERROR';
  let message = error.message || '操作處理時發生錯誤';
  let details = null;

  // 根據不同的錯誤類型設置不同的錯誤代碼和訊息
  if (error instanceof NegativeStockError) {
    code = 'NEGATIVE_STOCK_ERROR';
    message = `品項 ${error.itemId} 在店鋪 ${error.storeId} 的庫存不足`;
    details = {
      itemId: error.itemId,
      storeId: error.storeId
    };
  } else if (error instanceof TransactionTooLargeError) {
    code = 'TRANSACTION_TOO_LARGE';
    message = '批次處理數量過多，請減少每批的數量';
  } else if (error instanceof ItemNotFoundError) {
    code = 'ITEM_NOT_FOUND';
    message = `找不到品項 ${error.itemId}`;
    details = {
      itemId: error.itemId
    };
  } else if (error instanceof InventoryError) {
    code = error.code;
    details = error.details;
  } else if (error instanceof admin.firestore.FirestoreError) {
    code = `FIRESTORE_${error.code.toUpperCase()}`;
    message = `資料庫操作失敗: ${error.message}`;
  }

  // 記錄錯誤日誌
  logError(error, context, traceId);

  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
    traceId
  };
}

/**
 * 記錄錯誤日誌
 * @param error 錯誤對象
 * @param context 錯誤上下文
 * @param traceId 追蹤識別碼
 */
function logError(error: any, context: ErrorContext, traceId: string): void {
  const { component, operation, isCritical = false, identity, metadata } = context;
  
  const logData = {
    component,
    operation,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    traceId,
    timestamp: new Date().toISOString(),
    severity: isCritical ? 'CRITICAL' : 'ERROR',
    identity,
    metadata
  };
  
  // 依據嚴重性選擇不同的日誌級別
  if (isCritical) {
    console.error('[CRITICAL ERROR]', JSON.stringify(logData));
  } else {
    console.error('[ERROR]', JSON.stringify(logData));
  }
}

/**
 * 批次操作錯誤處理
 * @param results 批次操作結果
 * @param context 錯誤上下文
 * @returns 處理後的結果
 */
export function handleBatchResults(results: any[], context: ErrorContext): any {
  const successResults = results.filter(r => r.success);
  const failureResults = results.filter(r => !r.success);
  
  return {
    success: failureResults.length === 0,
    successCount: successResults.length,
    failureCount: failureResults.length,
    results: results,
    errors: failureResults.map(r => {
      // 為每個失敗結果創建標準錯誤回應
      const err = new Error(r.error || '批次處理項目失敗');
      return createErrorResponse(err, {
        ...context,
        metadata: {
          ...context.metadata,
          itemId: r.itemId,
          storeId: r.storeId
        }
      });
    })
  };
} 