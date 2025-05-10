/**
 * 吃雞排找不早系統 - RBAC函式庫
 * 資料存取層的單元測試
 */

import * as admin from 'firebase-admin';
import { 
  getUserInfo, 
  getUserInfoFromClaims 
} from '../../../src/libs/rbac/services/dataAccess';
import { UserInfo, RoleType } from '../../../src/libs/rbac/types';

// 模擬 Firestore
const mockGet = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockFirestore = jest.fn();

jest.mock('firebase-admin', () => ({
  firestore: () => ({
    collection: mockCollection
  })
}));

describe('RBAC - 資料存取層', () => {
  // 每個測試前重置 mocks 和 spy
  beforeEach(() => {
    jest.resetAllMocks();
    
    // 設置模擬的行為
    mockDoc.mockReturnValue({ get: mockGet });
    mockCollection.mockReturnValue({ doc: mockDoc });
    
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('getUserInfo', () => {
    it('應該從Firestore獲取用戶信息', async () => {
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
      
      // 設置 mockGet 以返回數據
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => mockUserData
      });
      
      // 執行測試
      const result = await getUserInfo('user-123');
      
      // 驗證
      expect(mockCollection).toHaveBeenCalledWith('users');
      expect(mockDoc).toHaveBeenCalledWith('user-123');
      expect(mockGet).toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result?.uid).toBe('user-123');
      expect(result?.role).toBe('tenant_admin');
    });
    
    it('應該處理用戶不存在的情況', async () => {
      // 設置 mockGet - 文檔不存在
      mockGet.mockResolvedValueOnce({
        exists: false
      });
      
      // 執行
      const result = await getUserInfo('non-existent-user');
      
      // 驗證
      expect(result).toBeNull();
    });
    
    it('應該處理查詢過程中發生錯誤的情況', async () => {
      // 使用獨特的 ID 避免緩存問題
      const errorUserId = 'error-user-' + Date.now();
      
      // 設置 mockGet - 拋出錯誤
      mockGet.mockRejectedValueOnce(new Error('Database error'));
      
      // 執行
      const result = await getUserInfo(errorUserId);
      
      // 驗證
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('獲取用戶資訊失敗'),
        expect.any(Error)
      );
    });
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
      // 使用可選鏈避免類型錯誤
      expect(result?.permissions?.canDiscount).toBe(true);
      expect(result?.permissions?.canRefund).toBe(false);
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
  
  // 測試特殊權限提取函數
  describe('extractSpecialPermissions 和 extractPermissionsFromClaims', () => {
    it('應該從用戶數據中提取特殊權限', () => {
      // 這裡需要模擬函數實現或導出這些函數用於測試
    });
  });
}); 