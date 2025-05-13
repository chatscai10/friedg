// 角色範圍枚舉
export type RoleScope = 'global' | 'tenant' | 'store' | 'platform';

/**
 * 權限接口定義
 * 更新以匹配 API 規格及前端需求
 */
export interface PermissionItem {
  id: string;                // API 提供的權限唯一 ID
  resourceType: string;      // API 提供的資源類型
  action: string;            // API 提供的操作
  name?: string;             // 前端生成或API提供的可讀名稱 (例如 API 的 description 或組合 resourceType + action)
  description?: string;       // API 提供的權限描述
  conditions?: Record<string, any>; // API 提供的權限條件
}

/**
 * 角色接口定義（與後端API對應）
 */
export interface Role {
  roleId: string;              // 角色ID，唯一標識符
  roleName: string;            // 角色名稱，例如：'Admin', 'Manager' 等
  description: string;         // 角色描述
  isSystemRole: boolean;       // 是否為系統角色，系統角色無法刪除
  scope: RoleScope;            // 角色範圍：'global'（全局）、'tenant'（租戶）或'store'（店鋪）
  roleLevel: number;           // 角色等級，數字越小權限越高
  permissions: PermissionItem[];// 角色擁有的權限列表
  specialPermissions?: Record<string, any> | null; // 特殊權限（JSON 格式）
  status: 'active' | 'inactive' | 'deleted'; // 角色狀態
  tenantId?: string | null;    // 租戶ID，對於tenant或store範圍的角色必須存在
  storeId?: string | null;     // 店鋪ID，對於store範圍的角色必須存在
  createdAt: string;           // 創建時間 (ISO 8601)
  updatedAt: string;           // 更新時間 (ISO 8601)
  createdBy?: string | null;   // 創建者ID (optional)
  updatedBy?: string | null;   // 更新者ID (optional)
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
  scope: RoleScope;              // 角色範圍
  roleLevel?: number;            // 角色等級（可選）
  permissions: Array<{ resourceType: string; action: string; conditions?: Record<string, any> }>; // 更新類型
  specialPermissions?: Record<string, any> | null; // 特殊權限（可選）
  status?: 'active' | 'inactive';// 角色狀態（創建時通常為active，可選）
  tenantId?: string;             // 租戶ID（scope為tenant或store時必須）
  storeId?: string;              // 店鋪ID（scope為store時必須）
}

/**
 * 更新角色的請求數據結構
 */
export interface UpdateRolePayload {
  roleName?: string;             // 角色名稱（可選）
  description?: string;          // 角色描述（可選）
  permissions?: Array<{ resourceType: string; action: string; conditions?: Record<string, any> }>;// 更新類型
  specialPermissions?: Record<string, any> | null; // 特殊權限（可選）
  status?: 'active' | 'inactive' | 'deleted';// 角色狀態（可選）
  roleLevel?: number;            // 角色等級（可選）
  // 不允許更新 scope, tenantId, storeId, isSystemRole, roleId, createdAt, createdBy
}

/**
 * 角色狀態接口（用於Redux存儲）
 * 需要根據實際 Redux store 的狀態結構調整
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
  // 可能需要添加篩選狀態等
  searchTerm: string;
  scopeFilter: RoleScope | '';
  statusFilter: 'active' | 'inactive' | 'deleted' | '';
}

/**
 * 角色編輯表單值接口
 * 用於管理表單狀態，可能需要與 Role 接口略有不同以適應表單組件
 */
export interface RoleFormValues {
  roleName: string;
  description: string;
  scope: RoleScope;
  roleLevel?: number;
  permissions: PermissionItem[];
  specialPermissions?: Record<string, any> | null;
  status: 'active' | 'inactive'; // 表單中通常只處理 active/inactive，deleted 通過刪除操作
  tenantId?: string | null;
  storeId?: string | null;
}

/**
 * 預定義的角色範圍選項
 */
export const ROLE_SCOPES = [
  { value: 'global', label: '全局角色' },
  { value: 'tenant', label: '租戶角色' },
  { value: 'store', label: '店鋪角色' },
  { value: 'platform', label: '平台角色' }
];

/**
 * 有效的資源和操作列表（根據後端 VALID_RESOURCE_ACTIONS 定義）
 * 這裡假設前端也需要這些常量來構建權限編輯 UI
 */
export const VALID_RESOURCES = [
  'users', 'roles', 'stores', 'employees', 'menu', 'orders', 'inventory',
  'attendance', 'reports', 'settings', 'loyalty', 'coupons', 'payments', 'schedule', 'payroll', 'crm', 'notifications' // 根據後端更新的列表進行同步
];

export const VALID_ACTIONS = ['read', 'write', 'delete', 'approve', 'assign', 'manage', 'view', 'create', 'update']; // 根據後端更新的列表進行同步

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
  coupons: '優惠券管理',
  payments: '支付管理',
  schedule: '排班管理',
  payroll: '薪資管理',
  crm: '客戶關係管理',
  notifications: '通知管理',
};

/**
 * 操作顯示名稱映射
 */
export const ACTION_DISPLAY_NAMES: Record<string, string> = {
  read: '查看',
  write: '編輯/創建', // 更名以更準確
  delete: '刪除',
  approve: '審批',
  assign: '分配',
  manage: '管理', // 新增
  view: '查看', // 新增，與 read 可能重疊，根據實際 usage 決定保留哪個
  create: '創建', // 新增
  update: '更新', // 新增
};

/**
 * 生成模擬的所有可用權限列表
 * @returns {PermissionItem[]} 權限項目數組
 */
export function generateMockAllPermissions(): PermissionItem[] {
  const allPermissions: PermissionItem[] = [];
  VALID_RESOURCES.forEach(resourceType => {
    VALID_ACTIONS.forEach(action => {
      const id = `${resourceType}:${action}`;
      const resourceDisplayName = RESOURCE_DISPLAY_NAMES[resourceType] || resourceType;
      const actionDisplayName = ACTION_DISPLAY_NAMES[action] || action;
      const description = `${resourceDisplayName} - ${actionDisplayName}`;
      const name = resourceDisplayName; // 使用資源顯示名稱作為 name

      allPermissions.push({
        id,
        resourceType,
        action,
        name, // 使用資源顯示名稱
        description,
        conditions: undefined, // 暫時設為 undefined
      });
    });
  });
  return allPermissions;
}

// 刪除舊的、不再使用的接口
/*
export interface ResourcePermission {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

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

export interface RoleRequest {
  roleName: string;              // 角色名稱
  description: string;           // 角色描述
  scope?: 'global' | 'tenant';   // 角色範圍（可選，創建時提供，更新時可能不允許修改）
  roleLevel?: number;            // 角色等級（可選）
  permissions: Permission[];     // 角色權限列表
  isActive?: boolean;            // 是否激活（可選）
}
*/ 