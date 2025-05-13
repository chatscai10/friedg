/**
 * 核心系統類型定義
 */

/**
 * 基礎資源類型
 */
export enum ResourceType {
  ROLES = 'roles',
  USERS = 'users',
  STORES = 'stores',
  MENUS = 'menus',
  MENU_ITEMS = 'menu_items',
  MENU_CATEGORIES = 'menu_categories',
  ORDERS = 'orders',
  CUSTOMERS = 'customers',
  EMPLOYEES = 'employees',
  SCHEDULE = 'schedule',
  INVENTORY = 'inventory',
  REPORTS = 'reports',
  PAYMENTS = 'payments',
}

/**
 * 基礎操作類型
 */
export enum ActionType {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage',
}

/**
 * 系統角色類型
 */
export enum RoleType {
  SUPER_ADMIN = 'super_admin',    // 超級管理員（系統層級）
  TENANT_ADMIN = 'tenant_admin',  // 租戶管理員
  STORE_MANAGER = 'store_manager', // 店長
  STORE_STAFF = 'store_staff',    // 店鋪員工
  STAFF = 'staff',                // 一般員工
  CUSTOMER = 'customer',         // 顧客
}

/**
 * 角色等級映射（數字越小權限越高）
 */
export const RoleLevelMap: Record<RoleType, number> = {
  [RoleType.SUPER_ADMIN]: 0,
  [RoleType.TENANT_ADMIN]: 1,
  [RoleType.STORE_MANAGER]: 2,
  [RoleType.STORE_STAFF]: 3,
  [RoleType.STAFF]: 4,
  [RoleType.CUSTOMER]: 5,
};

/**
 * 已驗證的Firebase函數調用上下文
 */
export interface CallableContext {
  auth?: {
    uid: string;
    token: any;
  };
  rawRequest?: any;
}

/**
 * 基礎用戶信息
 */
export interface UserInfo {
  uid: string;
  role: RoleType | string;
  roleLevel: number;
  tenantId?: string;
  storeId?: string;
  additionalStoreIds?: string[];
  permissions?: Record<string, any>;
  [key: string]: any;
}

/**
 * 基礎操作權限請求
 */
export interface PermissionRequest {
  action: ActionType | string;
  resource: ResourceType | string;
  resourceId?: string;
}

/**
 * 資源上下文（用於權限驗證）
 */
export interface ResourceContext {
  tenantId?: string;
  storeId?: string;
  ownerId?: string;
}

/**
 * 權限檢查結果
 */
export interface PermissionResult {
  granted: boolean;
  reason?: string;
}

/**
 * 分頁查詢參數
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * 分頁結果
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * 基礎API響應
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

/**
 * 帶分頁的API響應
 */
export interface PaginatedApiResponse<T = any> extends ApiResponse<T[]> {
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * 審計日誌類型
 */
export interface AuditLogEntry {
  action: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  userRole: string;
  timestamp: Date | any; // Firestore Timestamp
  details?: any;
  tenantId?: string;
  storeId?: string;
  ip?: string;
  changes?: {
    before?: any;
    after?: any;
  };
} 