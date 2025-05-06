/**
 * 吃雞排找不早系統 - RBAC函式庫
 * 權限解析層(Permission Resolution Layer)
 */

import { 
  UserInfo, 
  PermissionQuery, 
  PermissionContext, 
  PermissionResult,
  ActionType,
  ResourceType,
  RoleLevelMap,
  RoleType
} from '../types';
import { 
  ROLE_PERMISSIONS_MAP, 
  RESOURCE_OWNERSHIP_CHECKS, 
  RESOURCE_ACCESS_SCOPE,
  SPECIAL_BUSINESS_RULES
} from '../constants';

/**
 * 檢查用戶是否有權限執行特定操作
 * @param user 用戶資訊
 * @param query 權限查詢參數
 * @param context 權限上下文
 * @returns 權限檢查結果
 */
export async function hasPermission(
  user: UserInfo,
  query: PermissionQuery,
  context?: PermissionContext
): Promise<PermissionResult> {
  // 基本權限檢查（靜態權限映射）
  const basicPermissionResult = checkBasicPermission(user, query);
  if (!basicPermissionResult.granted) {
    return basicPermissionResult;
  }

  // 資源存取範圍檢查
  const scopeResult = await checkResourceScope(user, query, context);
  if (!scopeResult.granted) {
    return scopeResult;
  }

  // 資源所有權檢查（特定資源類型需要檢查所有權）
  const ownershipResult = await checkResourceOwnership(user, query, context);
  if (!ownershipResult.granted) {
    return ownershipResult;
  }

  // 特殊業務規則檢查
  const businessRuleResult = await checkBusinessRules(user, query, context);
  if (!businessRuleResult.granted) {
    return businessRuleResult;
  }

  return { granted: true };
}

/**
 * 檢查用戶的基本權限（根據角色靜態定義）
 */
function checkBasicPermission(
  user: UserInfo,
  query: PermissionQuery
): PermissionResult {
  const { role } = user;
  const { action, resource } = query;

  // 檢查角色是否存在於權限映射中
  if (!ROLE_PERMISSIONS_MAP[role]) {
    return {
      granted: false,
      reason: `角色 '${role}' 未定義權限`
    };
  }

  // 檢查資源是否存在於角色的權限映射中
  const resourcePermissions = ROLE_PERMISSIONS_MAP[role][resource];
  if (!resourcePermissions) {
    return {
      granted: false,
      reason: `角色 '${role}' 無法訪問資源 '${resource}'`
    };
  }

  // 檢查角色是否有執行特定操作的權限
  if (!resourcePermissions.includes(action)) {
    return {
      granted: false,
      reason: `角色 '${role}' 沒有權限在資源 '${resource}' 上執行 '${action}' 操作`
    };
  }

  return { granted: true };
}

/**
 * 檢查用戶對資源的存取範圍
 */
async function checkResourceScope(
  user: UserInfo,
  query: PermissionQuery,
  context?: PermissionContext
): Promise<PermissionResult> {
  const { role, tenantId, storeId } = user;
  const { resourceId } = query;

  // 如果沒有資源ID或上下文，暫時假設通過（之後可能需要資源內容檢查）
  if (!resourceId || !context) {
    return { granted: true };
  }

  // 超級管理員可以訪問所有資源
  if (role === 'super_admin') {
    return { granted: true };
  }

  // 檢查租戶隔離
  if (context.tenantId) {
    if (tenantId !== context.tenantId) {
      return {
        granted: false,
        reason: '無法訪問其他租戶的資源'
      };
    }
  }

  // 檢查店鋪隔離（店鋪級別角色）
  if (context.storeId && 
      ['store_manager', 'shift_leader', 'senior_staff', 'staff', 'trainee'].includes(role as RoleType)) {
    // 檢查用戶是否屬於此店鋪或有權限訪問此店鋪
    const hasStoreAccess = storeId === context.storeId || 
                         (user.additionalStoreIds && user.additionalStoreIds.includes(context.storeId));

    if (!hasStoreAccess) {
      return {
        granted: false,
        reason: '無法訪問其他店鋪的資源'
      };
    }
  }

  return { granted: true };
}

/**
 * 檢查用戶對資源的所有權
 */
async function checkResourceOwnership(
  user: UserInfo,
  query: PermissionQuery,
  context?: PermissionContext
): Promise<PermissionResult> {
  const { role, uid } = user;
  const { resource, resourceId } = query;
  
  // 沒有資源ID或上下文時，暫時假設通過
  if (!resourceId || !context || !context.additionalData) {
    return { granted: true };
  }

  // 系統管理員、租戶管理員和店長不需要所有權檢查
  if (['super_admin', 'tenant_admin', 'store_manager'].includes(role)) {
    return { granted: true };
  }

  // 檢查資源是否需要所有權檢查
  const ownershipFields = RESOURCE_OWNERSHIP_CHECKS[resource];
  if (!ownershipFields || ownershipFields.length === 0) {
    return { granted: true }; // 此資源不需要所有權檢查
  }

  // 顧客角色特殊處理
  if (role === 'customer') {
    // 對於具有所有權欄位的資源，檢查資源是否屬於此顧客
    for (const field of ownershipFields) {
      if (context.additionalData[field] === uid) {
        return { granted: true };
      }
    }
    
    return {
      granted: false,
      reason: '顧客只能訪問自己的資源'
    };
  }

  // 員工角色的所有權檢查（根據RESOURCE_ACCESS_SCOPE中的設定）
  const accessScope = RESOURCE_ACCESS_SCOPE[role];
  if (accessScope.scope === 'own') {
    for (const field of ownershipFields) {
      if (context.additionalData[field] === uid) {
        return { granted: true };
      }
    }
    
    return {
      granted: false,
      reason: '此角色只能訪問自己的資源'
    };
  }

  return { granted: true };
}

/**
 * 檢查特殊業務規則
 */
async function checkBusinessRules(
  user: UserInfo,
  query: PermissionQuery,
  context?: PermissionContext
): Promise<PermissionResult> {
  const { action, resource } = query;
  
  // 如果沒有上下文或額外數據，暫時假設通過
  if (!context || !context.additionalData) {
    return { granted: true };
  }

  // 尋找匹配的特殊業務規則
  const matchingRules = SPECIAL_BUSINESS_RULES.filter(
    rule => rule.resource === resource && rule.action === action
  );

  // 如果沒有匹配的規則，通過檢查
  if (matchingRules.length === 0) {
    return { granted: true };
  }

  // 檢查每個匹配的規則
  for (const rule of matchingRules) {
    const result = rule.rule(user, context.additionalData, context);
    if (!result) {
      return {
        granted: false,
        reason: `不符合資源 '${resource}' 上執行 '${action}' 操作的業務規則`
      };
    }
  }

  return { granted: true };
}

/**
 * 檢查用戶角色是否高於或等於目標角色
 * @param userRole 用戶角色
 * @param targetRole 目標角色
 */
export function isRoleAtLeast(
  userRole: string,
  targetRole: string
): boolean {
  const userRoleLevel = RoleLevelMap[userRole as RoleType];
  const targetRoleLevel = RoleLevelMap[targetRole as RoleType];
  
  if (userRoleLevel === undefined || targetRoleLevel === undefined) {
    return false;
  }
  
  // 角色等級數字越小，權限越高
  return userRoleLevel <= targetRoleLevel;
}

/**
 * 根據資源類型和操作獲取所需的最低角色
 * @param resource 資源類型
 * @param action 操作類型
 */
export function getMinimumRoleForAction(
  resource: ResourceType,
  action: ActionType
): RoleType | null {
  // 按角色等級從低到高檢查
  const rolesByLevel = Object.entries(RoleLevelMap)
    .sort((a, b) => a[1] - b[1])
    .map(([role]) => role);

  for (const role of rolesByLevel) {
    const permissions = ROLE_PERMISSIONS_MAP[role as RoleType][resource];
    if (permissions && permissions.includes(action)) {
      return role as RoleType;
    }
  }

  return null; // 沒有角色可以執行此操作
} 