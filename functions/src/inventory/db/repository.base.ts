/**
 * 通用儲存庫基類
 * 
 * 提供資料庫操作的抽象層，減少對特定資料庫實現的依賴
 */

/**
 * 儲存庫操作選項
 */
export interface RepositoryOptions {
  /** 租戶ID */
  tenantId?: string;
  /** 是否包含已刪除的記錄 */
  includeDeleted?: boolean;
  /** 是否在找不到時創建 */
  createIfNotExists?: boolean;
  /** 自定義集合路徑 */
  customCollectionPath?: string;
  /** 是否使用硬刪除 */
  hardDelete?: boolean;
}

/**
 * 分頁結果介面
 */
export interface PaginatedResult<T> {
  /** 當前頁項目 */
  items: T[];
  /** 總項目數 */
  total: number;
  /** 當前頁碼 */
  page: number;
  /** 每頁項目數 */
  pageSize: number;
  /** 是否還有更多頁 */
  hasMore: boolean;
}

/**
 * 查詢條件
 */
export interface QueryCondition {
  /** 欄位名稱 */
  field: string;
  /** 操作符 */
  operator: string;
  /** 比較值 */
  value: any;
}

/**
 * 排序選項
 */
export interface OrderOption {
  /** 排序欄位 */
  field: string;
  /** 排序方向 */
  direction: 'asc' | 'desc';
}

/**
 * 查詢選項
 */
export interface QueryOptions {
  /** 排序選項 */
  orderBy?: OrderOption[];
  /** 限制結果數量 */
  limit?: number;
  /** 是否計算總數 */
  countTotal?: boolean;
  /** 最後一個文檔的快照 */
  startAfter?: any;
  /** 是否包含已刪除記錄 */
  includeDeleted?: boolean;
  /** 自定義集合路徑 */
  customCollectionPath?: string;
  /** 租戶ID */
  tenantId?: string;
}

/**
 * 查詢結果
 */
export interface QueryResult<T> {
  /** 是否成功 */
  success: boolean;
  /** 結果數據 */
  data: T[];
  /** 出錯信息 */
  error?: string;
  /** 最後一個文檔的快照 */
  lastDoc?: any;
  /** 總項目數 */
  total?: number;
}

/**
 * 批量寫入操作類型
 */
export type BatchWriteOperationType = 'create' | 'update' | 'delete' | 'set';

/**
 * 批量寫入操作
 */
export interface BatchWriteOperation {
  /** 操作類型 */
  type: BatchWriteOperationType;
  /** 集合路徑 */
  collection: string;
  /** 文檔ID */
  id: string;
  /** 數據 (僅用於創建和更新) */
  data?: any;
  /** 操作選項 */
  options?: RepositoryOptions;
}

/**
 * 批量寫入結果
 */
export interface BatchWriteResult {
  /** 是否成功 */
  success: boolean;
  /** 影響的文檔數 */
  affectedCount: number;
  /** 出錯信息 */
  error?: string;
}

/**
 * 資料庫錯誤類別
 */
export class RepositoryError extends AppError {
  constructor(
    message: string,
    code: string = 'DATABASE_ERROR',
    httpCode: number = 500,
    innerError?: Error,
    context?: ErrorContext
  ) {
    super(
      message,
      code,
      httpCode,
      ErrorSeverity.HIGH,
      ErrorSource.SYSTEM,
      context,
      innerError
    );
  }
}

/**
 * 儲存庫基類
 */
export abstract class BaseRepository<T extends { id?: string }> {
  /**
   * 構造函數
   * @param collectionName 集合名稱
   */
  constructor(protected readonly collectionName: string) {}
  
  /**
   * 生成錯誤上下文
   */
  protected createErrorContext(operation: string, params?: Record<string, any>): ErrorContext {
    return {
      component: `db.${this.collectionName}`,
      operation,
      params,
      severity: ErrorSeverity.HIGH,
      source: ErrorSource.SYSTEM
    };
  }
  
  /**
   * 處理錯誤
   */
  protected handleError(error: any, operation: string, params?: Record<string, any>): never {
    const context = this.createErrorContext(operation, params);
    
    // 若已是 AppError 類型則直接添加上下文
    if (error instanceof AppError) {
      error.context = error.context || context;
      throw error;
    }
    
    // 轉換為 RepositoryError
    throw new RepositoryError(
      error.message || `操作 ${operation} 失敗`,
      'DATABASE_ERROR',
      500,
      error,
      context
    );
  }
  
  /**
   * 獲取單個記錄
   * @param id 記錄ID
   * @param options 操作選項
   */
  abstract async getById(id: string, options?: RepositoryOptions): Promise<T | null>;
  
  /**
   * 根據條件查詢單個記錄
   * @param conditions 查詢條件
   * @param options 查詢選項
   */
  abstract async findOne(conditions: QueryCondition[], options?: QueryOptions): Promise<T | null>;
  
  /**
   * 根據條件查詢多個記錄
   * @param conditions 查詢條件
   * @param options 查詢選項
   */
  abstract async find(conditions: QueryCondition[], options?: QueryOptions): Promise<QueryResult<T>>;
  
  /**
   * 查詢帶分頁的記錄
   * @param conditions 查詢條件
   * @param page 頁碼
   * @param pageSize 每頁記錄數
   * @param options 查詢選項
   */
  abstract async findWithPagination(
    conditions: QueryCondition[],
    page: number,
    pageSize: number,
    options?: QueryOptions
  ): Promise<PaginatedResult<T>>;
  
  /**
   * 創建記錄
   * @param data 記錄數據
   * @param options 操作選項
   */
  abstract async create(data: Partial<T>, options?: RepositoryOptions): Promise<T>;
  
  /**
   * 更新記錄
   * @param id 記錄ID
   * @param data 更新的數據
   * @param options 操作選項
   */
  abstract async update(id: string, data: Partial<T>, options?: RepositoryOptions): Promise<T>;
  
  /**
   * 刪除記錄
   * @param id 記錄ID
   * @param options 操作選項
   */
  abstract async delete(id: string, options?: RepositoryOptions): Promise<boolean>;
  
  /**
   * 批量獲取記錄
   * @param ids 記錄ID列表
   * @param options 操作選項
   */
  abstract async batchGet(ids: string[], options?: RepositoryOptions): Promise<Record<string, T>>;
  
  /**
   * 批量創建記錄
   * @param items 要創建的記錄列表
   * @param options 操作選項
   */
  abstract async batchCreate(items: Partial<T>[], options?: RepositoryOptions): Promise<T[]>;
  
  /**
   * 批量更新記錄
   * @param items 要更新的記錄列表，每項必須包含ID
   * @param options 操作選項
   */
  abstract async batchUpdate(items: Partial<T>[], options?: RepositoryOptions): Promise<T[]>;
  
  /**
   * 批量刪除記錄
   * @param ids 要刪除的記錄ID列表
   * @param options 操作選項
   */
  abstract async batchDelete(ids: string[], options?: RepositoryOptions): Promise<boolean>;
  
  /**
   * 在事務中執行
   * @param callback 事務回調函數
   */
  abstract async runTransaction<R>(
    callback: (transaction: any) => Promise<R>
  ): Promise<R>;
  
  /**
   * 批量寫入操作
   * @param operations 批量操作列表
   */
  abstract async batchWrite(operations: BatchWriteOperation[]): Promise<BatchWriteResult>;
  
  /**
   * 獲得集合引用
   * @param options 操作選項
   */
  abstract getCollectionRef(options?: RepositoryOptions): any;
  
  /**
   * 獲得文檔引用
   * @param id 文檔ID
   * @param options 操作選項
   */
  abstract getDocRef(id: string, options?: RepositoryOptions): any;
} 