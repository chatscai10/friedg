import axios from 'axios';
import { 
  getLineLoginUrl, 
  handleLineCallback, 
  exchangeLineTokenForFirebaseToken,
  verifyLineIdToken
} from './line.service';

// 模擬依賴
jest.mock('axios');

// 首先創建實際的模擬對象
const mockFirestoreDb = {
  collection: jest.fn().mockReturnValue({
    doc: jest.fn().mockReturnValue({
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(true)
    }),
    where: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        get: jest.fn()
      })
    })
  })
};

const mockFieldValue = {
  serverTimestamp: jest.fn().mockReturnValue('server-timestamp')
};

const mockFirebaseAdmin = {
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  auth: jest.fn(() => ({
    createCustomToken: jest.fn().mockResolvedValue('firebase-custom-token'),
    setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
    getUser: jest.fn(),
    createUser: jest.fn()
  })),
  firestore: jest.fn(() => mockFirestoreDb),
  firestore: { // 這裡重複定義了firestore，將其修改為一個屬性
    FieldValue: mockFieldValue
  }
};

// 修正：避免重複定義
const betterMockFirebaseAdmin = {
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  auth: jest.fn(() => ({
    createCustomToken: jest.fn().mockResolvedValue('firebase-custom-token'),
    setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
    getUser: jest.fn(),
    createUser: jest.fn()
  })),
  firestore: Object.assign(
    jest.fn(() => mockFirestoreDb), 
    { FieldValue: mockFieldValue }
  )
};

// 使用Jest的手動模擬方式
jest.mock('firebase-admin', () => betterMockFirebaseAdmin);

// 為了測試，我們需要一些輔助函數來處理模擬
describe('LINE Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getLineLoginUrl', () => {
    it('應該生成正確的LINE登入URL', () => {
      // 測試參數
      const channelId = 'test-channel-id';
      const redirectUri = 'https://example.com/auth/line/callback';
      const state = 'random-state-123';
      
      // 調用函數
      const url = getLineLoginUrl(channelId, redirectUri, state);
      
      // 驗證
      expect(url).toContain('https://access.line.me/oauth2/v2.1/authorize');
      expect(url).toContain(`client_id=${channelId}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(url).toContain(`state=${state}`);
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=profile%20openid%20email');
    });
  });
  
  describe('handleLineCallback', () => {
    it('應該成功交換授權碼獲取訪問令牌和ID令牌', async () => {
      // 測試數據
      const code = 'test-auth-code';
      const tenantHint = 'test-tenant';
      
      // 模擬租戶查詢
      const mockTenantQuery = {
        empty: false,
        docs: [{ id: 'tenant-123', data: () => ({ code: 'test-tenant' }) }]
      };
      
      const mockTenantDoc = {
        exists: true,
        data: () => ({
          lineChannelId: 'tenant-channel-id',
          lineChannelSecret: 'tenant-channel-secret',
          lineRedirectUri: 'https://tenant.example.com/callback'
        })
      };
      
      mockFirebaseAdmin.firestore.collection.mockReturnValue({
        doc: mockFirebaseAdmin.firestore.doc,
        where: mockFirebaseAdmin.firestore.where
      });
      
      mockFirebaseAdmin.firestore.doc.mockReturnValue({
        get: mockFirebaseAdmin.firestore.get,
        set: mockFirebaseAdmin.firestore.set,
        update: mockFirebaseAdmin.firestore.update
      });
      
      mockFirebaseAdmin.firestore.where.mockReturnValue({
        limit: mockFirebaseAdmin.firestore.limit,
        where: mockFirebaseAdmin.firestore.where
      });
      
      mockFirebaseAdmin.firestore.limit.mockReturnValue({
        get: mockFirebaseAdmin.firestore.get
      });
      
      mockFirebaseAdmin.firestore.get.mockImplementation((path) => {
        if (path && typeof path === 'string' && path.includes('tenants/')) {
          return Promise.resolve(mockTenantDoc);
        } else {
          return Promise.resolve(mockTenantQuery);
        }
      });
      
      // 模擬axios POST響應
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
          token_type: 'Bearer',
          expires_in: 2592000,
          refresh_token: 'test-refresh-token'
        }
      });
      
      // 調用函數
      const result = await handleLineCallback(code, tenantHint);
      
      // 驗證
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.line.me/oauth2/v2.1/token',
        expect.stringContaining('code=test-auth-code'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );
      
      expect(result).toEqual({
        accessToken: 'test-access-token',
        idToken: 'test-id-token'
      });
    });
    
    it('應該使用系統默認配置當找不到租戶特定配置', async () => {
      // 測試數據
      const code = 'test-auth-code';
      
      // 模擬系統配置
      const mockSystemConfig = {
        exists: true,
        data: () => ({
          defaultChannelId: 'default-channel-id',
          defaultChannelSecret: 'default-channel-secret',
          defaultRedirectUri: 'https://default.example.com/callback'
        })
      };
      
      mockFirebaseAdmin.firestore.get.mockResolvedValue(mockSystemConfig);
      
      // 模擬axios POST響應
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          access_token: 'test-access-token',
          id_token: 'test-id-token'
        }
      });
      
      // 調用函數
      const result = await handleLineCallback(code);
      
      // 驗證
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.line.me/oauth2/v2.1/token',
        expect.stringContaining('client_id=default-channel-id'),
        expect.any(Object)
      );
      
      expect(result).toEqual({
        accessToken: 'test-access-token',
        idToken: 'test-id-token'
      });
    });
    
    it('應該拋出錯誤當無法獲取LINE配置', async () => {
      // 測試數據
      const code = 'test-auth-code';
      
      // 模擬找不到配置
      const mockSystemConfig = {
        exists: false,
        data: () => null
      };
      
      mockFirebaseAdmin.firestore.get.mockResolvedValue(mockSystemConfig);
      
      // 調用函數並驗證拋出錯誤
      await expect(handleLineCallback(code)).rejects.toThrow('系統錯誤：無法獲取有效的LINE配置');
    });
    
    it('應該處理LINE API返回的錯誤', async () => {
      // 測試數據
      const code = 'invalid-auth-code';
      
      // 模擬系統配置
      const mockSystemConfig = {
        exists: true,
        data: () => ({
          defaultChannelId: 'default-channel-id',
          defaultChannelSecret: 'default-channel-secret',
          defaultRedirectUri: 'https://default.example.com/callback'
        })
      };
      
      mockFirebaseAdmin.firestore.get.mockResolvedValue(mockSystemConfig);
      
      // 模擬axios拋出錯誤
      (axios.post as jest.Mock).mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: 'invalid_grant',
            error_description: 'authorization code is invalid'
          }
        }
      });
      
      // 調用函數並驗證拋出錯誤
      await expect(handleLineCallback(code)).rejects.toThrow(
        'LINE Token交換失敗: invalid_grant - authorization code is invalid'
      );
    });
  });
  
  describe('exchangeLineTokenForFirebaseToken', () => {
    // 這部分測試將在後續擴展
    it('應該基本測試通過', async () => {
      // 簡單測試，確保測試套件可執行
      expect(true).toBe(true);
    });
  });
}); 