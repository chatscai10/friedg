/// <reference types="jest" />

/**
 * 吃雞排找不早系統 - RBAC函式庫
 * 單元測試
 */

// 模擬Firebase Admin SDK
jest.mock('firebase-admin', () => {
  // 根據不同情況回傳不同數據
  const mockGetFn = jest.fn().mockImplementation((path) => {
    // 我們假設會員呼叫時只會傳入 collection('').doc('')
    // 但在業務檢查時會傳入 collection('資源類型').doc('某ID')
    if (path) {
      // 這裡可以依據需要回傳不同內容
      return Promise.resolve({
        exists: true,
        data: () => ({
          tenantId: 'tenant-1',
          storeId: 'store-1'
        })
      });
    }

    // 預設回傳值 - 會影響權限測試
    return Promise.resolve({
      exists: true,
      data: () => ({
        tenantId: 'tenant-1',
        storeId: 'store-1'
      })
    });
  });

  const mockDoc = jest.fn().mockImplementation((id) => {
    return {
      get: mockGetFn.bind(null, id) 
    };
  });

  const mockCollection = jest.fn().mockImplementation((name) => {
    return {
      doc: mockDoc.bind(null, name)
    };
  });

  const mockFirestore = {
    collection: mockCollection
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  CallableContext,
  RoleType,
  RoleLevelMap
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

// 新增一個顧客用戶
const mockCustomerUser: UserInfo = {
  uid: 'customer-user-id',
  role: 'customer',
  roleLevel: RoleLevel.CUSTOMER
};

// 新增一個租戶管理員
const mockTenantAdminUser: UserInfo = {
  uid: 'tenant-admin-user-id',
  role: 'tenant_admin',
  roleLevel: RoleLevel.TENANT_ADMIN,
  tenantId: 'tenant-1'
};

// 新增一個班長用戶
const mockShiftLeaderUser: UserInfo = {
  uid: 'shift-leader-user-id',
  role: 'shift_leader',
  roleLevel: RoleLevel.SHIFT_LEADER,
  tenantId: 'tenant-1',
  storeId: 'store-1'
};

describe('RBAC 權限檢查', () => {
  // 重置模擬
  beforeEach(() => {
    jest.clearAllMocks();
    // 確保 admin 被使用，避免 TypeScript 錯誤
    // @ts-ignore - 忽略未使用變量警告
    const firestore = admin.firestore();
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

  // 新增的測試: 顧客只能查看自己的訂單
  test('顧客只能查看自己的訂單', async () => {
    const query: PermissionQuery = {
      action: 'read',
      resource: 'orders',
      resourceId: 'order-1'
    };

    // 測試顧客查看自己的訂單
    const ownOrderContext: PermissionContext = {
      additionalData: {
        customerId: 'customer-user-id' // 與顧客 uid 相同
      }
    };
    
    const resultOwn = await hasPermission(mockCustomerUser, query, ownOrderContext);
    expect(resultOwn.granted).toBe(true);
    
    // 測試顧客查看他人的訂單
    const otherOrderContext: PermissionContext = {
      additionalData: {
        customerId: 'other-customer-id' // 不同顧客
      }
    };
    
    const resultOther = await hasPermission(mockCustomerUser, query, otherOrderContext);
    expect(resultOther.granted).toBe(false);
  });

  // 新增的測試: 班長不能批准超額退款
  test('班長不能批准超額退款', async () => {
    const query: PermissionQuery = {
      action: 'refund',
      resource: 'orders'
    };
    
    // 測試班長處理小額退款 (500元以內)
    const smallAmountContext: PermissionContext = {
      tenantId: 'tenant-1',
      storeId: 'store-1',
      additionalData: {
        refundAmount: 500 // 剛好在限額內
      }
    };
    
    const resultSmall = await hasPermission(mockShiftLeaderUser, query, smallAmountContext);
    expect(resultSmall.granted).toBe(true);
    
    // 測試班長處理大額退款 (超過500元)
    const largeAmountContext: PermissionContext = {
      tenantId: 'tenant-1',
      storeId: 'store-1',
      additionalData: {
        refundAmount: 501 // 超過限額
      }
    };
    
    const resultLarge = await hasPermission(mockShiftLeaderUser, query, largeAmountContext);
    expect(resultLarge.granted).toBe(false);
  });

  // 新增的測試: 租戶管理員可以訪問所有租戶內的資源，但不能訪問跨租戶資源
  test('租戶管理員的租戶隔離測試', async () => {
    const query: PermissionQuery = {
      action: 'read',
      resource: 'stores'
    };
    
    // 測試訪問自己租戶內的資源
    const sametenantContext: PermissionContext = {
      tenantId: 'tenant-1',
      storeId: 'store-3' // 不同店鋪但同一租戶
    };
    
    const resultSameTenant = await hasPermission(mockTenantAdminUser, query, sametenantContext);
    expect(resultSameTenant.granted).toBe(true);
    
    // 測試訪問其他租戶的資源
    const otherTenantContext: PermissionContext = {
      tenantId: 'tenant-2', // 不同租戶
      storeId: 'store-4'
    };
    
    const resultOtherTenant = await hasPermission(mockTenantAdminUser, query, otherTenantContext);
    expect(resultOtherTenant.granted).toBe(false);
  });

  // 新增的測試: 測試訂單取消的特殊業務規則
  test('訂單取消的特殊業務規則測試', async () => {
    const query: PermissionQuery = {
      action: 'cancel',
      resource: 'orders'
    };
    
    // 顧客可以取消未確認的訂單
    const pendingOrderContext: PermissionContext = {
      additionalData: {
        customerId: 'customer-user-id',
        status: 'pending'
      }
    };
    
    const resultPending = await hasPermission(mockCustomerUser, query, pendingOrderContext);
    expect(resultPending.granted).toBe(true);
    
    // 顧客可以取消剛確認的訂單
    const confirmedOrderContext: PermissionContext = {
      additionalData: {
        customerId: 'customer-user-id',
        status: 'confirmed'
      }
    };
    
    const resultConfirmed = await hasPermission(mockCustomerUser, query, confirmedOrderContext);
    expect(resultConfirmed.granted).toBe(true);
    
    // 顧客不能取消準備中的訂單
    const preparingOrderContext: PermissionContext = {
      additionalData: {
        customerId: 'customer-user-id',
        status: 'preparing'
      }
    };
    
    const resultPreparing = await hasPermission(mockCustomerUser, query, preparingOrderContext);
    expect(resultPreparing.granted).toBe(false);
  });

  // 新增的測試: 測試店長的折扣權限
  test('店長折扣權限測試', async () => {
    const query: PermissionQuery = {
      action: 'discount',
      resource: 'orders'
    };
    
    // 店長可以給予30%以內的折扣
    const smallDiscountContext: PermissionContext = {
      tenantId: 'tenant-1',
      storeId: 'store-1',
      additionalData: {
        discountPercentage: 30 // 剛好在限額內
      }
    };
    
    const resultSmallDiscount = await hasPermission(mockManagerUser, query, smallDiscountContext);
    expect(resultSmallDiscount.granted).toBe(true);
    
    // 店長不能給予超過30%的折扣
    const largeDiscountContext: PermissionContext = {
      tenantId: 'tenant-1',
      storeId: 'store-1',
      additionalData: {
        discountPercentage: 31 // 超過限額
      }
    };
    
    const resultLargeDiscount = await hasPermission(mockManagerUser, query, largeDiscountContext);
    expect(resultLargeDiscount.granted).toBe(false);
    
    // 租戶管理員可以給予任意折扣
    const tenantAdminDiscountContext: PermissionContext = {
      tenantId: 'tenant-1',
      additionalData: {
        discountPercentage: 50 // 高折扣
      }
    };
    
    const resultTenantAdminDiscount = await hasPermission(mockTenantAdminUser, query, tenantAdminDiscountContext);
    expect(resultTenantAdminDiscount.granted).toBe(true);
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

  // 新增測試: 同等角色應該等於自己
  test('同等角色應該等於自己', () => {
    const result = isRoleAtLeast('staff', 'staff');
    expect(result).toBe(true);
  });

  // 新增測試: 班長應該高於一般員工
  test('班長應該高於一般員工', () => {
    const result = isRoleAtLeast('shift_leader', 'staff');
    expect(result).toBe(true);
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
  
  // 新增測試: 驗證帶有角色身份的用戶
  test('帶有正確權限的用戶請求應通過中間件', async () => {
    // 模擬 getUserInfoFromClaims 函數，因為測試環境無法連接 Firestore
    // @ts-ignore - 直接修改模組導出函數
    const originalGetUserInfoFromClaims = require('../services/dataAccess').getUserInfoFromClaims;
    // @ts-ignore
    require('../services/dataAccess').getUserInfoFromClaims = jest.fn().mockImplementation((claims) => {
      // 直接從 token 構建測試用戶信息
      return Promise.resolve({
        uid: claims.uid,
        role: claims.role,
        roleLevel: RoleLevelMap[claims.role as RoleType] || RoleLevel.CUSTOMER,
        tenantId: claims.tenantId,
        storeId: claims.storeId
      });
    });

    // 模擬一個帶有auth的context
    const context: CallableContext = {
      auth: {
        uid: 'test-user-id',
        token: {
          role: 'store_manager',
          tenantId: 'tenant-1',
          storeId: 'store-1'
        }
      }
    };
    
    const handler = jest.fn().mockResolvedValue({ success: true });
    const permissionCheck = jest.fn().mockResolvedValue(true);
    
    const wrappedFunction = withPermissionCheck(handler, permissionCheck);
    
    const result = await wrappedFunction({ data: 'test' }, context);
    expect(result).toEqual({ success: true });
    expect(handler).toHaveBeenCalled();
    expect(permissionCheck).toHaveBeenCalled();

    // 恢復原始函數
    // @ts-ignore
    require('../services/dataAccess').getUserInfoFromClaims = originalGetUserInfoFromClaims;
  });

  // 新增測試: 權限不足的用戶應被拒絕
  test('權限不足的用戶應被拒絕', async () => {
    // 模擬一個帶有auth的context但權限檢查失敗
    const context: CallableContext = {
      auth: {
        uid: 'test-user-id',
        token: {
          role: 'staff',
          tenantId: 'tenant-1',
          storeId: 'store-1'
        }
      }
    };
    
    const handler = jest.fn();
    const permissionCheck = jest.fn().mockResolvedValue(false);
    
    const wrappedFunction = withPermissionCheck(handler, permissionCheck);
    
    try {
      await wrappedFunction({ data: 'test' }, context);
      fail('應該拋出錯誤');
    } catch (error: any) {
      expect(error.code).toBe('permission-denied');
    }
    
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('getUserInfoFromClaims', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  // 模擬getUserInfo函數，用於測試
  const mockGetUserInfo = jest.fn();
  jest.mock('../services/dataAccess', () => ({
    ...jest.requireActual('../services/dataAccess'),
    getUserInfo: (uid: string) => mockGetUserInfo(uid)
  }));

  it('應該從有效的claims正確提取用戶信息', async () => {
    const mockClaims = {
      uid: 'test-user-123',
      role: 'store_manager',
      tenantId: 'tenant-123',
      storeId: 'store-123',
      additionalStoreIds: ['store-456', 'store-789'],
      permissions: {
        canDiscount: true,
        maxDiscountPercentage: 20
      }
    };

    const userInfo = await getUserInfoFromClaims(mockClaims);

    expect(userInfo).toEqual({
      uid: 'test-user-123',
      role: 'store_manager',
      roleLevel: RoleLevel.STORE_MANAGER,
      tenantId: 'tenant-123',
      storeId: 'store-123',
      additionalStoreIds: ['store-456', 'store-789'],
      permissions: {
        canDiscount: true,
        maxDiscountPercentage: 20
      }
    });
  });

  it('應該處理無效的角色並默認為customer', async () => {
    const mockClaims = {
      uid: 'test-user-123',
      role: 'invalid_role', // 無效角色
      tenantId: 'tenant-123'
    };

    const userInfo = await getUserInfoFromClaims(mockClaims);

    expect(userInfo?.role).toBe('customer');
    expect(userInfo?.roleLevel).toBe(RoleLevel.CUSTOMER);
  });

  it('應該安全處理非數組的additionalStoreIds', async () => {
    const mockClaims = {
      uid: 'test-user-123',
      role: 'store_manager',
      tenantId: 'tenant-123',
      storeId: 'store-123',
      additionalStoreIds: 'not-an-array' // 非數組
    };

    const userInfo = await getUserInfoFromClaims(mockClaims);

    expect(userInfo?.additionalStoreIds).toEqual([]);
  });

  it('應該從頂層claims提取權限', async () => {
    const mockClaims = {
      uid: 'test-user-123',
      role: 'staff',
      canDiscount: false,
      canRefund: true
    };

    const userInfo = await getUserInfoFromClaims(mockClaims);

    expect(userInfo?.permissions).toEqual({
      canDiscount: false,
      canRefund: true
    });
  });

  it('應該在解析錯誤時從數據庫獲取用戶信息', async () => {
    const mockDbUser = {
      uid: 'test-user-123',
      role: 'staff',
      roleLevel: RoleLevel.STAFF,
      tenantId: 'tenant-123'
    };
    mockGetUserInfo.mockResolvedValue(mockDbUser);

    // 會造成解析錯誤的claims
    const badClaims = {
      uid: 'test-user-123',
      role: {}, // 不是字符串類型,會導致錯誤
    };

    const userInfo = await getUserInfoFromClaims(badClaims);

    expect(mockGetUserInfo).toHaveBeenCalledWith('test-user-123');
    expect(userInfo).toEqual(mockDbUser);
  });
});

// 測試validateRoleType函數
describe('validateRoleType', () => {
  it('應該正確驗證有效的角色類型', () => {
    // 測試直接導出validateRoleType可能有困難
    // 我們可以通過getUserInfoFromClaims間接測試
    const validRoles = [
      'super_admin', 'tenant_admin', 'store_manager',
      'shift_leader', 'senior_staff', 'staff', 'trainee', 'customer'
    ];

    validRoles.forEach(async (role) => {
      const mockClaims = { uid: 'test-user', role };
      const userInfo = await getUserInfoFromClaims(mockClaims);
      expect(userInfo?.role).toBe(role);
    });
  });

  it('應該拒絕無效的角色類型', async () => {
    const invalidRoles = [
      'unknown_role', 'admin', 'user', 123, {}, [], null, undefined
    ];

    for (const role of invalidRoles) {
      const mockClaims = { uid: 'test-user', role };
      const userInfo = await getUserInfoFromClaims(mockClaims);
      expect(userInfo?.role).toBe('customer'); // 默認為customer
    }
  });
}); 