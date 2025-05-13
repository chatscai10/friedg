/**
 * 系統權限配置
 * 定義系統中所有可用的資源和操作
 */

// 權限顯示結構，用於UI顯示和選擇
export interface PermissionDisplayItem {
  resource: string;      // 資源名稱
  displayName: string;   // 顯示名稱
  actions: {
    action: string;      // 操作名稱
    displayName: string; // 顯示名稱
  }[];
}

// 系統中所有可用的權限
export const ALL_PERMISSIONS: PermissionDisplayItem[] = [
  {
    resource: 'users',
    displayName: '用戶管理',
    actions: [
      { action: 'create', displayName: '創建用戶' },
      { action: 'read', displayName: '查看用戶' },
      { action: 'update', displayName: '更新用戶' },
      { action: 'delete', displayName: '刪除用戶' }
    ]
  },
  {
    resource: 'roles',
    displayName: '角色管理',
    actions: [
      { action: 'create', displayName: '創建角色' },
      { action: 'read', displayName: '查看角色' },
      { action: 'update', displayName: '更新角色' },
      { action: 'delete', displayName: '刪除角色' }
    ]
  },
  {
    resource: 'stores',
    displayName: '店鋪管理',
    actions: [
      { action: 'create', displayName: '創建店鋪' },
      { action: 'read', displayName: '查看店鋪' },
      { action: 'update', displayName: '更新店鋪' },
      { action: 'delete', displayName: '刪除店鋪' }
    ]
  },
  {
    resource: 'menus',
    displayName: '菜單管理',
    actions: [
      { action: 'create', displayName: '創建菜單' },
      { action: 'read', displayName: '查看菜單' },
      { action: 'update', displayName: '更新菜單' },
      { action: 'delete', displayName: '刪除菜單' }
    ]
  },
  {
    resource: 'orders',
    displayName: '訂單管理',
    actions: [
      { action: 'create', displayName: '創建訂單' },
      { action: 'read', displayName: '查看訂單' },
      { action: 'update', displayName: '更新訂單' },
      { action: 'delete', displayName: '刪除訂單' }
    ]
  },
  {
    resource: 'employees',
    displayName: '員工管理',
    actions: [
      { action: 'create', displayName: '創建員工' },
      { action: 'read', displayName: '查看員工' },
      { action: 'update', displayName: '更新員工' },
      { action: 'delete', displayName: '刪除員工' }
    ]
  },
  {
    resource: 'reports',
    displayName: '報表管理',
    actions: [
      { action: 'read', displayName: '查看報表' },
      { action: 'export', displayName: '導出報表' }
    ]
  },
  {
    resource: 'settings',
    displayName: '系統設置',
    actions: [
      { action: 'read', displayName: '查看設置' },
      { action: 'update', displayName: '更新設置' }
    ]
  }
];

// 轉換權限展示項為實際的權限數組
export const getAllPermissions = () => {
  const permissions = [];
  for (const item of ALL_PERMISSIONS) {
    for (const action of item.actions) {
      permissions.push({
        resource: item.resource,
        action: action.action
      });
    }
  }
  return permissions;
};

// 根據資源和操作獲取顯示名稱
export const getPermissionDisplayName = (resource: string, action: string): string => {
  const resourceItem = ALL_PERMISSIONS.find(item => item.resource === resource);
  if (!resourceItem) return `${resource}:${action}`;
  
  const actionItem = resourceItem.actions.find(a => a.action === action);
  if (!actionItem) return `${resourceItem.displayName}:${action}`;
  
  return `${resourceItem.displayName} - ${actionItem.displayName}`;
};

// 檢查權限是否有效
export const isValidPermission = (resource: string, action: string): boolean => {
  const resourceItem = ALL_PERMISSIONS.find(item => item.resource === resource);
  if (!resourceItem) return false;
  
  return resourceItem.actions.some(a => a.action === action);
}; 