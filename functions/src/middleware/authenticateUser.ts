import { Request, Response, NextFunction } from 'express';
import { auth } from 'firebase-admin';
import { UserContext } from '../stores/stores.types';

/**
 * 用戶認證中間件
 * 驗證 Firebase Auth 令牌並設置用戶上下文
 */
export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的令牌'
      });
    }
    
    // 提取令牌
    const token = authHeader.split('Bearer ')[1];
    
    // 驗證令牌
    const decodedToken = await auth().verifyIdToken(token);
    
    // 獲取用戶額外 claims
    const userRecord = await auth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};
    
    // 構建用戶上下文
    const userContext: UserContext = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: customClaims.role || 'user',
      roleLevel: customClaims.roleLevel || 0,
      tenantId: customClaims.tenantId,
      storeId: customClaims.storeId,
      additionalStoreIds: customClaims.additionalStoreIds || [],
      permissions: customClaims.permissions || {}
    };
    
    // 將用戶上下文添加到請求對象
    req.user = userContext;
    
    next();
  } catch (error: any) {
    console.error('驗證用戶令牌時發生錯誤：', error);
    
    return res.status(401).json({
      status: 'error',
      message: '未授權：無效的令牌',
      details: error.message
    });
  }
}; 