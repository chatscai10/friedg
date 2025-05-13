import { Request, Response, NextFunction } from 'express';
import { auth } from 'firebase-admin';
import { withExpressAuthentication } from '../auth.middleware';
import { UserInfo } from '../../libs/rbac/types';
import { getUserInfoFromClaims } from '../../libs/rbac';

// 模擬 firebase-admin auth
jest.mock('firebase-admin', () => ({
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn()
  })
}));

// 模擬 RBAC 函數庫
jest.mock('../../libs/rbac', () => ({
  getUserInfoFromClaims: jest.fn()
}));

// 測試用戶資訊
const mockUserInfo: UserInfo = {
  uid: 'test-user-123',
  role: 'staff',
  roleLevel: 5,
  tenantId: 'tenant-123',
  storeId: 'store-123'
};

// 模擬 Request, Response, NextFunction
const createMockReqResNext = (authHeader?: string) => {
  const req = {
    headers: {
      authorization: authHeader
    },
    user: undefined
  } as unknown as Request;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  } as unknown as Response;

  const next = jest.fn() as NextFunction;

  return { req, res, next };
};

describe('Express 風格身份驗證中間件', () => {
  beforeEach(() => {
    // 清除模擬狀態
    jest.clearAllMocks();
  });

  test('應在缺少授權頭時返回 401', async () => {
    const { req, res, next } = createMockReqResNext(undefined);
    
    await withExpressAuthentication(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '未提供授權憑證',
      errorCode: 'MISSING_AUTH_TOKEN'
    }));
    expect(next).not.toHaveBeenCalled();
    expect(auth().verifyIdToken).not.toHaveBeenCalled();
  });

  test('應在授權格式錯誤時返回 401', async () => {
    const { req, res, next } = createMockReqResNext('InvalidFormat token123');
    
    await withExpressAuthentication(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '授權格式錯誤',
      errorCode: 'INVALID_AUTH_FORMAT'
    }));
    expect(next).not.toHaveBeenCalled();
    expect(auth().verifyIdToken).not.toHaveBeenCalled();
  });

  test('應在令牌無效時返回 401', async () => {
    const { req, res, next } = createMockReqResNext('Bearer invalid-token');
    
    // 模擬令牌驗證失敗
    const tokenError = new Error('令牌無效');
    (auth().verifyIdToken as jest.Mock).mockRejectedValueOnce(tokenError);
    
    await withExpressAuthentication(req, res, next);
    
    expect(auth().verifyIdToken).toHaveBeenCalledWith('invalid-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '授權憑證無效或已過期',
      errorCode: 'INVALID_AUTH_TOKEN'
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('應在用戶信息不存在時返回 403', async () => {
    const { req, res, next } = createMockReqResNext('Bearer valid-token');
    
    // 模擬令牌驗證成功但用戶信息不存在
    const decodedToken = { uid: 'test-user-123' };
    (auth().verifyIdToken as jest.Mock).mockResolvedValueOnce(decodedToken);
    (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(null);
    
    await withExpressAuthentication(req, res, next);
    
    expect(auth().verifyIdToken).toHaveBeenCalledWith('valid-token');
    expect(getUserInfoFromClaims).toHaveBeenCalledWith(decodedToken);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '無法獲取用戶權限資訊，請確認帳號權限或重新登入',
      errorCode: 'USER_INFO_NOT_FOUND'
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('應在正確授權時設置 req.user 並呼叫 next()', async () => {
    const { req, res, next } = createMockReqResNext('Bearer valid-token');
    
    // 模擬令牌驗證和用戶信息獲取成功
    const decodedToken = { uid: 'test-user-123' };
    (auth().verifyIdToken as jest.Mock).mockResolvedValueOnce(decodedToken);
    (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockUserInfo);
    
    await withExpressAuthentication(req, res, next);
    
    expect(auth().verifyIdToken).toHaveBeenCalledWith('valid-token');
    expect(getUserInfoFromClaims).toHaveBeenCalledWith(decodedToken);
    expect(req.user).toEqual(mockUserInfo);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
}); 