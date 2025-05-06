/**
 * 吃雞排找不早系統 - RBAC函式庫
 * 常量定義文件
 */

import { RoleType, ResourceType, ActionType, RoleLevel } from './types';

// 擴展角色權限映射類型，包含'roles'屬性
interface RolePermissionMapType extends Partial<Record<ResourceType, ActionType[]>> {
  'roles'?: ActionType[];
}

/**
 * 角色權限映射：定義各角色在各資源上的預設操作權限
 * 此映射是靜態定義的基礎權限，實際權限檢查還會考慮租戶/店鋪隔離等因素
 */
export const ROLE_PERMISSIONS_MAP: Record<RoleType, RolePermissionMapType> = {
  // 超級管理員：系統最高權限，可管理所有資源
  'super_admin': {
    'tenants': ['create', 'read', 'update', 'delete'],
    'stores': ['create', 'read', 'update', 'delete'],
    'users': ['create', 'read', 'update', 'delete'],
    'employees': ['create', 'read', 'update', 'delete', 'approve'],
    'roles': ['create', 'read', 'update', 'delete'],
    'menuItems': ['create', 'read', 'update', 'delete'],
    'menuCategories': ['create', 'read', 'update', 'delete'],
    'menuOptions': ['create', 'read', 'update', 'delete'],
    'orders': ['create', 'read', 'update', 'delete', 'cancel', 'complete', 'print', 'discount', 'refund'],
    'orderItems': ['create', 'read', 'update', 'delete'],
    'inventoryItems': ['create', 'read', 'update', 'delete'],
    'inventoryCounts': ['create', 'read', 'update', 'delete', 'approve'],
    'inventoryOrders': ['create', 'read', 'update', 'delete', 'approve'],
    'schedules': ['create', 'read', 'update', 'delete', 'approve'],
    'attendances': ['create', 'read', 'update', 'delete', 'approve'],
    'leaves': ['create', 'read', 'update', 'delete', 'approve', 'reject'],
    'payrolls': ['create', 'read', 'update', 'delete', 'approve', 'export'],
    'bonusTasks': ['create', 'read', 'update', 'delete'],
    'bonusRecords': ['create', 'read', 'update', 'delete', 'approve'],
    'ratings': ['read', 'delete'],
    'announcements': ['create', 'read', 'update', 'delete'],
    'knowledgeBase': ['create', 'read', 'update', 'delete'],
    'votes': ['create', 'read', 'update', 'delete'],
    'auditLogs': ['read', 'export'],
    'systemConfigs': ['read', 'update'],
    'adSlots': ['create', 'read', 'update', 'delete'],
    'adContents': ['create', 'read', 'update', 'delete'],
    'referralCodes': ['create', 'read', 'update', 'delete'],
    'referralUsages': ['read', 'export'],
    'pickupNumbers': ['read', 'update']
  },

  // 租戶管理員：租戶內最高權限，可管理租戶下的所有資源
  'tenant_admin': {
    'tenants': ['read', 'update'], // 只能讀取和更新自己的租戶
    'stores': ['create', 'read', 'update', 'delete'], // 可以管理自己租戶的所有分店
    'users': ['create', 'read', 'update', 'delete'], // 租戶內的用戶
    'employees': ['create', 'read', 'update', 'delete', 'approve'],
    'roles': ['create', 'read', 'update', 'delete'], // 只能管理級別比自己低的角色
    'menuItems': ['create', 'read', 'update', 'delete'],
    'menuCategories': ['create', 'read', 'update', 'delete'],
    'menuOptions': ['create', 'read', 'update', 'delete'],
    'orders': ['create', 'read', 'update', 'cancel', 'complete', 'print', 'discount', 'refund'],
    'orderItems': ['create', 'read', 'update', 'delete'],
    'inventoryItems': ['create', 'read', 'update', 'delete'],
    'inventoryCounts': ['create', 'read', 'update', 'delete', 'approve'],
    'inventoryOrders': ['create', 'read', 'update', 'delete', 'approve'],
    'schedules': ['create', 'read', 'update', 'delete', 'approve'],
    'attendances': ['create', 'read', 'update', 'delete', 'approve'],
    'leaves': ['create', 'read', 'update', 'delete', 'approve', 'reject'],
    'payrolls': ['create', 'read', 'update', 'approve', 'export'],
    'bonusTasks': ['create', 'read', 'update', 'delete'],
    'bonusRecords': ['create', 'read', 'update', 'approve'],
    'ratings': ['read'],
    'announcements': ['create', 'read', 'update', 'delete'],
    'knowledgeBase': ['create', 'read', 'update', 'delete'],
    'votes': ['create', 'read', 'update', 'delete'],
    'auditLogs': ['read', 'export'], // 只能讀取自己租戶的日誌
    'adSlots': ['read', 'update'], // 只能管理自己租戶的廣告欄位
    'adContents': ['create', 'read', 'update', 'delete'], // 自己租戶的廣告內容
    'referralCodes': ['create', 'read', 'update'],
    'referralUsages': ['read', 'export'],
    'pickupNumbers': ['read', 'update']
  },

  // 店長：分店最高權限，可管理本店的員工與營運
  'store_manager': {
    'stores': ['read', 'update'], // 只能讀取和更新自己的店
    'users': ['read'], // 只能讀取不能修改用戶基本資料
    'employees': ['create', 'read', 'update'], // 可以管理自己店的員工，但不能刪除
    'menuItems': ['read', 'update'], // 可以調整菜單
    'menuCategories': ['read', 'update'],
    'menuOptions': ['read', 'update'],
    'orders': ['create', 'read', 'update', 'cancel', 'complete', 'print', 'discount', 'refund'],
    'orderItems': ['create', 'read', 'update'],
    'inventoryItems': ['create', 'read', 'update'],
    'inventoryCounts': ['create', 'read', 'update', 'approve'],
    'inventoryOrders': ['create', 'read', 'update', 'approve'],
    'schedules': ['create', 'read', 'update', 'approve'],
    'attendances': ['create', 'read', 'update', 'approve'],
    'leaves': ['read', 'update', 'approve', 'reject'],
    'payrolls': ['read', 'approve'], // 只能審核不能創建
    'bonusTasks': ['read'],
    'bonusRecords': ['create', 'read', 'update', 'approve'],
    'ratings': ['read'],
    'announcements': ['create', 'read', 'update', 'delete'], // 本店公告
    'knowledgeBase': ['read'],
    'votes': ['create', 'read', 'update'], // 本店投票
    'pickupNumbers': ['read', 'update']
  },

  // 班長：班次負責人，可暫時調整排班、處理訂單與退款
  'shift_leader': {
    'employees': ['read'], // 只能讀取不能修改員工資料
    'menuItems': ['read'], 
    'menuCategories': ['read'],
    'menuOptions': ['read'],
    'orders': ['create', 'read', 'update', 'cancel', 'complete', 'print', 'discount', 'refund'], // 有限額的退款權限
    'orderItems': ['create', 'read', 'update'],
    'inventoryItems': ['read', 'update'],
    'inventoryCounts': ['create', 'read', 'update'],
    'inventoryOrders': ['create', 'read', 'update'],
    'schedules': ['read', 'update'], // 暫時調整當前班次排班
    'attendances': ['create', 'read', 'update'], // 審核員工打卡異常
    'leaves': ['read'],
    'ratings': ['read'],
    'announcements': ['create', 'read'], // 臨時店內公告
    'knowledgeBase': ['read'],
    'votes': ['read'],
    'pickupNumbers': ['read', 'update']
  },

  // 資深員工：有較多權限的一般員工
  'senior_staff': {
    'menuItems': ['read'],
    'menuCategories': ['read'],
    'menuOptions': ['read'],
    'orders': ['create', 'read', 'update', 'complete', 'print', 'discount'], // 小額折扣權限
    'orderItems': ['create', 'read', 'update'],
    'inventoryItems': ['read'],
    'inventoryCounts': ['create', 'read'],
    'inventoryOrders': ['create', 'read'],
    'schedules': ['read'], // 只能查看自己的排班
    'attendances': ['create', 'read'], // 打卡
    'leaves': ['create', 'read', 'update'], // 請假申請
    'ratings': ['read'],
    'announcements': ['read'],
    'knowledgeBase': ['read'],
    'votes': ['read'],
    'pickupNumbers': ['read', 'update']
  },

  // 一般員工：基本點餐、打卡、庫存操作
  'staff': {
    'menuItems': ['read'],
    'menuCategories': ['read'],
    'menuOptions': ['read'],
    'orders': ['create', 'read', 'update', 'complete', 'print'], // 不能折扣或取消
    'orderItems': ['create', 'read', 'update'],
    'inventoryItems': ['read'],
    'inventoryCounts': ['create', 'read'],
    'schedules': ['read'], // 只能查看自己的排班
    'attendances': ['create', 'read'], // 打卡
    'leaves': ['create', 'read', 'update'], // 請假申請
    'announcements': ['read'],
    'knowledgeBase': ['read'],
    'votes': ['read'],
    'pickupNumbers': ['read', 'update']
  },

  // 實習員工：有限的系統功能，需監督
  'trainee': {
    'menuItems': ['read'],
    'menuCategories': ['read'],
    'menuOptions': ['read'],
    'orders': ['read'], // 只能查看不能完成
    'orderItems': ['read'],
    'schedules': ['read'], // 只能查看自己的排班
    'attendances': ['create', 'read'], // 打卡
    'leaves': ['create', 'read'], // 請假申請
    'announcements': ['read'],
    'knowledgeBase': ['read'],
    'pickupNumbers': ['read']
  },

  // 顧客：僅可使用線上點餐相關功能
  'customer': {
    'menuItems': ['read'],
    'menuCategories': ['read'],
    'menuOptions': ['read'],
    'orders': ['create', 'read', 'cancel'], // 只能取消未確認的訂單
    'orderItems': ['create', 'read'],
    'ratings': ['create', 'read', 'update', 'delete'], // 自己的評價
    'announcements': ['read'], // 公開公告
    'referralCodes': ['read'] // 推薦碼
  }
};

/**
 * 資源所屬權限檢查映射：定義資源是否需要檢查所有權
 * 用於判斷是否允許用戶操作自己的資源（如員工查看自己的排班）
 */
export const RESOURCE_OWNERSHIP_CHECKS: Partial<Record<ResourceType, string[]>> = {
  'users': ['uid'], // 用戶ID欄位
  'employees': ['uid', 'employeeId'], // 員工ID欄位
  'orders': ['customerId'], // 訂單客戶ID欄位
  'schedules': ['employeeId'], // 排班員工ID欄位
  'attendances': ['employeeId', 'uid'], // 出勤員工ID欄位
  'leaves': ['employeeId'], // 請假員工ID欄位
  'ratings': ['customerId'], // 評價客戶ID欄位
  'payrolls': ['employeeId'], // 薪資員工ID欄位
  'bonusRecords': ['employeeId'], // 獎金員工ID欄位
  'votes': ['uid'], // 投票用戶ID欄位
  'referralCodes': ['uid'], // 推薦碼用戶ID欄位
  'referralUsages': ['referrerId'], // 推薦碼使用紀錄推薦人ID欄位
  'tenants': [],
  'stores': [],
  'menuItems': [],
  'menuCategories': [],
  'menuOptions': [],
  'orderItems': [],
  'inventoryItems': [],
  'inventoryCounts': [],
  'inventoryOrders': [],
  'bonusTasks': [],
  'announcements': [],
  'knowledgeBase': [],
  'auditLogs': [],
  'systemConfigs': [],
  'adSlots': [],
  'adContents': [],
  'pickupNumbers': []
};

/**
 * 資源存取範圍限制
 * 定義各角色對資源的存取範圍
 */
export const RESOURCE_ACCESS_SCOPE = {
  // 超級管理員：可存取所有資源
  'super_admin': {
    scope: 'all',
    restrictions: []
  },
  
  // 租戶管理員：僅限自己租戶的資源
  'tenant_admin': {
    scope: 'tenant',
    restrictions: [{
      field: 'tenantId',
      operator: 'eq',
      source: 'user.tenantId'
    }]
  },
  
  // 店長：僅限自己店鋪的資源
  'store_manager': {
    scope: 'store',
    restrictions: [
      {
        field: 'tenantId',
        operator: 'eq',
        source: 'user.tenantId'
      },
      {
        field: 'storeId',
        operator: 'eq',
        source: 'user.storeId'
      }
    ]
  },
  
  // 班長：僅限自己店鋪的資源
  'shift_leader': {
    scope: 'store',
    restrictions: [
      {
        field: 'tenantId',
        operator: 'eq',
        source: 'user.tenantId'
      },
      {
        field: 'storeId',
        operator: 'eq',
        source: 'user.storeId'
      }
    ]
  },
  
  // 資深員工：僅限自己店鋪的資源
  'senior_staff': {
    scope: 'store',
    restrictions: [
      {
        field: 'tenantId',
        operator: 'eq',
        source: 'user.tenantId'
      },
      {
        field: 'storeId',
        operator: 'eq',
        source: 'user.storeId'
      }
    ]
  },
  
  // 一般員工：僅限自己店鋪的資源
  'staff': {
    scope: 'store',
    restrictions: [
      {
        field: 'tenantId',
        operator: 'eq',
        source: 'user.tenantId'
      },
      {
        field: 'storeId',
        operator: 'eq',
        source: 'user.storeId'
      }
    ]
  },
  
  // 實習員工：僅限自己店鋪的資源
  'trainee': {
    scope: 'store',
    restrictions: [
      {
        field: 'tenantId',
        operator: 'eq',
        source: 'user.tenantId'
      },
      {
        field: 'storeId',
        operator: 'eq',
        source: 'user.storeId'
      }
    ]
  },
  
  // 顧客：僅限自己的資源
  'customer': {
    scope: 'own',
    restrictions: [
      {
        field: 'customerId',
        operator: 'eq',
        source: 'user.uid'
      }
    ]
  }
};

/**
 * 特殊業務規則定義
 * 定義需要特殊處理的業務邏輯權限規則
 */
export const SPECIAL_BUSINESS_RULES = [
  // 訂單取消權限規則
  {
    resource: 'orders',
    action: 'cancel',
    rule: (user: any, resource: any) => {
      // 顧客只能取消未確認或剛確認的訂單
      if (user.role === 'customer') {
        return ['pending', 'confirmed'].includes(resource.status);
      }
      
      // 資深員工以下不能取消已確認的訂單
      if (user.roleLevel >= RoleLevel.SENIOR_STAFF) {
        return resource.status === 'pending';
      }
      
      // 店長可以取消任何狀態的訂單
      if (user.roleLevel <= RoleLevel.STORE_MANAGER) {
        return true;
      }
      
      return false;
    }
  },
  
  // 折扣權限規則
  {
    resource: 'orders',
    action: 'discount',
    rule: (user: any, resource: any, context: any) => {
      const requestedDiscount = context?.additionalData?.discountPercentage || 0;
      
      // 資深員工折扣限制
      if (user.role === 'senior_staff') {
        return requestedDiscount <= 10; // 最高10%折扣
      }
      
      // 班長折扣限制
      if (user.role === 'shift_leader') {
        return requestedDiscount <= 20; // 最高20%折扣
      }
      
      // 店長折扣限制
      if (user.role === 'store_manager') {
        return requestedDiscount <= 30; // 最高30%折扣
      }
      
      // 租戶管理員以上無折扣限制
      if (user.roleLevel <= RoleLevel.TENANT_ADMIN) {
        return true;
      }
      
      return false;
    }
  },
  
  // 退款權限規則
  {
    resource: 'orders',
    action: 'refund',
    rule: (user: any, resource: any, context: any) => {
      const refundAmount = context?.additionalData?.refundAmount || 0;
      
      // 班長退款限制
      if (user.role === 'shift_leader') {
        return refundAmount <= 500; // 最高500元退款
      }
      
      // 店長退款限制
      if (user.role === 'store_manager') {
        return refundAmount <= 2000; // 最高2000元退款
      }
      
      // 租戶管理員以上無退款限制
      if (user.roleLevel <= RoleLevel.TENANT_ADMIN) {
        return true;
      }
      
      return false;
    }
  }
];

/**
 * 緩存配置
 */
export const CACHE_CONFIG = {
  // 用戶資訊緩存時間 (毫秒)
  USER_INFO_TTL: 5 * 60 * 1000, // 5分鐘
  
  // 權限檢查結果緩存時間 (毫秒)
  PERMISSION_CHECK_TTL: 1 * 60 * 1000, // 1分鐘
  
  // 資源資訊緩存時間 (毫秒)
  RESOURCE_INFO_TTL: 2 * 60 * 1000, // 2分鐘
  
  // 最大緩存數量
  MAX_CACHE_SIZE: 1000
}; 