import { Request, Response } from 'express';
import { 
  lineLoginHandler, 
  lineCallbackHandler, 
  lineTokenExchangeHandler, 
  employeeLineLoginHandler 
} from './line.handlers';
import * as lineService from './line.service';

// 模擬依賴
jest.mock('./line.service');

// 先定義模擬Firestore和Auth
const mockFirestore = {
  collection: jest.fn().mockReturnValue({ 
    doc: jest.fn().mockReturnValue({ 
      get: jest.fn().mockResolvedValue(true),
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

const mockAuth = {
  createCustomToken: jest.fn().mockResolvedValue('mock-custom-token'),
  setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
  getUser: jest.fn(),
  createUser: jest.fn()
};

// 使用對象結構來避免重複定義
jest.mock('firebase-admin', () => {
  return {
    firestore: jest.fn(() => mockFirestore),
    auth: jest.fn(() => mockAuth),
    initializeApp: jest.fn(),
    credential: { cert: jest.fn() }
  };
});

// 模擬LINE ID令牌驗證函數(未在service中實現，但在handlers中使用)
jest.spyOn(lineService, 'verifyLineIdToken').mockImplementation(async (idToken) => {
  if (idToken === 'invalid-id-token') {
    throw new Error('ID令牌驗證失敗');
  }
  return {
    sub: 'line-user-id',
    name: '測試用戶',
    picture: 'https://example.com/profile.jpg',
    email: 'test@example.com'
  };
});

describe('LINE Login Handlers', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  
  beforeEach(() => {
    // 重置模擬
    jest.clearAllMocks();
    
    // 設置請求和響應模擬
    req = {
      query: {},
      params: {},
      body: {},
      headers: {},
      get: jest.fn().mockImplementation((header) => {
        if (header === 'Referer') return 'https://example.com';
        return req.headers?.[header];
      })
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
      json: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn()
    };
  });
  
  describe('lineLoginHandler', () => {
    it('應該重定向到LINE授權URL', () => {
      // 模擬 getLineLoginUrl 函數
      const mockLineLoginUrl = 'https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=test&redirect_uri=test&state=test&scope=profile%20openid%20email';
      (lineService.getLineLoginUrl as jest.Mock).mockReturnValue(mockLineLoginUrl);
      
      // 調用處理器
      lineLoginHandler(req as Request, res as Response);
      
      // 驗證結果
      expect(lineService.getLineLoginUrl).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(mockLineLoginUrl);
    });
    
    it('應該使用查詢參數中的租戶提示', () => {
      // 設置查詢參數
      req.query = { tenant: 'test-tenant' };
      
      // 模擬 getLineLoginUrl 函數
      const mockLineLoginUrl = 'https://line-auth-url.com';
      (lineService.getLineLoginUrl as jest.Mock).mockReturnValue(mockLineLoginUrl);
      
      // 調用處理器
      lineLoginHandler(req as Request, res as Response);
      
      // 驗證結果
      expect(lineService.getLineLoginUrl).toHaveBeenCalledWith(
        expect.any(String), // channelId 
        expect.any(String), // redirectUri
        expect.any(String), // state
        'test-tenant' // tenantHint
      );
    });
    
    it('應該處理錯誤情況', () => {
      // 模擬錯誤
      (lineService.getLineLoginUrl as jest.Mock).mockImplementation(() => {
        throw new Error('LINE配置錯誤');
      });
      
      // 調用處理器
      lineLoginHandler(req as Request, res as Response);
      
      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('LINE配置錯誤')
        })
      );
    });
  });
  
  describe('lineCallbackHandler', () => {
    it('應該處理成功的回調並設置cookie', async () => {
      // 設置請求
      req.query = { 
        code: 'test-auth-code',
        state: 'random-state-123',
        tenant: 'test-tenant'
      };
      
      // 模擬服務函數返回
      (lineService.handleLineCallback as jest.Mock).mockResolvedValue({
        accessToken: 'test-access-token',
        idToken: 'test-id-token'
      });
      
      // 調用處理器
      await lineCallbackHandler(req as Request, res as Response);
      
      // 驗證結果
      expect(lineService.handleLineCallback).toHaveBeenCalledWith(
        'test-auth-code',
        'test-tenant'
      );
      
      expect(res.cookie).toHaveBeenCalledWith(
        'lineTokens',
        expect.stringContaining('test-access-token'),
        expect.objectContaining({
          httpOnly: true,
          secure: expect.any(Boolean),
          maxAge: expect.any(Number)
        })
      );
      
      expect(res.redirect).toHaveBeenCalled();
    });
    
    it('應該處理錯誤情況', async () => {
      // 設置請求
      req.query = { 
        code: 'invalid-code'
      };
      
      // 模擬服務錯誤
      (lineService.handleLineCallback as jest.Mock).mockRejectedValue(
        new Error('授權碼無效')
      );
      
      // 調用處理器
      await lineCallbackHandler(req as Request, res as Response);
      
      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('授權碼無效')
        })
      );
    });
  });
  
  describe('lineTokenExchangeHandler', () => {
    it('應該成功交換token', async () => {
      // 設置請求
      req.body = {
        idToken: 'line-id-token-123'
      };
      
      // 模擬服務函數返回
      (lineService.exchangeLineTokenForFirebaseToken as jest.Mock).mockResolvedValue({
        customToken: 'firebase-custom-token',
        user: {
          uid: 'user-123',
          isNewUser: false
        }
      });
      
      // 調用處理器
      await lineTokenExchangeHandler(req as Request, res as Response);
      
      // 驗證結果
      expect(lineService.exchangeLineTokenForFirebaseToken).toHaveBeenCalledWith(
        'line-id-token-123',
        undefined // tenantHint
      );
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          customToken: 'firebase-custom-token',
          isNewUser: false,
          uid: 'user-123'
        })
      );
    });
    
    it('應該處理缺少ID令牌的情況', async () => {
      // 空的請求體
      req.body = {};
      
      // 調用處理器
      await lineTokenExchangeHandler(req as Request, res as Response);
      
      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('缺少 LINE ID Token')
        })
      );
    });
    
    it('應該處理Token交換失敗的情況', async () => {
      // 設置請求
      req.body = {
        idToken: 'invalid-id-token'
      };
      
      // 模擬服務錯誤
      (lineService.exchangeLineTokenForFirebaseToken as jest.Mock).mockRejectedValue(
        new Error('ID令牌驗證失敗')
      );
      
      // 調用處理器
      await lineTokenExchangeHandler(req as Request, res as Response);
      
      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('ID令牌驗證失敗')
        })
      );
    });
  });
  
  describe('employeeLineLoginHandler', () => {
    it('應該處理員工LINE登入', async () => {
      // 設置請求
      req.body = {
        idToken: 'line-id-token-123',
        storeId: 'store-123',
        tenantId: 'tenant-123'
      };
      
      // 模擬獲取LINE用戶資訊
      const mockUserInfo = {
        sub: 'line-user-123',
        name: '測試用戶',
        picture: 'https://example.com/profile.jpg',
        email: 'test@example.com'
      };
      
      // 模擬服務函數
      (lineService.verifyLineIdToken as jest.Mock).mockResolvedValue(mockUserInfo);
      
      // 模擬員工查詢
      mockFirestore.collection.mockReturnValue({ 
        doc: mockFirestore.collection.mock.results[0].value.doc,
        where: mockFirestore.collection.mock.results[0].value.where
      });
      
      mockFirestore.collection.mock.results[0].value.doc.mockReturnValue({ 
        get: mockFirestore.collection.mock.results[0].value.doc.mock.results[0].value,
        set: mockFirestore.collection.mock.results[0].value.doc.mock.results[1].value,
        update: mockFirestore.collection.mock.results[0].value.doc.mock.results[2].value
      });
      
      mockFirestore.collection.mock.results[0].value.where.mockReturnValue({
        limit: mockFirestore.collection.mock.results[0].value.where.mock.results[0].value
      });
      
      mockFirestore.collection.mock.results[0].value.where.mock.results[0].value.mockReturnValue({
        get: mockFirestore.collection.mock.results[0].value.where.mock.results[0].value.mock.results[0].value
      });
      
      // 調用處理器
      await employeeLineLoginHandler(req as Request, res as Response);
      
      // 驗證結果
      expect(lineService.verifyLineIdToken).toHaveBeenCalledWith('line-id-token-123');
      expect(mockAuth.createCustomToken).toHaveBeenCalledWith('firebase-user-123', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          customToken: 'mock-custom-token',
          user: expect.objectContaining({
            uid: 'firebase-user-123',
            displayName: '測試員工'
          })
        })
      );
    });
    
    it('應該處理找不到員工的情況', async () => {
      // 設置請求
      req.body = {
        idToken: 'line-id-token-123',
        tenantId: 'tenant-123'
      };
      
      // 模擬獲取LINE用戶資訊
      const mockUserInfo = {
        sub: 'unknown-line-user',
        name: '未知用戶',
        picture: 'https://example.com/profile.jpg',
        email: 'unknown@example.com'
      };
      
      // 模擬服務函數
      (lineService.verifyLineIdToken as jest.Mock).mockResolvedValue(mockUserInfo);
      
      // 模擬空的員工查詢結果
      mockFirestore.collection.mockReturnValue({ 
        doc: mockFirestore.collection.mock.results[0].value.doc,
        where: mockFirestore.collection.mock.results[0].value.where
      });
      
      mockFirestore.collection.mock.results[0].value.doc.mockReturnValue({ 
        get: mockFirestore.collection.mock.results[0].value.doc.mock.results[0].value,
        set: mockFirestore.collection.mock.results[0].value.doc.mock.results[1].value,
        update: mockFirestore.collection.mock.results[0].value.doc.mock.results[2].value
      });
      
      mockFirestore.collection.mock.results[0].value.where.mockReturnValue({
        limit: mockFirestore.collection.mock.results[0].value.where.mock.results[0].value
      });
      
      mockFirestore.collection.mock.results[0].value.where.mock.results[0].value.mockReturnValue({
        get: mockFirestore.collection.mock.results[0].value.where.mock.results[0].value.mock.results[0].value
      });
      
      // 調用處理器
      await employeeLineLoginHandler(req as Request, res as Response);
      
      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('未找到對應員工帳號')
        })
      );
    });
  });
}); 