import { firestore } from 'firebase-admin';

/**
 * 權限配置
 */
export interface Permission {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

/**
 * 角色範圍類型
 */
export type RoleScope = 'global' | 'tenant' | 'store';

/**
 * 有效的操作類型
 */
export type ActionType = 
  'create' | 'read' | 'update' | 'delete' | 
  'approve' | 'reject' | 'cancel' | 'complete' | 
  'print' | 'export' | 'discount' | 'refund' | 
  'manage';

/**
 * 有效的資源類型
 */
export type ResourceType = 
  'tenants' | 'stores' | 'users' | 'employees' | 
  'menuItems' | 'menuCategories' | 'menuOptions' | 
  'orders' | 'orderItems' | 'inventoryItems' | 
  'inventoryCounts' | 'inventoryOrders' | 'schedules' | 
  'attendances' | 'leaves' | 'payrolls' | 'roles';

/**
 * 權限項目
 */
export interface PermissionItem {
  resourceType: ResourceType;
  action: ActionType;
  conditions?: Record<string, any>;
}

/**
 * 角色定義
 */
export interface Role {
  roleId: string;
  roleName: string;
  description: string;
  roleLevel: number; // 權限等級，數字越大表示權限越高，1-10，與 API 規範保持一致
  scope: RoleScope; // 角色範圍：全局(global)、租戶(tenant)、店鋪(store)
  permissions: {
    [resource: string]: Permission;
  };
  isSystemRole: boolean; // 是否為系統角色（系統角色只能由超級管理員修改）
  isActive: boolean;
  tenantId: string | null; // 租戶 ID，系統角色為 null
  createdAt: firestore.Timestamp | string;
  updatedAt: firestore.Timestamp | string;
  createdBy: string;
  updatedBy: string;
}

/**
 * 創建角色請求
 */
export interface CreateRoleRequest {
  roleName: string;
  description?: string;
  roleLevel: number;
  scope: RoleScope; // 角色範圍
  permissions?: {
    [resource: string]: Permission;
  };
  isSystemRole?: boolean;
  isActive?: boolean;
  tenantId: string; // 如果是租戶角色，則必須提供租戶 ID
}

/**
 * 更新角色請求（所有欄位均為可選）
 */
export interface UpdateRoleRequest {
  roleName?: string;
  description?: string;
  roleLevel?: number;
  scope?: RoleScope;
  permissions?: {
    [resource: string]: Permission;
  };
  isActive?: boolean;
}

/**
 * 分配角色請求
 */
export interface AssignRoleRequest {
  userId: string;
}

/**
 * 分頁回應的元數據
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 分頁角色列表回應
 */
export interface PaginatedRoleResponse {
  status: 'success';
  data: Role[];
  pagination: PaginationMeta;
  message?: string; // 可選的成功訊息
}

/**
 * 用戶上下文（JWT解碼後的用戶資料）
 * 應由驗證中介軟體設置到 req.user
 */
export interface UserContext {
  uid: string;
  email?: string;
  role: string;
  roleLevel: number; // 角色等級，數字越小表示權限越高，0 表示最高權限
  tenantId?: string; // 用戶所屬的租戶 ID
  permissions?: {
    [resource: string]: Permission;
  };
} 