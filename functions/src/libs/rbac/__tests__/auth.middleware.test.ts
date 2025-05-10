/**
 * 吃雞排找不早系統 - RBAC函式庫
 * 身份驗證中間件的單元測試
 */

import * as functions from 'firebase-functions';
import { 
  withAuthentication, 
  withTenantIsolation, 
  withStoreIsolation,
  withRole,
  withMockAuthentication
} from '../../../middleware/auth.middleware';
import { CallableContext, UserInfo } from '../types';

// 模擬 getUserInfoFromClaims
jest.mock('../', () => ({
  getUserInfoFromClaims: jest.fn()
}));
import { getUserInfoFromClaims } from '../';

describe('RBAC - 身份驗證中間件', () => {
  // 每個測試前重置 mocks
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  // 準備一些測試數據
  const mockUserInfo: UserInfo = {
    uid: 'test-user-123',
    role: 'tenant_admin',
    roleLevel: 2,
    tenantId: 'tenant-123',
    storeId: 'store-123'
  };
  
  const mockContext: CallableContext = {
    auth: {
      uid: 'test-user-123',
      token: {
        role: 'tenant_admin',
        tenantId: 'tenant-123'
      }
    }
  };
  
  describe('withAuthentication', () => {
    it('應該拒絕未登入的用戶', async () => {
      // 模擬未認證的請求
      const unauthenticatedContext: CallableContext = { auth: null };
      
      // 創建增強函數
      const handler = jest.fn();
      const enhancedHandler = withAuthentication(handler);
      
      // 執行測試
      await expect(enhancedHandler({}, unauthenticatedContext))
        .rejects.toThrow('需要登入才能執行此操作');
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('應該拒絕無法獲取權限資訊的用戶', async () => {
      // 模擬 getUserInfoFromClaims 返回 null
      (getUserInfoFromClaims as jest.Mock).mockResolvedValue(null);
      
      // 創建增強函數
      const handler = jest.fn();
      const enhancedHandler = withAuthentication(handler);
      
      // 執行測試
      await expect(enhancedHandler({}, mockContext))
        .rejects.toThrow('無法獲取用戶權限資訊');
      
      expect(getUserInfoFromClaims).toHaveBeenCalledWith(mockContext.auth.token);
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('應該為認證通過的用戶傳遞用戶資訊', async () => {
      // 模擬 getUserInfoFromClaims 返回用戶信息
      (getUserInfoFromClaims as jest.Mock).mockResolvedValue(mockUserInfo);
      
      // 創建增強函數
      const handler = jest.fn().mockResolvedValue('success');
      const enhancedHandler = withAuthentication(handler);
      
      // 執行測試
      const result = await enhancedHandler({}, mockContext);
      
      expect(result).toBe('success');
      expect(getUserInfoFromClaims).toHaveBeenCalledWith(mockContext.auth.token);
      expect(handler).toHaveBeenCalledWith({}, mockContext, mockUserInfo);
    });
  });
  
  describe('withTenantIsolation', () => {
    beforeEach(() => {
      // 模擬 getUserInfoFromClaims 返回用戶資訊
      (getUserInfoFromClaims as jest.Mock).mockResolvedValue(mockUserInfo);
    });
    
    it('應該允許超級管理員訪問任何租戶的資源', async () => {
      // 準備超級管理員資訊
      const superAdminInfo = {
        ...mockUserInfo,
        role: 'super_admin',
        roleLevel: 1
      };
      (getUserInfoFromClaims as jest.Mock).mockResolvedValue(superAdminInfo);
      
      // 創建增強函數
      const handler = jest.fn().mockResolvedValue('success');
      const enhancedHandler = withTenantIsolation(handler);
      
      // 請求其他租戶的資源
      const result = await enhancedHandler({ tenantId: 'other-tenant' }, mockContext);
      
      expect(result).toBe('success');
      expect(handler).toHaveBeenCalledWith(
        { tenantId: 'other-tenant' }, 
        mockContext, 
        superAdminInfo
      );
    });
    
    it('應該禁止普通用戶訪問其他租戶的資源', async () => {
      // 創建增強函數
      const handler = jest.fn();
      const enhancedHandler = withTenantIsolation(handler);
      
      // 請求其他租戶的資源
      await expect(enhancedHandler({ tenantId: 'other-tenant' }, mockContext))
        .rejects.toThrow('無法訪問其他租戶的資源');
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('應該在請求中注入用戶的租戶ID', async () => {
      // 創建增強函數
      const handler = jest.fn().mockResolvedValue('success');
      const enhancedHandler = withTenantIsolation(handler);
      
      // 未指定租戶ID的請求
      const result = await enhancedHandler({}, mockContext);
      
      expect(result).toBe('success');
      expect(handler).toHaveBeenCalledWith(
        { tenantId: 'tenant-123' }, 
        mockContext, 
        mockUserInfo
      );
    });
  });
  
  describe('withStoreIsolation', () => {
    beforeEach(() => {
      // 模擬 getUserInfoFromClaims 返回用戶資訊
      (getUserInfoFromClaims as jest.Mock).mockResolvedValue(mockUserInfo);
    });
    
    it('應該允許店鋪經理訪問自己店鋪和額外授權店鋪的資源', async () => {
      // 準備店鋪經理資訊
      const storeManagerInfo = {
        ...mockUserInfo,
        role: 'store_manager',
        roleLevel: 3,
        additionalStoreIds: ['store-456']
      };
      (getUserInfoFromClaims as jest.Mock).mockResolvedValue(storeManagerInfo);
      
      // 創建增強函數
      const handler = jest.fn().mockResolvedValue('success');
      const enhancedHandler = withStoreIsolation(handler);
      
      // 請求主要店鋪的資源
      let result = await enhancedHandler({ storeId: 'store-123' }, mockContext);
      expect(result).toBe('success');
      
      // 請求額外授權店鋪的資源
      result = await enhancedHandler({ storeId: 'store-456' }, mockContext);
      expect(result).toBe('success');
      
      expect(handler).toHaveBeenCalledTimes(2);
    });
    
    it('應該禁止店鋪用戶訪問未授權店鋪的資源', async () => {
      // 準備店鋪經理資訊
      const storeManagerInfo = {
        ...mockUserInfo,
        role: 'store_manager',
        roleLevel: 3,
        additionalStoreIds: ['store-456']
      };
      (getUserInfoFromClaims as jest.Mock).mockResolvedValue(storeManagerInfo);
      
      // 創建增強函數
      const handler = jest.fn();
      const enhancedHandler = withStoreIsolation(handler);
      
      // 請求未授權店鋪的資源
      await expect(enhancedHandler({ storeId: 'store-789' }, mockContext))
        .rejects.toThrow('無法訪問非授權店鋪的資源');
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('應該允許租戶管理員訪問租戶內任何店鋪的資源', async () => {
      // 創建增強函數
      const handler = jest.fn().mockResolvedValue('success');
      const enhancedHandler = withStoreIsolation(handler);
      
      // 請求租戶內任意店鋪的資源
      const result = await enhancedHandler({ storeId: 'any-store-in-tenant' }, mockContext);
      
      expect(result).toBe('success');
      expect(handler).toHaveBeenCalled();
    });
  });
  
  describe('withRole', () => {
    beforeEach(() => {
      // 模擬 getUserInfoFromClaims 返回用戶資訊
      (getUserInfoFromClaims as jest.Mock).mockResolvedValue(mockUserInfo);
    });
    
    it('應該允許具有足夠權限的用戶訪問', async () => {
      // 創建增強函數
      const handler = jest.fn().mockResolvedValue('success');
      const enhancedHandler = withRole('tenant_admin', handler);
      
      // 租戶管理員訪問需要租戶管理員權限的功能
      const result = await enhancedHandler({}, mockContext);
      
      expect(result).toBe('success');
      expect(handler).toHaveBeenCalled();
    });
    
    it('應該拒絕權限不足的用戶', async () => {
      // 準備員工資訊
      const staffInfo = {
        ...mockUserInfo,
        role: 'staff',
        roleLevel: 6
      };
      (getUserInfoFromClaims as jest.Mock).mockResolvedValue(staffInfo);
      
      // 創建增強函數
      const handler = jest.fn();
      const enhancedHandler = withRole('tenant_admin', handler);
      
      // 普通員工嘗試訪問需要租戶管理員權限的功能
      await expect(enhancedHandler({}, mockContext))
        .rejects.toThrow(/需要.*角色/);
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('應該拒絕無效角色類型的請求', async () => {
      // 創建增強函數
      const handler = jest.fn();
      const enhancedHandler = withRole('invalid_role', handler);
      
      await expect(enhancedHandler({}, mockContext))
        .rejects.toThrow('角色類型.*無效');
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
  
  describe('withMockAuthentication', () => {
    it('應該在測試環境中模擬用戶認證', async () => {
      // 備份並設置環境變數
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      // 創建增強函數
      const handler = jest.fn().mockResolvedValue('success');
      const enhancedHandler = withMockAuthentication(handler);
      
      // 執行請求
      const result = await enhancedHandler({}, {});
      
      expect(result).toBe('success');
      expect(handler).toHaveBeenCalledWith(
        {}, 
        {}, 
        expect.objectContaining({
          role: 'staff',
          uid: expect.any(String)
        })
      );
      
      // 恢復環境變數
      process.env.NODE_ENV = originalEnv;
    });
    
    it('應該在非測試環境中拒絕使用模擬認證', async () => {
      // 備份並設置環境變數
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // 創建增強函數
      const handler = jest.fn();
      const enhancedHandler = withMockAuthentication(handler);
      
      // 執行請求
      await expect(enhancedHandler({}, {}))
        .rejects.toThrow('模擬身份驗證中間件只能在測試環境中使用');
      
      expect(handler).not.toHaveBeenCalled();
      
      // 恢復環境變數
      process.env.NODE_ENV = originalEnv;
    });
  });
}); 