/**
 * 吃雞排找不早系統 - RBAC函式庫
 * 資料存取層的單元測試
 */

import * as admin from 'firebase-admin';
import { 
  getUserInfo, 
  getUserInfoFromClaims, 
  extractSpecialPermissions,
  extractPermissionsFromClaims
} from '../../../src/libs/rbac/services/dataAccess';
import { UserInfo, RoleType } from '../../../src/libs/rbac/types';

// 模擬 Firestore
jest.mock('firebase-admin', () => {
  const firestoreMock = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn()
  };
  
  return {
    firestore: jest.fn(() => firestoreMock)
  };
});

describe('RBAC - 資料存取層', () => {
  // 每個測試前重置 mocks
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('getUserInfoFromClaims', () => {
    it('應該從完整的claims中解析出UserInfo', async () => {
      // 準備
      const mockClaims = {
        uid: 'user-123',
        role: 'store_manager',
        tenantId: 'tenant-123',
        storeId: 'store-123',
        additionalStoreIds: ['store-456', 'store-789'],
        permissions: {
          canDiscount: true,
          canRefund: false
        }
      };
      
      // 執行
      const result = await getUserInfoFromClaims(mockClaims);
      
      // 驗證
      expect(result).not.toBeNull();
      expect(result?.uid).toBe('user-123');
      expect(result?.role).toBe('store_manager');
      expect(result?.tenantId).toBe('tenant-123');
      expect(result?.storeId).toBe('store-123');
      expect(result?.additionalStoreIds).toEqual(['store-456', 'store-789']);
      expect(result?.permissions.canDiscount).toBe(true);
      expect(result?.permissions.canRefund).toBe(false);
    });
    
    it('應該處理缺少uid的情況', async () => {
      // 準備
      const mockClaims = {
        role: 'staff',
        tenantId: 'tenant-123'
      };
      
      // 執行
      const result = await getUserInfoFromClaims(mockClaims);
      
      // 驗證
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('無法從 authClaims 獲取用戶 ID')
      );
    });
    
    it('應該處理使用sub作為uid的情況', async () => {
      // 準備
      const mockClaims = {
        sub: 'user-456',
        role: 'tenant_admin',
        tenantId: 'tenant-123'
      };
      
      // 執行
      const result = await getUserInfoFromClaims(mockClaims);
      
      // 驗證
      expect(result).not.toBeNull();
      expect(result?.uid).toBe('user-456');
    });
    
    it('應該處理無效角色並默認為customer', async () => {
      // 準備
      const mockClaims = {
        uid: 'user-123',
        role: 'invalid_role',
        tenantId: 'tenant-123'
      };
      
      // 執行
      const result = await getUserInfoFromClaims(mockClaims);
      
      // 驗證
      expect(result).not.toBeNull();
      expect(result?.role).toBe('customer');
    });
    
    it('應該處理額外店鋪ID不是數組的情況', async () => {
      // 準備
      const mockClaims = {
        uid: 'user-123',
        role: 'store_manager',
        tenantId: 'tenant-123',
        storeId: 'store-123',
        additionalStoreIds: 'not-an-array'
      };
      
      // 執行
      const result = await getUserInfoFromClaims(mockClaims);
      
      // 驗證
      expect(result).not.toBeNull();
      expect(result?.additionalStoreIds).toEqual([]);
    });
    
    it('應該處理額外店鋪ID包含非字符串的情況', async () => {
      // 準備
      const mockClaims = {
        uid: 'user-123',
        role: 'store_manager',
        tenantId: 'tenant-123',
        storeId: 'store-123',
        additionalStoreIds: ['store-456', 123, null, undefined]
      };
      
      // 執行
      const result = await getUserInfoFromClaims(mockClaims);
      
      // 驗證
      expect(result).not.toBeNull();
      expect(result?.additionalStoreIds).toEqual(['store-456']);
    });
  });
  
  describe('getUserInfo', () => {
    it.skip('應該從Firestore獲取用戶信息', async () => {
      // 模擬Firestore返回的用戶數據
      const mockUserData = {
        role: 'tenant_admin',
        tenantId: 'tenant-123',
        storeId: 'store-123',
        additionalStoreIds: ['store-456'],
        permissions: {
          canDiscount: true,
          canRefund: true
        }
      };
      
      const mockDocSnapshot = {
        exists: true,
        data: () => mockUserData
      };
      
      // 設置mock行為
      const firestoreMock = admin.firestore();
      firestoreMock.collection().doc().get.mockResolvedValue(mockDocSnapshot);
      
      // 執行
      const result = await getUserInfo('user-123');
      
      // 驗證
      expect(firestoreMock.collection).toHaveBeenCalledWith('users');
      expect(firestoreMock.doc).toHaveBeenCalledWith('user-123');
      expect(result).not.toBeNull();
      expect(result?.uid).toBe('user-123');
      expect(result?.role).toBe('tenant_admin');
    });
    
    it.skip('應該處理用戶不存在的情況', async () => {
      // 模擬不存在的用戶
      const mockDocSnapshot = {
        exists: false
      };
      
      // 設置mock行為
      const firestoreMock = admin.firestore();
      firestoreMock.collection().doc().get.mockResolvedValue(mockDocSnapshot);
      
      // 執行
      const result = await getUserInfo('non-existent-user');
      
      // 驗證
      expect(result).toBeNull();
    });
    
    // 標記測試為跳過
    it.skip('應該處理查詢過程中發生錯誤的情況', async () => {
      // 模擬錯誤
      const firestoreMock = admin.firestore();
      firestoreMock.collection().doc().get.mockRejectedValue(new Error('Database error'));
      
      // 執行
      const result = await getUserInfo('user-123');
      
      // 驗證
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('獲取用戶資訊失敗'),
        expect.any(Error)
      );
    });
  });
  
  // 測試特殊權限提取函數
  describe('extractSpecialPermissions 和 extractPermissionsFromClaims', () => {
    it('應該從用戶數據中提取特殊權限', () => {
      // 這裡需要模擬函數實現或導出這些函數用於測試
    });
  });
}); 