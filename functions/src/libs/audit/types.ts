/**
 * 操作日誌 (Audit Log) 模組 - 類型定義
 */
import * as admin from 'firebase-admin';

/**
 * 操作結果狀態枚舉
 */
export enum AuditLogStatus {
  SUCCESS = 'success',    // 操作成功
  FAILURE = 'failure',    // 操作失敗
  WARNING = 'warning',    // 操作完成但有警告
  CANCELED = 'canceled'   // 操作被取消
}

/**
 * 操作類型枚舉 - 這裡列出一些常見操作
 * 實際使用時可以擴展更多的操作類型
 */
export enum AuditLogAction {
  // 使用者相關操作
  USER_CREATE = 'user_create',               // 創建使用者
  USER_UPDATE = 'user_update',               // 更新使用者資料
  USER_DELETE = 'user_delete',               // 刪除使用者
  USER_LOGIN = 'user_login',                 // 使用者登入
  USER_LOGOUT = 'user_logout',               // 使用者登出
  USER_PASSWORD_RESET = 'user_password_reset', // 重置密碼
  
  // 權限相關操作
  ROLE_ASSIGN = 'role_assign',               // 分配角色
  PERMISSION_CHANGE = 'permission_change',   // 更改權限
  
  // 租戶相關操作
  TENANT_CREATE = 'tenant_create',           // 創建租戶
  TENANT_UPDATE = 'tenant_update',           // 更新租戶資料
  TENANT_STATUS_CHANGE = 'tenant_status_change', // 改變租戶狀態
  
  // 商店相關操作
  STORE_CREATE = 'store_create',             // 創建商店
  STORE_UPDATE = 'store_update',             // 更新商店資料
  STORE_DELETE = 'store_delete',             // 刪除商店
  
  // 產品相關操作
  PRODUCT_CREATE = 'product_create',         // 創建產品
  PRODUCT_UPDATE = 'product_update',         // 更新產品資料
  PRODUCT_DELETE = 'product_delete',         // 刪除產品
  
  // 訂單相關操作
  ORDER_CREATE = 'order_create',             // 創建訂單
  ORDER_UPDATE = 'order_update',             // 更新訂單
  ORDER_STATUS_CHANGE = 'order_status_change', // 更改訂單狀態
  ORDER_PAYMENT = 'order_payment',           // 訂單付款
  ORDER_REFUND = 'order_refund',             // 訂單退款
  
  // 庫存相關操作
  INVENTORY_ADJUST = 'inventory_adjust',     // 調整庫存
  INVENTORY_CHECK = 'inventory_check',       // 庫存盤點
  
  // 員工相關操作
  EMPLOYEE_CREATE = 'employee_create',       // 創建員工
  EMPLOYEE_UPDATE = 'employee_update',       // 更新員工資料
  EMPLOYEE_TERMINATE = 'employee_terminate', // 終止員工
  
  // 系統設定相關操作
  SETTINGS_UPDATE = 'settings_update',       // 更新系統設定
  
  // 資料操作類型
  DATA_EXPORT = 'data_export',               // 匯出資料
  DATA_IMPORT = 'data_import',               // 導入資料
  DATA_DELETE = 'data_delete',               // 刪除資料
  
  // 其他操作
  CUSTOM_ACTION = 'custom_action',           // 自定義操作
  SYSTEM_EVENT = 'system_event'              // 系統事件
}

/**
 * 實體類型枚舉 - 這裡列出一些常見的實體類型
 * 實際使用時可以擴展更多的實體類型
 */
export enum AuditLogEntityType {
  USER = 'user',                    // 使用者
  ROLE = 'role',                    // 角色
  TENANT = 'tenant',                // 租戶
  STORE = 'store',                  // 商店
  PRODUCT = 'product',              // 產品
  ORDER = 'order',                  // 訂單
  INVENTORY = 'inventory',          // 庫存
  EMPLOYEE = 'employee',            // 員工
  SETTINGS = 'settings',            // 設定
  SYSTEM = 'system',                // 系統
  OTHER = 'other'                   // 其他
}

/**
 * 操作日誌資料結構
 */
export interface AuditLog {
  id: string;                            // 日誌ID
  timestamp: admin.firestore.Timestamp;  // 操作時間
  
  // 操作者資訊
  userId: string;                        // 操作者ID
  userName?: string;                     // 操作者名稱 (可選)
  userEmail?: string;                    // 操作者郵箱 (可選)
  userRole?: string;                     // 操作者角色 (可選)
  tenantId?: string;                     // 租戶ID (可選)
  storeId?: string;                      // 商店ID (可選)
  
  // 操作資訊
  action: string;                        // 操作類型
  actionCategory?: string;               // 操作類別 (可選)
  status: AuditLogStatus;                // 操作結果狀態
  statusMessage?: string;                // 狀態訊息 (可選)
  
  // 操作對象
  targetEntityType: string;              // 操作對象類型
  targetEntityId: string;                // 操作對象ID
  targetEntityName?: string;             // 操作對象名稱 (可選)
  
  // 詳細資訊
  details?: Record<string, any>;         // 詳細資訊 (可選)
  previousState?: Record<string, any>;   // 操作前狀態 (可選)
  newState?: Record<string, any>;        // 操作後狀態 (可選)
  
  // 環境資訊
  ipAddress?: string;                    // IP地址 (可選)
  userAgent?: string;                    // 使用者代理 (可選)
  requestPath?: string;                  // 請求路徑 (可選)
  requestMethod?: string;                // 請求方法 (可選)
}

/**
 * 創建操作日誌的輸入參數
 */
export interface AuditLogInput {
  // 操作者資訊 (userId 為必填，其他可選)
  userId: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  tenantId?: string;
  storeId?: string;
  
  // 操作資訊 (action 為必填)
  action: string;
  actionCategory?: string;
  status?: AuditLogStatus;
  statusMessage?: string;
  
  // 操作對象 (兩者皆為必填)
  targetEntityType: string;
  targetEntityId: string;
  targetEntityName?: string;
  
  // 詳細資訊 (都是可選的)
  details?: Record<string, any>;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  
  // 環境資訊 (都是可選的)
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
} 