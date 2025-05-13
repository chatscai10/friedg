import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Restaurant as RestaurantIcon,
  ShoppingCart as ShoppingCartIcon,
  Inventory as InventoryIcon,
  Schedule as ScheduleIcon,
  AccessTime as AccessTimeIcon,
  BarChart as BarChartIcon,
  AccountBalance as AccountBalanceIcon,
  Assessment as AssessmentIcon,
  CardGiftcard as CardGiftcardIcon,
  Stars as StarsIcon,
  Redeem as RedeemIcon,
  LocalOffer as LocalOfferIcon,
} from '@mui/icons-material';

import { SvgIconComponent } from '@mui/material';

/**
 * 菜單項配置接口
 */
export interface MenuItem {
  path: string;                      // 路由路徑
  title: string;                     // 顯示標題
  icon: SvgIconComponent;            // MUI 圖標組件
  allowedRoles?: string[];           // 允許訪問的角色列表（可選）
  requiredPermissions?: string[];    // 需要的權限列表（可選）
  disabled?: boolean;                // 是否禁用菜單項
  disabledHint?: string;             // 禁用時的提示信息
  children?: MenuItem[];             // 子菜單項
}

/**
 * 菜單配置
 */
export const menuConfig: MenuItem[] = [
  // 儀表板 (所有登入用戶都能看到)
  {
    path: '/',
    title: '儀表板',
    icon: DashboardIcon,
  },
  
  // 用戶管理 (只有管理員可以看到)
  {
    path: '/users',
    title: '用戶管理',
    icon: PeopleIcon,
    allowedRoles: ['admin', 'super_admin', 'tenant_admin'],
  },
  
  // 角色管理 (只有管理員可以看到)
  {
    path: '/roles',
    title: '角色管理',
    icon: PeopleIcon,
    allowedRoles: ['admin', 'super_admin', 'tenant_admin'],
  },
  
  // 員工管理 (只有管理員可以看到)
  {
    path: '/employees',
    title: '員工管理',
    icon: PersonIcon,
    allowedRoles: ['admin', 'super_admin', 'tenant_admin'],
  },
  
  // 分店管理 (管理員和店長可以看到)
  {
    path: '/stores',
    title: '分店管理',
    icon: BusinessIcon,
    allowedRoles: ['admin', 'super_admin', 'tenant_admin', 'store_manager'],
  },
  
  // 菜單管理 (管理員和店長可以看到，需要menu:read權限)
  {
    path: '/menu',
    title: '菜單管理',
    icon: RestaurantIcon,
    allowedRoles: ['admin', 'super_admin', 'tenant_admin', 'store_manager'],
    requiredPermissions: ['menu:read'],
  },
  
  // 訂單管理 (所有登入用戶都能看到，需要orders:read權限)
  {
    path: '/orders',
    title: '訂單管理',
    icon: ShoppingCartIcon,
    requiredPermissions: ['orders:read'],
  },
  
  // 庫存管理 (所有登入用戶都能看到，但目前禁用)
  {
    path: '/inventory',
    title: '庫存管理',
    icon: InventoryIcon,
    disabled: true,
    disabledHint: '庫存管理功能正在開發中，敬請期待！',
  },
  
  // 排班管理 (所有登入用戶都能看到，但目前禁用)
  {
    path: '/schedules',
    title: '排班管理',
    icon: ScheduleIcon,
    disabled: true,
    disabledHint: '排班管理功能正在開發中，敬請期待！',
  },
  
  // 考勤管理 (所有登入用戶都能看到，需要attendance:read權限)
  {
    path: '/attendance',
    title: '考勤管理',
    icon: AccessTimeIcon,
    requiredPermissions: ['attendance:read'],
  },
  
  // 報表管理 (所有登入用戶都能看到，但目前禁用)
  {
    path: '/reports',
    title: '報表管理',
    icon: BarChartIcon,
    disabled: true,
    disabledHint: '報表管理功能正在開發中，敬請期待！',
  },
  
  // 員工專屬模塊 (只有員工角色可見)
  {
    path: '/employee',
    title: '員工專區',
    icon: PersonIcon,
    allowedRoles: ['staff'],
    children: [
      {
        path: '/employee/equity/my-holdings',
        title: '我的股權',
        icon: AccountBalanceIcon,
      },
      {
        path: '/employee/equity/my-installments',
        title: '分期付款計劃',
        icon: AssessmentIcon,
      }
    ]
  },
  
  // 會員忠誠度系統 (只有管理員可見)
  {
    path: '/admin/loyalty',
    title: '會員忠誠度系統',
    icon: CardGiftcardIcon,
    allowedRoles: ['admin', 'super_admin', 'tenant_admin'],
    children: [
      {
        path: '/admin/loyalty/tier-rules',
        title: '會員等級規則',
        icon: StarsIcon,
      },
      {
        path: '/admin/loyalty/rewards',
        title: '忠誠度獎勵',
        icon: RedeemIcon,
      },
      {
        path: '/admin/coupons/templates',
        title: '優惠券模板',
        icon: LocalOfferIcon,
      }
    ]
  }
];

/**
 * 獲取有權限看到的菜單項
 * @param hasRoleFunction 檢查用戶是否擁有特定角色的方法
 * @param hasPermissionFunction 檢查用戶是否擁有特定權限的方法
 * @returns 過濾後的菜單項列表
 */
export const getAuthorizedMenuItems = (
  hasRoleFunction: (role: string) => boolean,
  hasPermissionFunction: (permission: string) => boolean
): MenuItem[] => {
  return menuConfig.filter(menuItem => {
    // 檢查角色權限
    if (menuItem.allowedRoles && menuItem.allowedRoles.length > 0) {
      if (!menuItem.allowedRoles.some(role => hasRoleFunction(role))) {
        return false;
      }
    }
    
    // 檢查權限要求
    if (menuItem.requiredPermissions && menuItem.requiredPermissions.length > 0) {
      if (!menuItem.requiredPermissions.every(permission => hasPermissionFunction(permission))) {
        return false;
      }
    }
    
    // 如果有子菜單，遞歸過濾子菜單
    if (menuItem.children && menuItem.children.length > 0) {
      menuItem.children = menuItem.children.filter(childItem => {
        // 檢查角色權限
        if (childItem.allowedRoles && childItem.allowedRoles.length > 0) {
          if (!childItem.allowedRoles.some(role => hasRoleFunction(role))) {
            return false;
          }
        }
        
        // 檢查權限要求
        if (childItem.requiredPermissions && childItem.requiredPermissions.length > 0) {
          if (!childItem.requiredPermissions.every(permission => hasPermissionFunction(permission))) {
            return false;
          }
        }
        
        return true;
      });
    }
    
    return true;
  });
}; 