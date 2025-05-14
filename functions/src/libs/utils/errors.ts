/**
 * 通用錯誤處理類
 * 
 * 提供標準化的錯誤格式和處理機制
 */

/**
 * 自定義錯誤類
 * 
 * 用於標準化 API 錯誤響應
 */
export class CustomError extends Error {
  /**
   * HTTP 狀態碼
   */
  statusCode: number;
  
  /**
   * 錯誤詳情
   */
  details?: any;
  
  /**
   * 錯誤代碼
   */
  errorCode?: string;
  
  /**
   * 構造函數
   * 
   * @param message 錯誤消息
   * @param statusCode HTTP 狀態碼 (默認 500)
   * @param details 錯誤詳情
   * @param errorCode 錯誤代碼
   */
  constructor(
    message: string, 
    statusCode: number = 500, 
    details?: any, 
    errorCode?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.errorCode = errorCode;
    
    // 確保 instanceof 正常工作
    Object.setPrototypeOf(this, CustomError.prototype);
  }
  
  /**
   * 轉換為 JSON 格式
   */
  toJSON(): any {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      errorCode: this.errorCode
    };
  }
}

/**
 * 驗證錯誤
 */
export class ValidationError extends CustomError {
  /**
   * 構造函數
   * 
   * @param message 錯誤消息
   * @param fields 無效的字段
   */
  constructor(message: string, fields?: string[]) {
    super(
      message, 
      400, 
      { invalidFields: fields || [] }, 
      'VALIDATION_ERROR'
    );
  }
}

/**
 * 未找到資源錯誤
 */
export class NotFoundError extends CustomError {
  /**
   * 構造函數
   * 
   * @param message 錯誤消息
   * @param resource 資源類型
   */
  constructor(message: string, resource?: string) {
    super(
      message, 
      404, 
      { resource }, 
      'RESOURCE_NOT_FOUND'
    );
  }
}

/**
 * 權限錯誤
 */
export class PermissionError extends CustomError {
  /**
   * 構造函數
   * 
   * @param message 錯誤消息
   * @param requiredPermission 所需權限
   */
  constructor(message: string, requiredPermission?: string) {
    super(
      message, 
      403, 
      { requiredPermission }, 
      'PERMISSION_DENIED'
    );
  }
}

/**
 * 認證錯誤
 */
export class AuthenticationError extends CustomError {
  /**
   * 構造函數
   * 
   * @param message 錯誤消息
   */
  constructor(message: string = '需要身份驗證') {
    super(
      message, 
      401, 
      undefined, 
      'AUTHENTICATION_REQUIRED'
    );
  }
}
