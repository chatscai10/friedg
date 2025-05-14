/**
 * 吃雞排找不早系統 - RBAC函式庫
 * 類型定義文件
 */

// 操作類型
export type ActionType =
  'create' | 'read' | 'update' | 'delete' |
  'approve' | 'reject' | 'cancel' | 'complete' |
  'print' | 'export' | 'discount' | 'refund';

// 資源類型
export type ResourceType =
  'tenants' | 'stores' | 'users' | 'employees' |
  'menuItems' | 'menuCategories' | 'menuOptions' |
  'orders' | 'orderItems' | 'inventoryItems' |
  'inventoryCounts' | 'inventoryOrders' | 'schedules' |
  'attendances' | 'leaves' | 'payrolls' | 'bonusTasks' | 'bonusRecords' |
  'ratings' | 'announcements' | 'knowledgeBase' | 'votes' | 'auditLogs' |
  'systemConfigs' | 'adSlots' | 'adContents' | 'referralCodes' | 'referralUsages' |
  'pickupNumbers' | 'equity' | 'financial';

// 角色類型
export type RoleType =
  'super_admin' | 'tenant_admin' | 'store_manager' |
  'shift_leader' | 'senior_staff' | 'staff' | 'trainee' | 'customer';

// 角色等級
export enum RoleLevel {
  SUPER_ADMIN = 0,
  TENANT_ADMIN = 1,
  STORE_MANAGER = 2,
  SHIFT_LEADER = 3,
  SENIOR_STAFF = 4,
  STAFF = 5,
  TRAINEE = 6,
  CUSTOMER = 99
}

// 角色與等級映射
export const RoleLevelMap: Record<RoleType, RoleLevel> = {
  'super_admin': RoleLevel.SUPER_ADMIN,
  'tenant_admin': RoleLevel.TENANT_ADMIN,
  'store_manager': RoleLevel.STORE_MANAGER,
  'shift_leader': RoleLevel.SHIFT_LEADER,
  'senior_staff': RoleLevel.SENIOR_STAFF,
  'staff': RoleLevel.STAFF,
  'trainee': RoleLevel.TRAINEE,
  'customer': RoleLevel.CUSTOMER
};

// 用戶基本資訊
export interface UserInfo {
  uid: string;
  role: RoleType;
  roleLevel: RoleLevel;
  tenantId?: string;
  storeId?: string;
  additionalStoreIds?: string[];
  permissions?: SpecialPermissions;
}

// 特殊權限標記
export interface SpecialPermissions {
  canDiscount?: boolean;
  canRefund?: boolean;
  canAuditInventory?: boolean;
  maxRefundAmount?: number;
  maxDiscountPercentage?: number;
  [key: string]: any; // 允許添加其他特殊權限
}

// 權限查詢
export interface PermissionQuery {
  action: ActionType;
  resource: ResourceType;
  resourceId?: string;
}

// 權限上下文
export interface PermissionContext {
  tenantId?: string;
  storeId?: string;
  additionalData?: Record<string, any>;
}

// 權限檢查結果
export interface PermissionResult {
  granted: boolean;
  reason?: string;
}

// 資源存取條件
export interface ResourceCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'in';
  value: any;
}

// 權限定義
export interface PermissionDefinition {
  action: ActionType;
  resource: ResourceType;
  conditions?: ResourceCondition[];
  description?: string;
}

// 角色權限表
export interface RolePermissions {
  role: RoleType;
  permissions: PermissionDefinition[];
}

// 自定義錯誤類別
export class PermissionError extends Error {
  constructor(message: string, public action: ActionType, public resource: ResourceType) {
    super(message);
    this.name = 'PermissionError';
  }
}

// HTTP Callable 上下文類型
export interface CallableContext {
  auth?: {
    uid: string;
    token: {
      [key: string]: any;
    };
  };
  [key: string]: any;
}

// HTTP Request 類型
export interface Request {
  [key: string]: any;
}