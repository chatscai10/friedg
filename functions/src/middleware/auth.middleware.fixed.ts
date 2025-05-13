/**
 * 身份驗證中間件 - 標準化修正版本
 * 
 * 此文件同時支援Firebase Functions和Express API，提供一致的驗證和授權體驗
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { NextFunction, Request, Response } from 'express';
import { CallableContext, RoleLevelMap, RoleType } from '../libs/rbac/types';
import { getUserInfoFromClaims, UserInfo } from '../libs/rbac';
import { validateRoleType, validateResourceType, validateActionType } from '../libs/rbac/utils/validators';
import { DecodedIdToken } from 'firebase-admin/auth';

// 擴展Express Request類型，添加user屬性
declare global {
  namespace Express {
    interface Request {
      user?: UserInfo;
    }
  }
}

/**
 * ==========================================
 * Firebase Functions callable HTTPS 中間件
 * ==========================================
 */

/**
 * 身份驗證中間件 (Firebase Functions版)
 */
export function withAuthentication<T>(
  handler: (data: any, context: CallableContext, user: UserInfo) => Promise<T>
): (data: any, context: CallableContext) => Promise<T> {
  return async (data: any, context: CallableContext) => {
    try {
      // 驗證用戶是否已登入
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          '需要登入才能執行此操作'
        );
      }

      // 獲取用戶資訊
      const userInfo = await getUserInfoFromClaims(context.auth.token);
      
      if (!userInfo) {
        console.error('[AUTH] 無法獲取用戶權限資訊:', context.auth.uid);
        throw new functions.https.HttpsError(
          'permission-denied',
          '無法獲取用戶權限資訊，請確認帳號權限或重新登入'
        );
      }

      // 基本驗證通過，執行處理函數
      return await handler(data, context, userInfo);
    } catch (error) {
      console.error('[AUTH] 身份驗證過程中發生錯誤:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error; // 已經是格式化的錯誤，直接拋出
      }
      
      // 其他未知錯誤
      throw new functions.https.HttpsError(
        'internal',
        `身份驗證時發生內部錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  };
}

/**
 * 租戶隔離中間件 (Firebase Functions版)
 */
export function withTenantIsolation<T>(
  handler: (data: any, context: CallableContext, user: UserInfo) => Promise<T>
): (data: any, context: CallableContext) => Promise<T> {
  return withAuthentication(async (data, context, user) => {
    // 非租戶用戶（如超級管理員）可以繞過租戶隔離
    if (user.role === 'super_admin') {
      return handler(data, context, user);
    }
    
    // 確保用戶有租戶ID
    if (!user.tenantId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '用戶未關聯到任何租戶'
      );
    }
    
    // 檢查請求數據中是否有租戶ID，如果有則必須與用戶租戶ID匹配
    if (data.tenantId && data.tenantId !== user.tenantId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無法訪問其他租戶的資源'
      );
    }
    
    // 將用戶的租戶ID注入到請求數據中（如果尚未存在）
    const enhancedData = { ...data, tenantId: user.tenantId };
    
    return handler(enhancedData, context, user);
  });
}

/**
 * 店鋪隔離中間件 (Firebase Functions版)
 */
export function withStoreIsolation<T>(
  handler: (data: any, context: CallableContext, user: UserInfo) => Promise<T>
): (data: any, context: CallableContext) => Promise<T> {
  return withTenantIsolation(async (data, context, user) => {
    // 租戶管理員和超級管理員可以訪問租戶內的任何店鋪
    if (user.role === 'super_admin' || user.role === 'tenant_admin') {
      return handler(data, context, user);
    }
    
    // 確保用戶有店鋪ID
    if (!user.storeId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '用戶未關聯到任何店鋪'
      );
    }
    
    // 檢查請求數據中是否有店鋪ID
    if (data.storeId) {
      // 檢查是否是用戶的主要店鋪或額外店鋪
      const hasAccess = data.storeId === user.storeId || 
                        (user.additionalStoreIds && 
                         user.additionalStoreIds.includes(data.storeId));
      
      if (!hasAccess) {
        throw new functions.https.HttpsError(
          'permission-denied',
          '無法訪問非授權店鋪的資源'
        );
      }
    } else {
      // 如果請求中沒有指定店鋪ID，使用用戶的主要店鋪ID
      data.storeId = user.storeId;
    }
    
    return handler(data, context, user);
  });
}

/**
 * 角色要求中間件 (Firebase Functions版)
 */
export function withRole<T>(
  requiredRole: RoleType | string,
  handler: (data: any, context: CallableContext, user: UserInfo) => Promise<T>
): (data: any, context: CallableContext) => Promise<T> {
  return withAuthentication(async (data, context, user) => {
    // 驗證所需角色是否有效
    if (!validateRoleType(requiredRole)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `角色類型 '${requiredRole}' 無效`
      );
    }

    // 檢查用戶角色等級是否足夠
    const userRoleLevel = user.roleLevel;
    // 使用 RoleLevelMap 獲取所需角色的等級
    const requiredRoleLevel = RoleLevelMap[requiredRole as RoleType]; 
    
    if (userRoleLevel > requiredRoleLevel) { // 角色等級數字越小，權限越高
      throw new functions.https.HttpsError(
        'permission-denied',
        `此操作需要 '${requiredRole}' 或更高權限的角色`
      );
    }
    
    return handler(data, context, user);
  });
}

/**
 * ==========================================
 * Express 中間件
 * ==========================================
 */

/**
 * Express 身份驗證中間件
 * 驗證Bearer令牌並添加用戶資訊到請求對象
 */
export const withExpressAuthentication = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 從請求頭或Cookie中獲取授權令牌
    const authHeader = req.headers.authorization;
    let idToken: string | undefined;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      idToken = authHeader.split('Bearer ')[1];
    } else if (req.cookies && req.cookies.__session) {
      // 從Cookie中獲取令牌（Firebase Hosting整合時常用）
      idToken = req.cookies.__session;
    }
    
    // 沒有令牌，拒絕訪問
    if (!idToken) {
      return res.status(401).json({ 
        error: '需要授權令牌', 
        message: '請提供有效的授權令牌' 
      });
    }
    
    // 驗證令牌
    try {
      const decodedToken: DecodedIdToken = await admin.auth().verifyIdToken(idToken);
      
      // 獲取用戶資訊
      const userInfo = await getUserInfoFromClaims(decodedToken);
      
      if (!userInfo) {
        console.error('[AUTH] 無法獲取用戶權限資訊:', decodedToken.uid);
        return res.status(403).json({ 
          error: '權限不足', 
          message: '無法獲取用戶權限資訊，請確認帳號權限或重新登入' 
        });
      }
      
      // 將用戶資訊添加到請求對象
      req.user = userInfo;
      
      // 也添加到res.locals以便在其他中間件訪問
      res.locals.user = userInfo;
      res.locals.tenantId = userInfo.tenantId;
      res.locals.storeId = userInfo.storeId;
      
      next();
    } catch (error) {
      console.error('[AUTH] 令牌驗證失敗:', error);
      return res.status(401).json({ 
        error: '無效的授權令牌', 
        message: '令牌已過期或無效，請重新登入' 
      });
    }
  } catch (error) {
    console.error('[AUTH] 身份驗證過程中發生錯誤:', error);
    return res.status(500).json({ 
      error: '身份驗證失敗', 
      message: '身份驗證過程中發生內部錯誤' 
    });
  }
};

/**
 * Express 角色檢查中間件
 * 驗證用戶是否具有指定角色
 */
export const checkRole = (requiredRole: RoleType | string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 確保先驗證過身份
      if (!req.user) {
        return res.status(401).json({ 
          error: '未授權', 
          message: '請先登入' 
        });
      }
      
      // 驗證所需角色是否有效
      if (!validateRoleType(requiredRole)) {
        return res.status(400).json({ 
          error: '無效參數', 
          message: `角色類型 '${requiredRole}' 無效` 
        });
      }
      
      // 檢查用戶角色等級是否足夠
      const userRoleLevel = req.user.roleLevel;
      const requiredRoleLevel = RoleLevelMap[requiredRole as RoleType];
      
      if (userRoleLevel > requiredRoleLevel) { // 角色等級數字越小，權限越高
        return res.status(403).json({ 
          error: '權限不足', 
          message: `此操作需要 '${requiredRole}' 或更高權限的角色` 
        });
      }
      
      next();
    } catch (error) {
      console.error('[AUTH] 角色檢查過程中發生錯誤:', error);
      return res.status(500).json({ 
        error: '角色檢查失敗', 
        message: '角色檢查過程中發生內部錯誤' 
      });
    }
  };
};

/**
 * Express 租戶訪問檢查中間件
 * 確保用戶只能訪問自己租戶的資源
 */
export const checkTenantAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 確保先驗證過身份
    if (!req.user) {
      return res.status(401).json({ 
        error: '未授權', 
        message: '請先登入' 
      });
    }
    
    // 超級管理員可以訪問任何租戶
    if (req.user.role === 'super_admin') {
      next();
      return;
    }
    
    // 確保用戶有租戶ID
    if (!req.user.tenantId) {
      return res.status(403).json({ 
        error: '權限不足', 
        message: '用戶未關聯到任何租戶' 
      });
    }
    
    // 檢查是否指定了租戶ID
    const tenantId = req.params.tenantId || req.query.tenantId || req.body.tenantId;
    
    if (tenantId && tenantId !== req.user.tenantId) {
      return res.status(403).json({ 
        error: '權限不足', 
        message: '無法訪問其他租戶的資源' 
      });
    }
    
    // 如果請求中沒有指定租戶ID，將用戶的租戶ID添加到res.locals
    res.locals.tenantId = req.user.tenantId;
    
    next();
  } catch (error) {
    console.error('[AUTH] 租戶訪問檢查過程中發生錯誤:', error);
    return res.status(500).json({ 
      error: '租戶訪問檢查失敗', 
      message: '租戶訪問檢查過程中發生內部錯誤' 
    });
  }
};

/**
 * Express 店鋪訪問檢查中間件
 * 確保用戶只能訪問自己店鋪的資源
 */
export const checkStoreAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 確保先驗證過身份
    if (!req.user) {
      return res.status(401).json({ 
        error: '未授權', 
        message: '請先登入' 
      });
    }
    
    // 首先確保有租戶訪問權限
    await checkTenantAccess(req, res, (err?: any) => {
      if (err) return next(err);
      
      // 超級管理員和租戶管理員可以訪問租戶內的任何店鋪
      if (req.user!.role === 'super_admin' || req.user!.role === 'tenant_admin') {
        next();
        return;
      }
      
      // 確保用戶有店鋪ID
      if (!req.user!.storeId) {
        return res.status(403).json({ 
          error: '權限不足', 
          message: '用戶未關聯到任何店鋪' 
        });
      }
      
      // 檢查是否指定了店鋪ID
      const storeId = req.params.storeId || req.query.storeId || req.body.storeId;
      
      if (storeId) {
        // 檢查是否是用戶的主要店鋪或額外店鋪
        const hasAccess = storeId === req.user!.storeId || 
                         (req.user!.additionalStoreIds && 
                          req.user!.additionalStoreIds.includes(storeId));
        
        if (!hasAccess) {
          return res.status(403).json({ 
            error: '權限不足', 
            message: '無法訪問非授權店鋪的資源' 
          });
        }
        
        // 將店鋪ID添加到res.locals
        res.locals.storeId = storeId;
      } else {
        // 如果請求中沒有指定店鋪ID，將用戶的主要店鋪ID添加到res.locals
        res.locals.storeId = req.user!.storeId;
      }
      
      next();
    });
  } catch (error) {
    console.error('[AUTH] 店鋪訪問檢查過程中發生錯誤:', error);
    return res.status(500).json({ 
      error: '店鋪訪問檢查失敗', 
      message: '店鋪訪問檢查過程中發生內部錯誤' 
    });
  }
};

/**
 * Express 可選身份驗證中間件
 * 如果提供了令牌則驗證並添加用戶資訊，如果沒有提供則繼續，不拒絕訪問
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 從請求頭或Cookie中獲取授權令牌
    const authHeader = req.headers.authorization;
    let idToken: string | undefined;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      idToken = authHeader.split('Bearer ')[1];
    } else if (req.cookies && req.cookies.__session) {
      // 從Cookie中獲取令牌
      idToken = req.cookies.__session;
    }
    
    // 沒有令牌，繼續請求但不添加用戶資訊
    if (!idToken) {
      next();
      return;
    }
    
    // 驗證令牌
    try {
      const decodedToken: DecodedIdToken = await admin.auth().verifyIdToken(idToken);
      
      // 獲取用戶資訊
      const userInfo = await getUserInfoFromClaims(decodedToken);
      
      if (userInfo) {
        // 將用戶資訊添加到請求對象
        req.user = userInfo;
        
        // 也添加到res.locals以便在其他中間件訪問
        res.locals.user = userInfo;
        res.locals.tenantId = userInfo.tenantId;
        res.locals.storeId = userInfo.storeId;
      }
      
      next();
    } catch (error) {
      // 令牌無效但不阻止請求，繼續處理
      console.warn('[AUTH] 可選令牌驗證失敗:', error);
      next();
    }
  } catch (error) {
    console.error('[AUTH] 可選身份驗證過程中發生錯誤:', error);
    // 不阻止請求，繼續處理
    next();
  }
};

/**
 * 測試環境下的模擬身份驗證中間件 (Express版)
 */
export const withMockExpressAuth = (req: Request, res: Response, next: NextFunction) => {
  // 只在測試環境中使用
  if (process.env.NODE_ENV !== 'test' && !process.env.FUNCTIONS_EMULATOR) {
    return res.status(403).json({
      error: '權限不足',
      message: '模擬身份驗證中間件只能在測試環境中使用'
    });
  }

  // 從請求頭或查詢參數中獲取模擬角色信息
  const mockRole = req.headers['x-mock-role'] || req.query.mockRole || process.env.MOCK_ROLE || 'staff';
  const mockTenantId = req.headers['x-mock-tenant-id'] || req.query.mockTenantId || process.env.MOCK_TENANT_ID || 'tenant-123';
  const mockStoreId = req.headers['x-mock-store-id'] || req.query.mockStoreId || process.env.MOCK_STORE_ID || 'store-123';
  const mockUid = req.headers['x-mock-uid'] || req.query.mockUid || process.env.MOCK_UID || 'test-user-123';

  // 驗證模擬角色類型
  const validatedRole = validateRoleType(mockRole.toString()) ? mockRole.toString() as RoleType : 'staff';
  
  // 對應的角色等級
  const roleLevel = RoleLevelMap[validatedRole] || 5; // 預設為一般員工的角色等級

  // 構建模擬用戶信息
  const userInfo: UserInfo = {
    uid: mockUid.toString(),
    role: validatedRole,
    roleLevel,
    tenantId: mockTenantId.toString(),
    storeId: mockStoreId.toString(),
    additionalStoreIds: [],
    permissions: {
      canDiscount: validatedRole === 'store_manager' || validatedRole === 'tenant_admin',
      canRefund: validatedRole === 'store_manager' || validatedRole === 'tenant_admin',
      canViewReports: validatedRole === 'store_manager' || validatedRole === 'tenant_admin'
    }
  };

  // 添加到請求對象和res.locals
  req.user = userInfo;
  res.locals.user = userInfo;
  res.locals.tenantId = userInfo.tenantId;
  res.locals.storeId = userInfo.storeId;

  next();
}; 