/**
 * 權限工具函數 - 權限檢查相關功能
 */

import { authService } from '../services/authService';

/**
 * 檢查當前用戶是否擁有指定權限
 * @param permission 權限碼 (例如: 'inventory:create', 'inventory:update')
 * @returns 是否擁有該權限
 */
export const hasPermission = async (permission: string): Promise<boolean> => {
  try {
    // 獲取當前用戶的claims
    const claims = await authService.getUserClaims();
    
    // 若無claims或未登入，直接返回false
    if (!claims) return false;
    
    // 超級管理員擁有所有權限
    if (claims.role === 'superadmin') return true;
    
    // 檢查用戶權限列表
    const userPermissions = claims.permissions as string[] || [];
    
    // 判斷用戶是否擁有目標權限
    return userPermissions.includes(permission);
  } catch (error) {
    console.error('檢查權限時出錯:', error);
    return false;
  }
};

/**
 * 檢查當前用戶是否至少具有指定角色
 * @param minRole 最低需要的角色 ('admin', 'manager', 'staff')
 * @returns 是否達到要求的角色等級
 */
export const hasRole = async (minRole: string): Promise<boolean> => {
  try {
    // 獲取當前用戶的claims
    const claims = await authService.getUserClaims();
    
    // 若無claims或未登入，直接返回false
    if (!claims) return false;
    
    // 獲取用戶角色
    const userRole = claims.role as string;
    
    // 角色等級對應表 (數字越大權限越高)
    const roleLevel: Record<string, number> = {
      'customer': 1,
      'staff': 2,
      'shift_leader': 3,
      'manager': 4,
      'admin': 5,
      'tenantadmin': 6,
      'superadmin': 7
    };
    
    // 檢查用戶角色等級是否符合要求
    return (roleLevel[userRole] || 0) >= (roleLevel[minRole] || 0);
  } catch (error) {
    console.error('檢查角色時出錯:', error);
    return false;
  }
}; 