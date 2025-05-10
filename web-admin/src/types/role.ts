// 角色範圍枚舉
export type RoleScope = 'global' | 'tenant' | 'store';

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

// 角色接口
export interface Role {
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