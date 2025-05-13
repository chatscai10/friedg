import { firestore } from 'firebase-admin';

/**
 * 審計日誌操作狀態
 */
export type AuditLogStatus = 'success' | 'failure';

/**
 * 審計日誌入口介面
 */
export interface AuditLogEntry {
  /**
   * 事件發生時間 (由伺服器自動設定)
   */
  timestamp: firestore.Timestamp;

  /**
   * 執行操作的用戶ID
   */
  userId: string;

  /**
   * 執行操作的用戶名稱 (可選)
   */
  userName?: string;

  /**
   * 操作所屬的租戶ID (可選)
   */
  tenantId?: string;

  /**
   * 操作所屬的店鋪ID (可選)
   */
  storeId?: string;

  /**
   * 執行的操作類型，格式通常為 `resource.action`
   * 例如: user.login, role.create, menuItem.update, order.cancel
   */
  action: string;

  /**
   * 操作的資源類型
   * 例如: user, role, menuItem, order
   */
  resourceType: string;

  /**
   * 操作的資源ID (可選)
   */
  resourceId?: string;

  /**
   * 一個包含操作細節的物件
   * 例如對於更新操作，可以記錄更新前後的部分數據
   * 對於登入操作，可以記錄IP地址、User Agent等
   */
  details: Record<string, any>;

  /**
   * 操作結果狀態: 成功或失敗
   */
  status: AuditLogStatus;

  /**
   * 如果操作失敗，記錄錯誤訊息 (可選)
   */
  errorMessage?: string;

  /**
   * 用戶IP地址 (可選)
   */
  ipAddress?: string;

  /**
   * 用戶瀏覽器資訊 (可選)
   */
  userAgent?: string;
}

/**
 * 建立審計日誌入口的輸入參數
 * 不包含timestamp，因為它將由服務自動設定
 */
export type CreateAuditLogParams = Omit<AuditLogEntry, 'timestamp'> & {
  timestamp?: firestore.Timestamp;
};

/**
 * 審計日誌操作類型列舉
 */
export enum AuditAction {
  // 用戶相關操作
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_PASSWORD_RESET = 'USER_PASSWORD_RESET',
  
  // 角色相關操作
  ROLE_CREATE = 'ROLE_CREATE',
  ROLE_UPDATE = 'ROLE_UPDATE',
  ROLE_DELETE = 'ROLE_DELETE',
  
  // 菜單相關操作
  MENU_ITEM_CREATE = 'MENU_ITEM_CREATE',
  MENU_ITEM_UPDATE = 'MENU_ITEM_UPDATE',
  MENU_ITEM_DELETE = 'MENU_ITEM_DELETE',
  
  // 訂單相關操作
  ORDER_CREATE = 'ORDER_CREATE',
  ORDER_UPDATE = 'ORDER_UPDATE',
  ORDER_CANCEL = 'ORDER_CANCEL',
  ORDER_DISCOUNT = 'ORDER_DISCOUNT', // 訂單套用折扣
  ORDER_REFUND = 'ORDER_REFUND',     // 訂單退款
  
  // 庫存相關操作
  INVENTORY_ITEM_CREATE = 'INVENTORY_ITEM_CREATE',
  INVENTORY_ITEM_UPDATE = 'INVENTORY_ITEM_UPDATE',
  INVENTORY_ITEM_DELETE = 'INVENTORY_ITEM_DELETE',
  INVENTORY_ADJUSTMENT = 'INVENTORY_ADJUSTMENT',
  
  // 安全與特殊操作
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  SPECIAL_PERMISSION_USE = 'SPECIAL_PERMISSION_USE', // 使用特殊權限（如折扣、退款）
  FAILED_PERMISSION_ATTEMPT = 'FAILED_PERMISSION_ATTEMPT', // 權限驗證失敗嘗試
  SYSTEM_CONFIG_CHANGE = 'SYSTEM_CONFIG_CHANGE'
} 