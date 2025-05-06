/// <reference types="jest" />

/**
 * 吃雞排找不早系統 - RBAC函式庫
 * 單元測試
 */

// 模擬Firebase Admin SDK
jest.mock('firebase-admin', () => {
  const mockFirestore = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn()
  };
  
  return {
    firestore: jest.fn(() => mockFirestore),
    credential: {
      applicationDefault: jest.fn()
    },
    initializeApp: jest.fn()
  };
});

// 模擬函數
jest.mock('firebase-functions', () => {
  return {
    https: {
      HttpsError: jest.fn((code, message) => ({ code, message }))
    }
  };
});

import * as admin from 'firebase-admin';
import { 
  hasPermission, 
  isRoleAtLeast, 
  getMinimumRoleForAction,
  withPermissionCheck
} from '../index';
import { 
  UserInfo, 
  RoleLevel, 
  PermissionQuery, 
  PermissionContext,
  CallableContext
} from '../types';

// 模擬用戶資料
const mockStaffUser: UserInfo = {
  uid: 'staff-user-id',
  role: 'staff',
  roleLevel: RoleLevel.STAFF,
  tenantId: 'tenant-1',
  storeId: 'store-1'
};

const mockManagerUser: UserInfo = {
  uid: 'manager-user-id',
  role: 'store_manager',
  roleLevel: RoleLevel.STORE_MANAGER,
  tenantId: 'tenant-1',
  storeId: 'store-1'
};

const mockAdminUser: UserInfo = {
  uid: 'admin-user-id',
  role: 'super_admin',
  roleLevel: RoleLevel.SUPER_ADMIN
};

describe('RBAC 權限檢查', () => {
  // 重置模擬
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 模擬 Firestore get 方法的返回值
    const mockFirestore = admin.firestore();
    mockFirestore.collection('').doc('').get.mockResolvedValue({
      exists: true,
      data: () => ({
        tenantId: 'tenant-1',
        storeId: 'store-1'
      })
    });
  });

  test('一般員工應該能讀取訂單', async () => {
    const query: PermissionQuery = {
      action: 'read',
      resource: 'orders'
    };
    
    const context: PermissionContext = {
      tenantId: 'tenant-1',
      storeId: 'store-1'
    };
    
    const result = await hasPermission(mockStaffUser, query, context);
    expect(result.granted).toBe(true);
  });
  
  test('一般員工不應該能退款訂單', async () => {
    const query: PermissionQuery = {
      action: 'refund',
      resource: 'orders'
    };
    
    const context: PermissionContext = {
      tenantId: 'tenant-1',
      storeId: 'store-1'
    };
    
    const result = await hasPermission(mockStaffUser, query, context);
    expect(result.granted).toBe(false);
  });
  
  test('店長應該能退款訂單', async () => {
    const query: PermissionQuery = {
      action: 'refund',
      resource: 'orders'
    };
    
    const context: PermissionContext = {
      tenantId: 'tenant-1',
      storeId: 'store-1',
      additionalData: {
        refundAmount: 500
      }
    };
    
    const result = await hasPermission(mockManagerUser, query, context);
    expect(result.granted).toBe(true);
  });
  
  test('店長不能訪問其他店鋪的資源', async () => {
    const query: PermissionQuery = {
      action: 'read',
      resource: 'orders'
    };
    
    const context: PermissionContext = {
      tenantId: 'tenant-1',
      storeId: 'store-2' // 不同店鋪
    };
    
    const result = await hasPermission(mockManagerUser, query, context);
    expect(result.granted).toBe(false);
  });
  
  test('超級管理員可以訪問任何資源', async () => {
    const query: PermissionQuery = {
      action: 'delete',
      resource: 'orders'
    };
    
    const context: PermissionContext = {
      tenantId: 'tenant-2',
      storeId: 'store-3'
    };
    
    const result = await hasPermission(mockAdminUser, query, context);
    expect(result.granted).toBe(true);
  });
});

describe('角色等級檢查', () => {
  test('超級管理員角色等級應高於店長', () => {
    const result = isRoleAtLeast('super_admin', 'store_manager');
    expect(result).toBe(true);
  });
  
  test('一般員工角色等級應低於店長', () => {
    const result = isRoleAtLeast('staff', 'store_manager');
    expect(result).toBe(false);
  });
  
  test('應能正確獲取操作所需的最低角色', () => {
    const role = getMinimumRoleForAction('orders', 'refund');
    expect(['super_admin', 'tenant_admin', 'store_manager', 'shift_leader'].includes(role as any)).toBe(true);
  });
});

describe('Firebase Functions 權限中間件', () => {
  test('未登入用戶應被拒絕', async () => {
    const context: CallableContext = {}; // 無auth
    
    const handler = jest.fn();
    const permissionCheck = jest.fn();
    
    const wrappedFunction = withPermissionCheck(handler, permissionCheck);
    
    try {
      await wrappedFunction({}, context);
      fail('應該拋出錯誤');
    } catch (error: any) {
      expect(error.code).toBe('unauthenticated');
    }
    
    expect(handler).not.toHaveBeenCalled();
  });
  
  // 更多權限中間件的測試...
}); 