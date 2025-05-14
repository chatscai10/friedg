/**
 * 離線權限控制服務
 * 在離線狀態下執行權限檢查
 */

import { getAuth } from 'firebase/auth';
import { RoleLevel } from '../types/roles';

/**
 * 權限查詢參數
 */
export interface PermissionQuery {
  action: 'create' | 'read' | 'update' | 'delete' | 'approve';
  resource: string;
  resourceId?: string;
}

/**
 * 權限上下文
 */
export interface PermissionContext {
  tenantId?: string;
  storeId?: string;
  userId?: string;
  customerId?: string;
  employeeId?: string;
  amount?: number;
  status?: string;
  [key: string]: any;
}

/**
 * 權限檢查結果
 */
export interface PermissionResult {
  granted: boolean;
  reason?: string;
}

/**
 * 離線權限控制服務類
 */
export class OfflinePermissionService {
  // 角色等級映射
  private static readonly ROLE_LEVELS: Record<string, number> = {
    'super_admin': RoleLevel.SUPER_ADMIN,
    'tenant_admin': RoleLevel.TENANT_ADMIN,
    'store_manager': RoleLevel.STORE_MANAGER,
    'shift_leader': RoleLevel.SHIFT_LEADER,
    'senior_staff': RoleLevel.SENIOR_STAFF,
    'staff': RoleLevel.STAFF,
    'trainee': RoleLevel.TRAINEE,
    'customer': RoleLevel.CUSTOMER
  };

  // 資源訪問範圍
  private static readonly RESOURCE_ACCESS_SCOPE: Record<string, string> = {
    'tenants': 'global',
    'stores': 'tenant',
    'users': 'tenant',
    'roles': 'tenant',
    'employees': 'store',
    'attendances': 'store',
    'schedules': 'store',
    'leaves': 'store',
    'payrolls': 'tenant',
    'menuCategories': 'store',
    'menuItems': 'store',
    'menuOptions': 'store',
    'orders': 'store',
    'orderItems': 'store',
    'inventoryItems': 'store',
    'inventoryCounts': 'store',
    'inventoryOrders': 'store',
    'customers': 'tenant',
    'ratings': 'store',
    'referrals': 'tenant'
  };

  // 資源操作所需的最低角色等級
  private static readonly RESOURCE_ROLE_REQUIREMENTS: Record<string, Record<string, string>> = {
    'tenants': {
      'create': 'super_admin',
      'read': 'tenant_admin',
      'update': 'tenant_admin',
      'delete': 'super_admin'
    },
    'stores': {
      'create': 'tenant_admin',
      'read': 'staff',
      'update': 'store_manager',
      'delete': 'tenant_admin'
    },
    'users': {
      'create': 'store_manager',
      'read': 'staff',
      'update': 'store_manager',
      'delete': 'tenant_admin'
    },
    'roles': {
      'create': 'tenant_admin',
      'read': 'staff',
      'update': 'tenant_admin',
      'delete': 'tenant_admin'
    },
    'employees': {
      'create': 'store_manager',
      'read': 'shift_leader',
      'update': 'store_manager',
      'delete': 'tenant_admin'
    },
    'attendances': {
      'create': 'staff',
      'read': 'shift_leader',
      'update': 'shift_leader',
      'delete': 'store_manager'
    },
    'schedules': {
      'create': 'shift_leader',
      'read': 'staff',
      'update': 'shift_leader',
      'delete': 'store_manager'
    },
    'leaves': {
      'create': 'staff',
      'read': 'shift_leader',
      'update': 'shift_leader',
      'approve': 'store_manager',
      'delete': 'store_manager'
    },
    'payrolls': {
      'create': 'tenant_admin',
      'read': 'store_manager',
      'update': 'tenant_admin',
      'delete': 'tenant_admin'
    },
    'menuCategories': {
      'create': 'store_manager',
      'read': 'staff',
      'update': 'store_manager',
      'delete': 'store_manager'
    },
    'menuItems': {
      'create': 'store_manager',
      'read': 'staff',
      'update': 'store_manager',
      'delete': 'store_manager'
    },
    'menuOptions': {
      'create': 'store_manager',
      'read': 'staff',
      'update': 'store_manager',
      'delete': 'store_manager'
    },
    'orders': {
      'create': 'staff',
      'read': 'staff',
      'update': 'staff',
      'delete': 'store_manager'
    },
    'orderItems': {
      'create': 'staff',
      'read': 'staff',
      'update': 'staff',
      'delete': 'shift_leader'
    },
    'inventoryItems': {
      'create': 'store_manager',
      'read': 'staff',
      'update': 'shift_leader',
      'delete': 'store_manager'
    },
    'inventoryCounts': {
      'create': 'staff',
      'read': 'staff',
      'update': 'shift_leader',
      'delete': 'store_manager'
    },
    'inventoryOrders': {
      'create': 'shift_leader',
      'read': 'staff',
      'update': 'shift_leader',
      'delete': 'store_manager'
    },
    'customers': {
      'create': 'store_manager',
      'read': 'staff',
      'update': 'store_manager',
      'delete': 'tenant_admin'
    },
    'ratings': {
      'create': 'customer',
      'read': 'staff',
      'update': 'customer',
      'delete': 'store_manager'
    },
    'referrals': {
      'create': 'store_manager',
      'read': 'staff',
      'update': 'store_manager',
      'delete': 'tenant_admin'
    }
  };

  // 特殊權限規則
  private static readonly SPECIAL_PERMISSION_RULES: Record<string, (userRole: string, userRoleLevel: number, context: PermissionContext) => boolean> = {
    // 訂單取消權限
    'orders:cancel': (userRole, userRoleLevel, context) => {
      // 顧客只能取消自己的待處理或已確認的訂單
      if (userRole === 'customer') {
        return context.customerId === context.userId && 
               ['pending', 'confirmed'].includes(context.status || '');
      }
      
      // 班長及以上可以取消任何訂單
      if (userRoleLevel <= RoleLevel.SHIFT_LEADER) {
        return true;
      }
      
      // 一般員工不能取消已處理的訂單
      if (userRole === 'staff') {
        return ['pending', 'confirmed'].includes(context.status || '');
      }
      
      return false;
    },
    
    // 高金額訂單權限
    'orders:high-amount': (userRole, userRoleLevel, context) => {
      const amount = context.amount || 0;
      
      // 超過5000元的訂單需要班長以上權限
      if (amount > 5000) {
        return userRoleLevel <= RoleLevel.SHIFT_LEADER;
      }
      
      // 超過10000元的訂單需要店長以上權限
      if (amount > 10000) {
        return userRoleLevel <= RoleLevel.STORE_MANAGER;
      }
      
      return true;
    },
    
    // 請假審批權限
    'leaves:approve': (userRole, userRoleLevel, context) => {
      // 只有店長及以上可以審批請假
      return userRoleLevel <= RoleLevel.STORE_MANAGER;
    }
  };

  /**
   * 檢查用戶是否有權限執行操作
   */
  async hasPermission(query: PermissionQuery, context: PermissionContext = {}): Promise<PermissionResult> {
    try {
      // 獲取當前用戶
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        return {
          granted: false,
          reason: '用戶未登入'
        };
      }
      
      // 獲取用戶聲明
      const idTokenResult = await user.getIdTokenResult();
      const claims = idTokenResult.claims;
      
      const userRole = claims.role as string || 'customer';
      const userRoleLevel = OfflinePermissionService.ROLE_LEVELS[userRole] || RoleLevel.CUSTOMER;
      const userTenantId = claims.tenantId as string;
      const userStoreId = claims.storeId as string;
      
      // 超級管理員有所有權限
      if (userRole === 'super_admin') {
        return { granted: true };
      }
      
      // 檢查資源是否存在
      if (!OfflinePermissionService.RESOURCE_ROLE_REQUIREMENTS[query.resource]) {
        return {
          granted: false,
          reason: `未知資源: ${query.resource}`
        };
      }
      
      // 檢查操作是否存在
      if (!OfflinePermissionService.RESOURCE_ROLE_REQUIREMENTS[query.resource][query.action]) {
        return {
          granted: false,
          reason: `未知操作: ${query.action}`
        };
      }
      
      // 獲取所需的最低角色
      const requiredRole = OfflinePermissionService.RESOURCE_ROLE_REQUIREMENTS[query.resource][query.action];
      const requiredRoleLevel = OfflinePermissionService.ROLE_LEVELS[requiredRole];
      
      // 檢查用戶角色等級是否足夠
      if (userRoleLevel > requiredRoleLevel) {
        return {
          granted: false,
          reason: `需要 ${requiredRole} 或更高權限`
        };
      }
      
      // 檢查資源範圍
      const resourceScope = OfflinePermissionService.RESOURCE_ACCESS_SCOPE[query.resource];
      
      // 全局範圍資源只有超級管理員可以訪問
      if (resourceScope === 'global' && userRole !== 'super_admin') {
        return {
          granted: false,
          reason: '全局資源需要超級管理員權限'
        };
      }
      
      // 租戶範圍資源需要檢查租戶ID
      if (resourceScope === 'tenant' && context.tenantId && context.tenantId !== userTenantId) {
        return {
          granted: false,
          reason: '無法訪問其他租戶的資源'
        };
      }
      
      // 店鋪範圍資源需要檢查店鋪ID（租戶管理員除外）
      if (resourceScope === 'store' && userRole !== 'tenant_admin' && 
          context.storeId && context.storeId !== userStoreId) {
        return {
          granted: false,
          reason: '無法訪問其他店鋪的資源'
        };
      }
      
      // 檢查特殊權限規則
      const specialRuleKey = `${query.resource}:${query.action}`;
      if (OfflinePermissionService.SPECIAL_PERMISSION_RULES[specialRuleKey]) {
        const isAllowed = OfflinePermissionService.SPECIAL_PERMISSION_RULES[specialRuleKey](
          userRole,
          userRoleLevel,
          context
        );
        
        if (!isAllowed) {
          return {
            granted: false,
            reason: '不符合特殊權限規則'
          };
        }
      }
      
      // 所有檢查都通過
      return { granted: true };
    } catch (error) {
      console.error('權限檢查失敗:', error);
      
      return {
        granted: false,
        reason: '權限檢查過程中發生錯誤'
      };
    }
  }

  /**
   * 檢查用戶角色是否至少為指定角色
   */
  async isRoleAtLeast(requiredRole: string): Promise<boolean> {
    try {
      // 獲取當前用戶
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        return false;
      }
      
      // 獲取用戶聲明
      const idTokenResult = await user.getIdTokenResult();
      const claims = idTokenResult.claims;
      
      const userRole = claims.role as string || 'customer';
      const userRoleLevel = OfflinePermissionService.ROLE_LEVELS[userRole] || RoleLevel.CUSTOMER;
      const requiredRoleLevel = OfflinePermissionService.ROLE_LEVELS[requiredRole];
      
      return userRoleLevel <= requiredRoleLevel;
    } catch (error) {
      console.error('角色檢查失敗:', error);
      return false;
    }
  }

  /**
   * 獲取當前用戶的角色
   */
  async getUserRole(): Promise<string> {
    try {
      // 獲取當前用戶
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        return 'anonymous';
      }
      
      // 獲取用戶聲明
      const idTokenResult = await user.getIdTokenResult();
      const claims = idTokenResult.claims;
      
      return claims.role as string || 'customer';
    } catch (error) {
      console.error('獲取用戶角色失敗:', error);
      return 'customer';
    }
  }

  /**
   * 獲取當前用戶的租戶ID
   */
  async getUserTenantId(): Promise<string | null> {
    try {
      // 獲取當前用戶
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        return null;
      }
      
      // 獲取用戶聲明
      const idTokenResult = await user.getIdTokenResult();
      const claims = idTokenResult.claims;
      
      return claims.tenantId as string || null;
    } catch (error) {
      console.error('獲取用戶租戶ID失敗:', error);
      return null;
    }
  }

  /**
   * 獲取當前用戶的店鋪ID
   */
  async getUserStoreId(): Promise<string | null> {
    try {
      // 獲取當前用戶
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        return null;
      }
      
      // 獲取用戶聲明
      const idTokenResult = await user.getIdTokenResult();
      const claims = idTokenResult.claims;
      
      return claims.storeId as string || null;
    } catch (error) {
      console.error('獲取用戶店鋪ID失敗:', error);
      return null;
    }
  }
}
