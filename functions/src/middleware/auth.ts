import * as admin from 'firebase-admin';
import { Request, Response, NextFunction } from 'express';

/**
 * 包含已驗證用戶信息的請求接口
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role?: string;
    tenantId?: string;
    storeId?: string;
    permissions?: Record<string, boolean>;
  };
}

/**
 * 身份驗證中間件
 * 驗證請求中的 Firebase ID Token 並將用戶資料附加到請求對象上
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        code: 'MISSING_TOKEN',
        message: '缺少認證令牌'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // 驗證 Firebase ID Token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    if (!decodedToken.uid) {
      return res.status(401).json({
        code: 'INVALID_TOKEN',
        message: '無效的認證令牌'
      });
    }
    
    // 從 Firestore 獲取用戶的其他資訊
    const userRecord = await admin.auth().getUser(decodedToken.uid);
    
    // 設置基本用戶資訊
    req.user = {
      uid: decodedToken.uid,
      email: userRecord.email || undefined,
      role: decodedToken.role || 'staff', // 預設角色
      tenantId: decodedToken.tenantId,
      storeId: decodedToken.storeId,
      permissions: decodedToken.permissions as Record<string, boolean> || {}
    };
    
    // 繼續處理請求
    return next();
  } catch (error) {
    console.error('認證失敗:', error);
    
    if (error instanceof Error && error.message.includes('auth/id-token-expired')) {
      return res.status(401).json({
        code: 'TOKEN_EXPIRED',
        message: '認證令牌已過期'
      });
    }
    
    return res.status(401).json({
      code: 'AUTHENTICATION_FAILED',
      message: '認證失敗'
    });
  }
}; 