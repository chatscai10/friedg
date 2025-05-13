/**
 * 庫存管理模組的錯誤類別定義
 * 
 * 所有庫存模組專用的錯誤類型，提供統一的錯誤格式和處理機制
 */

/**
 * 基礎庫存錯誤類型
 */
export class InventoryError extends Error {
  /**
   * 錯誤代碼
   */
  readonly code: string;
  
  /**
   * 錯誤詳情
   */
  readonly details?: any;
  
  /**
   * 標準錯誤回應
   */
  response?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    traceId?: string;
  };
  
  /**
   * 追蹤識別碼
   */
  traceId?: string;
  
  /**
   * 建立庫存錯誤
   * @param code 錯誤代碼
   * @param message 錯誤訊息
   * @param details 錯誤詳情
   */
  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    
    // 確保 instanceof 正常工作
    Object.setPrototypeOf(this, InventoryError.prototype);
  }
  
  /**
   * 生成用於日誌的格式化錯誤信息
   */
  toLogFormat(): any {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
      traceId: this.traceId
    };
  }
  
  /**
   * 轉換為標準的 API 回應格式
   */
  toApiResponse(): any {
    return this.response || {
      error: {
        code: this.code,
        message: this.message,
        details: this.details
      }
    };
  }
}

/**
 * 驗證錯誤
 */
export class ValidationError extends InventoryError {
  /**
   * 建立驗證錯誤
   * @param message 錯誤訊息
   * @param fields 無效的欄位名稱列表
   */
  constructor(message: string, fields?: string[]) {
    super('VALIDATION_ERROR', message, { invalidFields: fields || [] });
  }
}

/**
 * 品項不存在錯誤
 */
export class ItemNotFoundError extends InventoryError {
  readonly itemId: string;
  
  /**
   * 建立品項不存在錯誤
   * @param itemId 品項ID
   */
  constructor(itemId: string) {
    super('ITEM_NOT_FOUND', `找不到品項: ${itemId}`, { itemId });
    this.itemId = itemId;
  }
}

/**
 * 負庫存錯誤
 */
export class NegativeStockError extends InventoryError {
  readonly itemId: string;
  readonly storeId: string;
  
  /**
   * 建立負庫存錯誤
   * @param itemId 品項ID
   * @param storeId 店鋪ID
   */
  constructor(itemId: string, storeId: string) {
    super(
      'NEGATIVE_STOCK_ERROR',
      `品項 ${itemId} 在店鋪 ${storeId} 的庫存不足`,
      { itemId, storeId }
    );
    this.itemId = itemId;
    this.storeId = storeId;
  }
}

/**
 * 事務太大錯誤
 */
export class TransactionTooLargeError extends InventoryError {
  /**
   * 建立事務太大錯誤
   */
  constructor() {
    super(
      'TRANSACTION_TOO_LARGE',
      '批次處理數量過多，請減少每批的數量'
    );
  }
}

/**
 * 權限拒絕錯誤
 */
export class PermissionDeniedError extends InventoryError {
  /**
   * 建立權限拒絕錯誤
   * @param operation 嘗試執行的操作
   */
  constructor(operation: string) {
    super(
      'PERMISSION_DENIED',
      `沒有權限執行操作: ${operation}`,
      { operation }
    );
  }
}

/**
 * 資料庫操作錯誤
 */
export class DatabaseOperationError extends InventoryError {
  readonly originalError: any;
  
  /**
   * 建立資料庫操作錯誤
   * @param operation 嘗試執行的操作
   * @param originalError 原始錯誤
   */
  constructor(operation: string, originalError: any) {
    super(
      'DATABASE_OPERATION_ERROR',
      `資料庫操作失敗: ${operation}`,
      { originalError: originalError.message || originalError.toString() }
    );
    this.originalError = originalError;
  }
}

/**
 * 重複庫存記錄錯誤
 */
export class DuplicateStockRecordError extends InventoryError {
  readonly itemId: string;
  readonly storeId: string;
  
  /**
   * 建立重複庫存記錄錯誤
   * @param itemId 品項ID
   * @param storeId 店鋪ID
   */
  constructor(itemId: string, storeId: string) {
    super(
      'DUPLICATE_STOCK_RECORD',
      `品項 ${itemId} 在店鋪 ${storeId} 的庫存記錄已存在`,
      { itemId, storeId }
    );
    this.itemId = itemId;
    this.storeId = storeId;
  }
}

/**
 * 資料已刪除錯誤
 */
export class RecordDeletedError extends InventoryError {
  readonly recordId: string;
  readonly recordType: string;
  
  /**
   * 建立資料已刪除錯誤
   * @param recordType 記錄類型
   * @param recordId 記錄ID
   */
  constructor(recordType: string, recordId: string) {
    super(
      'RECORD_DELETED',
      `${recordType} ${recordId} 已被刪除，無法操作`,
      { recordType, recordId }
    );
    this.recordId = recordId;
    this.recordType = recordType;
  }
}

/**
 * 限額超出錯誤
 */
export class QuotaExceededError extends InventoryError {
  readonly quotaType: string;
  readonly currentValue: number;
  readonly maxValue: number;
  
  /**
   * 建立限額超出錯誤
   * @param quotaType 限額類型
   * @param currentValue 目前數值
   * @param maxValue 最大允許數值
   * @param customMessage 自定義錯誤訊息
   */
  constructor(quotaType: string, currentValue: number, maxValue: number, customMessage?: string) {
    const message = customMessage || `${quotaType} 限額超出: 目前 ${currentValue}, 最大 ${maxValue}`;
    
    super(
      'QUOTA_EXCEEDED',
      message,
      { quotaType, currentValue, maxValue }
    );
    this.quotaType = quotaType;
    this.currentValue = currentValue;
    this.maxValue = maxValue;
  }
} 