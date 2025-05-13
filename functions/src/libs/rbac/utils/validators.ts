/**
 * 吃雞排找不早系統 - RBAC函式庫
 * 驗證工具函數
 */

import { RoleType, ResourceType, ActionType } from '../types';

/**
 * 驗證角色類型是否有效
 * @param role 要驗證的角色
 * @returns 是否是有效的角色類型
 */
export function validateRoleType(role: any): role is RoleType {
  const validRoles = [
    'super_admin', 'tenant_admin', 'store_manager', 
    'shift_leader', 'senior_staff', 'staff', 'trainee', 'customer'
  ];
  
  return typeof role === 'string' && validRoles.includes(role);
}

/**
 * 驗證資源類型是否有效
 * @param resource 要驗證的資源類型
 * @returns 是否是有效的資源類型
 */
export function validateResourceType(resource: any): resource is ResourceType {
  const validResources = [
    'tenants', 'stores', 'users', 'employees', 
    'menuItems', 'menuCategories', 'menuOptions', 
    'orders', 'orderItems', 'inventoryItems', 
    'inventoryCounts', 'inventoryOrders', 'schedules', 
    'attendances', 'leaves', 'payrolls', 'bonusTasks', 'bonusRecords',
    'ratings', 'announcements', 'knowledgeBase', 'votes', 'auditLogs',
    'systemConfigs', 'adSlots', 'adContents', 'referralCodes', 'referralUsages', 
    'pickupNumbers'
  ];
  
  return typeof resource === 'string' && validResources.includes(resource);
}

/**
 * 驗證操作類型是否有效
 * @param action 要驗證的操作類型
 * @returns 是否是有效的操作類型
 */
export function validateActionType(action: any): action is ActionType {
  const validActions = [
    'create', 'read', 'update', 'delete', 
    'approve', 'reject', 'cancel', 'complete', 
    'print', 'export', 'discount', 'refund'
  ];
  
  return typeof action === 'string' && validActions.includes(action);
}

/**
 * 驗證字符串ID是否有效
 * @param id 要驗證的ID
 * @returns 是否是有效的ID字符串
 */
export function validateId(id: any): boolean {
  // 簡單驗證：非空字符串
  return typeof id === 'string' && id.trim().length > 0;
}

/**
 * 驗證UUID格式是否有效
 * @param uuid 要驗證的UUID
 * @returns 是否是有效的UUID格式
 */
export function validateUUID(uuid: any): boolean {
  if (typeof uuid !== 'string') {
    return false;
  }
  
  // 標準UUID格式正則表達式
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * 驗證租戶ID是否有效
 * @param tenantId 要驗證的租戶ID
 * @returns 是否是有效的租戶ID
 */
export function validateTenantId(tenantId: any): boolean {
  return validateUUID(tenantId);
}

/**
 * 驗證店鋪ID是否有效
 * @param storeId 要驗證的店鋪ID
 * @returns 是否是有效的店鋪ID
 */
export function validateStoreId(storeId: any): boolean {
  return validateUUID(storeId);
} 