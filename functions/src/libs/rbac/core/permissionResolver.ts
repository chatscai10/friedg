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
    // 如果基礎權限就沒有，提早返回，並包含 query 信息以幫助調試
    return { 
      granted: false, 
      reason: basicPermissionResult.reason + ` (Action: ${query.action}, Resource: ${query.resource})` 
    };
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
  const { resourceId, resource } = query;

  // 如果沒有資源ID或上下文，暫時假設通過（之後可能需要資源內容檢查）
  if (!resourceId && !context) {
    return { granted: true };
  }

  // 超級管理員可以訪問所有資源
  if (role === 'super_admin') {
    return { granted: true };
  }

  // 增強租戶隔離邏輯 - 完善檢查與錯誤提示，特別針對租戶管理員
  // 情境1: 資源有租戶ID，用戶也有租戶ID
  if (context?.tenantId && tenantId) {
    // 租戶管理員只能訪問自己租戶的資源
    if (role === 'tenant_admin' && tenantId !== context.tenantId) {
      console.warn(`租戶管理員 (${user.uid}) 嘗試跨租戶訪問 (用戶租戶: ${tenantId}, 資源租戶: ${context.tenantId}, 資源: ${resource})`);
      return {
        granted: false,
        reason: `租戶管理員只能訪問自己租戶的資源 (您的租戶: ${tenantId}, 資源租戶: ${context.tenantId})`
      };
    }
    
    // 所有非超級管理員角色都需要檢查租戶
    if (tenantId !== context.tenantId) {
      console.warn(`用戶 (${user.uid}, ${role}) 嘗試跨租戶訪問 (用戶租戶: ${tenantId}, 資源租戶: ${context.tenantId}, 資源: ${resource})`);
      return {
        granted: false,
        reason: `無法訪問其他租戶的資源 (用戶租戶: ${tenantId}, 資源租戶: ${context.tenantId})`
      };
    }
  } 
  // 情境2: 資源有租戶ID，但用戶沒有租戶ID
  else if (context?.tenantId && !tenantId) {
    // 只有超級管理員可以無租戶訪問，但超級管理員在前面已經放行
    console.warn(`用戶 (${user.uid}, ${role}) 嘗試無租戶身份訪問租戶資源 (資源租戶: ${context.tenantId}, 資源: ${resource})`);
    return {
      granted: false,
      reason: '您未關聯到任何租戶，無法訪問租戶資源'
    };
  }
  // 情境3: 資源沒有租戶ID，但用戶有租戶ID，不包括超級管理員
  // 這種情況可能是全局資源，租戶用戶也可以訪問，故放行
  else if (!context?.tenantId && tenantId && (role as RoleType) !== 'super_admin') {
    // 允許訪問非租戶資源，但記錄日誌
    console.log(`租戶用戶 (${user.uid}, ${role}, 租戶: ${tenantId}) 訪問非租戶資源 (資源: ${resource}${resourceId ? ', ID: ' + resourceId : ''})`);
  }
  // 情境4: context存在但tenantId不存在，不包括超級管理員
  else if (context && !context.tenantId && (role as RoleType) !== 'super_admin') {
    // 如果資源不應該是跨租戶的，則這是一個潛在的數據完整性問題
    console.warn(`潛在的數據完整性問題: 資源 ${resource}${resourceId ? ' (ID: ' + resourceId + ')' : ''} 沒有租戶ID`);
    // 允許訪問，但記錄警告
  }

  // 檢查店鋪隔離（店鋪級別角色）- 優化使用可選鏈運算符提高代碼健壯性
  if (context?.storeId && 
      ['store_manager', 'shift_leader', 'senior_staff', 'staff', 'trainee'].includes(role as RoleType)) {
    // 檢查用戶是否屬於此店鋪或有權限訪問此店鋪
    const hasStoreAccess = storeId === context.storeId || 
                        (Array.isArray(user.additionalStoreIds) && user.additionalStoreIds.includes(context.storeId));

    if (!hasStoreAccess) {
      console.warn(`店鋪用戶 (${user.uid}, ${role}) 嘗試跨店訪問 (用戶店鋪: ${storeId}, 資源店鋪: ${context.storeId}, 資源: ${resource})`);
      return {
        granted: false,
        reason: `無法訪問其他店鋪的資源 (用戶店鋪: ${storeId}, 資源店鋪: ${context.storeId})`
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

  // 確保 SPECIAL_BUSINESS_RULES 是數組
  if (!Array.isArray(SPECIAL_BUSINESS_RULES)) {
    console.error('SPECIAL_BUSINESS_RULES 不是陣列。目前類型:', typeof SPECIAL_BUSINESS_RULES);
    return { granted: true }; // 如果規則無效，預設允許通過
  }

  // 增強特殊權限邏輯：優先檢查用戶是否有特定的權限屬性
  if (resource === 'orders' && action === 'discount') {
    // 檢查折扣權限
    const requestedDiscount = context?.additionalData?.discountPercentage || 0;
    
    // 檢查用戶是否有折扣權限
    if (!user.permissions?.canDiscount) {
      return {
        granted: false,
        reason: '您沒有套用折扣的權限'
      };
    }
    
    // 檢查折扣百分比是否超過用戶的最大允許折扣
    if (user.permissions?.maxDiscountPercentage !== undefined) {
      if (requestedDiscount > user.permissions.maxDiscountPercentage) {
        return {
          granted: false,
          reason: `您的折扣權限上限為 ${user.permissions.maxDiscountPercentage}%，無法套用 ${requestedDiscount}% 的折扣`
        };
      }
    }
  }
  
  if (resource === 'orders' && action === 'refund') {
    // 檢查退款權限
    const refundAmount = context?.additionalData?.refundAmount || 0;
    
    // 檢查用戶是否有退款權限
    if (!user.permissions?.canRefund) {
      return {
        granted: false,
        reason: '您沒有處理退款的權限'
      };
    }
    
    // 檢查退款金額是否超過用戶的最大允許退款金額
    if (user.permissions?.maxRefundAmount !== undefined) {
      if (refundAmount > user.permissions.maxRefundAmount) {
        return {
          granted: false,
          reason: `您的退款權限上限為 ${user.permissions.maxRefundAmount} 元，無法處理 ${refundAmount} 元的退款`
        };
      }
    }
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
      // 提供更具體的錯誤消息
      let reason = `不符合資源 '${resource}' 上執行 '${action}' 操作的業務規則`;
      
      // 針對特定操作提供更詳細的信息
      if (resource === 'orders') {
        if (action === 'discount') {
          reason = '您嘗試的折扣操作超出了您的權限範圍';
        } else if (action === 'refund') {
          reason = '您嘗試的退款操作超出了您的權限範圍';
        } else if (action === 'cancel') {
          reason = '您沒有權限取消此狀態的訂單';
        }
      }
      
      return {
        granted: false,
        reason
      };
    }
  }

  return { granted: true };
}

/**
 * 檢查用戶角色是否高於或等於目標角色
 * @param userRole 用戶角色
 * @param targetRole 目標角色
 * @returns 是否高於或等於
 */
export function isRoleAtLeast(
  userRole: RoleType,
  targetRole: RoleType
): boolean {
  const userLevel = RoleLevelMap[userRole]; // 使用 RoleLevelMap
  const targetLevel = RoleLevelMap[targetRole]; // 使用 RoleLevelMap

  if (userLevel === undefined || targetLevel === undefined) {
    console.warn(`角色等級未定義: userRole=${userRole} (level: ${userLevel}), targetRole=${targetRole} (level: ${targetLevel})。請檢查 RoleLevelMap。`);
    return false;
  }
  return userLevel <= targetLevel; // 等級數值越小，權限越高
}

/**
 * 獲取能執行特定操作的（最高權限的）角色
 * @param resource 資源類型
 * @param action 操作類型
 * @returns 角色類型或null
 */
export function getMinimumRoleForAction(
  resource: ResourceType,
  action: ActionType
): RoleType | null {
  // 從 RoleLevelMap 獲取角色並按等級排序（數值大的在前，即權限低的在前）
  // 注意：角色等級數值越小，權限越高，所以我們需要反向排序
  const sortedRoles = (Object.keys(RoleLevelMap) as RoleType[]).sort(
    (a, b) => RoleLevelMap[b] - RoleLevelMap[a]
  );

  // 查看資源的特殊處理，訂單讀取權限應該給予顧客
  if (resource === 'orders' && action === 'read' && 
      ROLE_PERMISSIONS_MAP['customer']?.['orders']?.includes('read')) {
    return 'customer';
  }

  // 從權限最低的角色開始遍歷（即 customer、trainee 等）
  for (const role of sortedRoles) {
    const permissions = ROLE_PERMISSIONS_MAP[role]?.[resource];
    if (permissions && permissions.includes(action)) {
      return role;
    }
  }
  
  console.warn(`在 ROLE_PERMISSIONS_MAP 中找不到資源 '${resource}' 或操作 '${action}' 的最小角色配置。`);
  return null;
} 