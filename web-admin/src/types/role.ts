// 角色範圍枚舉
export type RoleScope = 'global' | 'tenant' | 'store';

/**
 * 權限接口定義
 */
export interface Permission {
  resource: string;     // 資源名稱，例如：'users', 'orders', 'products' 等
  action: string;       // 對資源的操作，例如：'read', 'write', 'delete' 等
}

// 資源權限類型
export interface ResourcePermission {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

// 基本權限設定類型
export interface BasicPermissions {
  employees?: ResourcePermission;
  stores?: ResourcePermission;
  products?: ResourcePermission;
  categories?: ResourcePermission;
  orders?: ResourcePermission;
  customers?: ResourcePermission;
  reports?: ResourcePermission;
  settings?: ResourcePermission;
  roles?: ResourcePermission;
}

/**
 * 角色接口定義（與後端API對應）
 */
export interface Role {
  roleId: string;              // 角色ID，唯一標識符
  roleName: string;            // 角色名稱，例如：'Admin', 'Manager' 等
  description: string;         // 角色描述
  isSystemRole: boolean;       // 是否為系統角色，系統角色無法刪除
  scope: 'global' | 'tenant';  // 角色範圍：'global'（全局）或'tenant'（租戶）
  roleLevel: number;           // 角色等級，數字越小權限越高
  permissions: Permission[];   // 角色擁有的權限列表
  isActive: boolean;           // 角色是否激活
  tenantId?: string | null;    // 租戶ID，對於tenant範圍的角色必須存在
  createdAt: string;           // 創建時間
  updatedAt: string;           // 更新時間
  createdBy?: string;          // 創建者ID
  updatedBy?: string;          // 更新者ID
}

// 保留舊角色接口以保持兼容性
export interface LegacyRole {
  id: string;
  name: string;
  description?: string;
  level: number; // 1-10 之間的權限等級
  scope: RoleScope;
  permissions: BasicPermissions;
  tenantId?: string; // 如果是租戶或店鋪範圍的角色，會有租戶ID
  storeId?: string; // 如果是店鋪範圍的角色，會有店鋪ID
  createdAt: string;
  updatedAt: string;
}

/**
 * 角色列表響應接口
 */
export interface RolesResponse {
  status: string;         // API響應狀態，例如：'success'
  data: Role[];           // 角色列表數據
  message?: string;       // 可能的消息說明
  pagination?: {          // 分頁信息（如果有）
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * 角色詳情響應接口
 */
export interface RoleResponse {
  status: string;         // API響應狀態
  data: Role;             // 角色詳情數據
  message?: string;       // 可能的消息說明
}

/**
 * 創建角色的請求數據結構
 */
export interface CreateRolePayload {
  roleName: string;              // 角色名稱
  description: string;           // 角色描述
  scope: 'global' | 'tenant';    // 角色範圍
  roleLevel?: number;            // 角色等級（可選）
  permissions: Permission[];     // 角色權限列表
  isActive?: boolean;            // 是否激活（可選，默認為true）
  tenantId?: string;             // 租戶ID（scope為tenant時必須）
}

/**
 * 更新角色的請求數據結構
 */
export interface UpdateRolePayload {
  roleName?: string;             // 角色名稱（可選）
  description?: string;          // 角色描述（可選）
  permissions?: Permission[];    // 角色權限列表（可選）
  isActive?: boolean;            // 是否激活（可選）
  roleLevel?: number;            // 角色等級（可選）
}

/**
 * 創建/更新角色請求接口 (向後兼容)
 * @deprecated 使用 CreateRolePayload 和 UpdateRolePayload 替代
 */
export interface RoleRequest {
  roleName: string;              // 角色名稱
  description: string;           // 角色描述
  scope?: 'global' | 'tenant';   // 角色範圍（可選，創建時提供，更新時可能不允許修改）
  roleLevel?: number;            // 角色等級（可選）
  permissions: Permission[];     // 角色權限列表
  isActive?: boolean;            // 是否激活（可選）
}

/**
 * 角色狀態接口（用於Redux存儲）
 */
export interface RoleState {
  roles: Role[];                 // 角色列表
  currentRole: Role | null;      // 當前選中/編輯的角色
  loading: boolean;              // 加載狀態
  error: string | null;          // 錯誤信息
  saveLoading: boolean;          // 保存過程中的加載狀態
  deleteLoading: boolean;        // 刪除過程中的加載狀態
  saveError: string | null;      // 保存過程中的錯誤信息
  deleteError: string | null;    // 刪除過程中的錯誤信息
  pagination: {                  // 分頁信息
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * 角色編輯表單值接口
 */
export interface RoleFormValues {
  roleName: string;
  description: string;
  scope?: 'global' | 'tenant';
  roleLevel?: number;
  permissions: Permission[];
  isActive: boolean;
}

/**
 * 預定義的角色範圍選項
 */
export const ROLE_SCOPES = [
  { value: 'global', label: '全局角色' },
  { value: 'tenant', label: '租戶角色' }
];

/**
 * 有效的資源和操作列表（根據後端 VALID_RESOURCE_ACTIONS 定義）
 */
export const VALID_RESOURCES = [
  'users', 'roles', 'stores', 'employees', 'menu', 'orders', 'inventory', 
  'attendance', 'reports', 'settings', 'loyalty', 'coupons'
];

export const VALID_ACTIONS = ['read', 'write', 'delete', 'approve', 'assign'];

/**
 * 資源顯示名稱映射
 */
export const RESOURCE_DISPLAY_NAMES: Record<string, string> = {
  users: '用戶管理',
  roles: '角色管理', 
  stores: '店鋪管理',
  employees: '員工管理',
  menu: '菜單管理',
  orders: '訂單管理',
  inventory: '庫存管理',
  attendance: '考勤管理',
  reports: '報表管理',
  settings: '系統設置',
  loyalty: '忠誠度管理',
  coupons: '優惠券管理'
};

/**
 * 操作顯示名稱映射
 */
export const ACTION_DISPLAY_NAMES: Record<string, string> = {
  read: '查看',
  write: '編輯/創建',
  delete: '刪除',
  approve: '審批',
  assign: '分配'
}; 