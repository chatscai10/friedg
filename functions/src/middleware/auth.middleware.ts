/**
 * 吃雞排找不早系統 - 身份驗證中間件
 * 增強版身份驗證中間件，利用RBAC函式庫進行權限管理
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { CallableContext, RoleLevelMap, RoleType } from '../libs/rbac/types';
import { getUserInfoFromClaims, UserInfo } from '../libs/rbac';
import { validateRoleType, validateResourceType, validateActionType } from '../libs/rbac/utils/validators';
import { Request, Response, NextFunction } from 'express';
import { auth } from 'firebase-admin';
import { UserContext } from '../employees/employee.types';

// 擴展Express Request類型，添加user屬性
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * 增強版身份驗證中間件
 *
 * 這個中間件不僅檢查用戶是否已登入，還會驗證用戶的角色和租戶關係
 * @param handler 處理函數
 * @returns 包裝後的函數
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
 * 租戶隔離中間件
 *
 * 這個中間件確保用戶只能訪問自己租戶的資源
 * @param handler 處理函數
 * @returns 包裝後的函數
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
 * 店鋪隔離中間件
 *
 * 這個中間件確保用戶只能訪問自己店鋪的資源
 * @param handler 處理函數
 * @returns 包裝後的函數
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
 * 角色要求中間件
 *
 * 這個中間件確保用戶具有指定的角色才能執行操作
 * @param requiredRole 所需角色
 * @param handler 處理函數
 * @returns 包裝後的函數
 */
export function withRole<T>(
  requiredRole: string,
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
 * 測試環境下的模擬身份驗證中間件
 *
 * 這個中間件用於測試環境，允許通過設置環境變數模擬不同角色
 * @param handler 處理函數
 * @returns 包裝後的函數
 */
export function withMockAuthentication<T>(
  handler: (data: any, context: CallableContext, user: UserInfo) => Promise<T>
): (data: any, context: CallableContext) => Promise<T> {
  return async (data: any, context: CallableContext) => {
    // 只在測試環境中使用
    if (process.env.NODE_ENV !== 'test' && !process.env.FUNCTIONS_EMULATOR) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        '模擬身份驗證中間件只能在測試環境中使用'
      );
    }

    // 從環境變數或請求頭中獲取模擬角色信息
    // 優先從請求中獲取，允許單個測試定制不同身份
    const mockRole = data?.__mockRole || process.env.MOCK_ROLE || 'staff';
    const mockTenantId = data?.__mockTenantId || process.env.MOCK_TENANT_ID || 'tenant-123';
    const mockStoreId = data?.__mockStoreId || process.env.MOCK_STORE_ID || 'store-123';
    const mockUid = data?.__mockUid || process.env.MOCK_UID || 'test-user-123';
    const mockAdditionalStoreIds = data?.__mockAdditionalStoreIds ||
                                  (process.env.MOCK_ADDITIONAL_STORE_IDS ?
                                   process.env.MOCK_ADDITIONAL_STORE_IDS.split(',') :
                                   []);

    // 移除測試用特殊屬性，避免影響業務邏輯
    if (data) {
      delete data.__mockRole;
      delete data.__mockTenantId;
      delete data.__mockStoreId;
      delete data.__mockUid;
      delete data.__mockAdditionalStoreIds;
    }

    // 驗證模擬角色類型
    const validatedRole = validateRoleType(mockRole) ? mockRole as RoleType : 'staff';

    // 對應的角色等級
    const roleLevel = RoleLevelMap[validatedRole] || 5; // 預設為一般員工的角色等級

    // 構建模擬用戶信息
    const userInfo: UserInfo = {
      uid: mockUid,
      role: validatedRole,
      roleLevel,
      tenantId: mockTenantId,
      storeId: mockStoreId,
      additionalStoreIds: mockAdditionalStoreIds,
      permissions: {
        canDiscount: mockRole === 'store_manager' || mockRole === 'tenant_admin',
        canRefund: mockRole === 'store_manager' || mockRole === 'tenant_admin',
        maxDiscountPercentage: mockRole === 'tenant_admin' ? 100 : (mockRole === 'store_manager' ? 50 : 0)
      }
    };

    // 記錄模擬身份使用情況，便於調試
    console.log(`[TEST] 使用模擬身份: ${mockUid}, 角色: ${validatedRole}, 租戶: ${mockTenantId}, 店鋪: ${mockStoreId}`);

    // 使用模擬用戶信息執行處理函數
    try {
      return await handler(data, context, userInfo);
    } catch (error) {
      console.error('[MOCK-AUTH] 處理過程中發生錯誤:', error instanceof Error ? error.message : error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        `內部錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  };
}

// Express 風格的中間件實現（RESTful API 使用）

/**
 * 從 Bearer Token 中提取用戶信息並設置到 req.user
 */
export const withExpressAuthentication = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 如果沒有授權頭，跳過驗證（交給後續邏輯處理）
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: '未提供授權憑證',
      errorCode: 'MISSING_AUTH_TOKEN'
    });
  }

  // 檢查授權格式
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: '授權格式錯誤',
      errorCode: 'INVALID_AUTH_FORMAT'
    });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // 驗證 token
    const decodedToken = await auth().verifyIdToken(token);

    // 從解碼的令牌中獲取用戶信息
    const userInfo = await getUserInfoFromClaims(decodedToken);

    if (!userInfo) {
      console.error(`[AUTH] 找不到用戶資訊 (UID: ${decodedToken.uid})`);
      return res.status(403).json({
        success: false,
        message: '無法獲取用戶權限資訊，請確認帳號權限或重新登入',
        errorCode: 'USER_INFO_NOT_FOUND'
      });
    }

    // 將用戶信息附加到請求對象上
    req.user = userInfo;

    // 轉到下一個中間件
    next();
  } catch (error) {
    console.error('[AUTH] 令牌驗證失敗:', error);
    return res.status(401).json({
      success: false,
      message: '授權憑證無效或已過期',
      errorCode: 'INVALID_AUTH_TOKEN'
    });
  }
};

/**
 * Express風格的角色檢查中間件
 * 用於RESTful API路由，確保用戶具有所需的角色
 * @param requiredRole 所需的角色
 * @deprecated 推薦使用新的withRole風格的中間件
 */
export const checkRole = (requiredRole: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 檢查是否已經過身份驗證
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: '需要先進行身份驗證' });
      }

      // 驗證所需角色是否有效
      if (!validateRoleType(requiredRole)) {
        return res.status(400).json({ error: `角色類型 '${requiredRole}' 無效` });
      }

      // 檢查用戶角色等級是否足夠
      const userRoleLevel = user.roleLevel;
      const requiredRoleLevel = RoleLevelMap[requiredRole as RoleType];

      if (userRoleLevel > requiredRoleLevel) { // 角色等級數字越小，權限越高
        return res.status(403).json({ error: `此操作需要 '${requiredRole}' 或更高權限的角色` });
      }

      // 角色檢查通過，繼續處理
      next();
    } catch (error) {
      console.error('[AUTH] 角色驗證過程中發生錯誤:', error);
      return res.status(500).json({ error: '處理角色驗證時發生內部錯誤' });
    }
  };
};

/**
 * Express風格的租戶隔離中間件
 * 用於RESTful API路由，確保用戶只能訪問自己租戶的資源
 * @deprecated 推薦使用新的withTenantIsolation風格的中間件
 */
export const checkTenantAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 檢查是否已經過身份驗證
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: '需要先進行身份驗證' });
    }

    // 超級管理員可以訪問任何租戶
    if (user.role === 'super_admin') {
      return next();
    }

    // 確定目標租戶ID
    const targetTenantId = req.body.tenantId || req.query.tenantId as string || user.tenantId;

    // 如果請求中沒有租戶ID，且用戶也沒有關聯租戶，則拒絕訪問
    if (!targetTenantId) {
      return res.status(403).json({ error: '訪問被拒絕: 缺少租戶資訊' });
    }

    // 確保用戶有租戶ID
    if (!user.tenantId) {
      return res.status(403).json({ error: '用戶未關聯到任何租戶' });
    }

    // 檢查用戶是否屬於目標租戶
    if (user.tenantId !== targetTenantId) {
      return res.status(403).json({ error: '無法訪問其他租戶的資源' });
    }

    // 將目標租戶ID添加到請求中
    (req as any).targetTenantId = targetTenantId;

    // 租戶檢查通過，繼續處理
    next();
  } catch (error) {
    console.error('[AUTH] 租戶訪問檢查發生錯誤:', error);
    return res.status(500).json({ error: '處理租戶訪問權限時發生內部錯誤' });
  }
};

/**
 * Express風格的店鋪隔離中間件
 * 用於RESTful API路由，確保用戶只能訪問自己店鋪的資源
 * @deprecated 推薦使用新的withStoreIsolation風格的中間件
 */
export const checkStoreAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 檢查是否已經過身份驗證
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: '需要先進行身份驗證' });
    }

    // 確定目標店鋪ID
    const targetStoreId = req.body.storeId || req.query.storeId as string || user.storeId;

    // 如果請求中沒有店鋪ID，且用戶也沒有關聯店鋪，則拒絕訪問
    if (!targetStoreId) {
      return res.status(403).json({ error: '訪問被拒絕: 缺少店鋪資訊' });
    }

    // 租戶管理員和超級管理員可以訪問租戶內的任何店鋪
    if (user.role === 'super_admin' || user.role === 'tenant_admin') {
      // 如果是租戶管理員，需要檢查目標店鋪是否在同一租戶內
      if (user.role === 'tenant_admin') {
        try {
          const storeDoc = await admin.firestore().collection('stores').doc(targetStoreId).get();

          if (!storeDoc.exists) {
            return res.status(404).json({ error: '找不到指定的店鋪' });
          }

          const storeData = storeDoc.data();
          if (storeData && storeData.tenantId !== user.tenantId) {
            return res.status(403).json({ error: '租戶管理員無法訪問其他租戶的店鋪' });
          }
        } catch (error) {
          console.error('檢查店鋪所屬租戶時發生錯誤:', error);
          return res.status(500).json({ error: '處理訪問權限時發生內部錯誤' });
        }
      }

      // 將目標店鋪ID添加到請求中
      (req as any).targetStoreId = targetStoreId;
      return next();
    }

    // 確保用戶有店鋪ID
    if (!user.storeId) {
      return res.status(403).json({ error: '用戶未關聯到任何店鋪' });
    }

    // 檢查是否是用戶的主要店鋪或額外店鋪
    const hasAccess = targetStoreId === user.storeId ||
                      (user.additionalStoreIds &&
                       user.additionalStoreIds.includes(targetStoreId));

    if (!hasAccess) {
      return res.status(403).json({ error: '無權訪問非授權店鋪的資源' });
    }

    // 將目標店鋪ID添加到請求中
    (req as any).targetStoreId = targetStoreId;

    // 店鋪檢查通過，繼續處理
    next();
  } catch (error) {
    console.error('[AUTH] 店鋪訪問檢查發生錯誤:', error);
    return res.status(500).json({ error: '處理店鋪訪問權限時發生內部錯誤' });
  }
};

/**
 * 可選身份驗證中間件
 * 如果用戶已登入，則設置req.user；如果未登入，則繼續執行
 * 主要用於支持同時支持已登入和匿名用戶的端點
 * @param req Express請求對象
 * @param res Express響應對象
 * @param next 下一個中間件函數
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // 無認證頭或格式不正確，視為匿名用戶
      req.user = undefined;
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      // 無令牌，視為匿名用戶
      req.user = undefined;
      return next();
    }

    try {
      // 嘗試驗證令牌
      const decodedToken = await admin.auth().verifyIdToken(token);

      // 設置用戶信息
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.role || 'customer',
        tenantId: decodedToken.tenantId,
        // 如果是客戶，直接使用uid作為customerId
        ...(decodedToken.role === 'customer' && { customerId: decodedToken.uid })
      };

    } catch (error) {
      // 令牌驗證失敗，視為匿名用戶
      req.user = undefined;
    }

    return next();

  } catch (error) {
    // 發生異常，視為匿名用戶
    req.user = undefined;
    return next();
  }
};

/**
 * 身份驗證中間件 - 用於 Express 路由
 * 驗證請求中的 JWT 令牌並設置 req.user
 * @param req Express 請求對象
 * @param res Express 響應對象
 * @param next 下一個中間件函數
 */
export const authenticateRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 檢查授權頭
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '未提供有效的授權憑證',
        errorCode: 'MISSING_AUTH_TOKEN'
      });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      // 驗證 token
      const decodedToken = await admin.auth().verifyIdToken(token);

      // 從解碼的令牌中獲取用戶信息
      const userInfo = await getUserInfoFromClaims(decodedToken);

      if (!userInfo) {
        console.error(`[AUTH] 找不到用戶資訊 (UID: ${decodedToken.uid})`);
        return res.status(403).json({
          success: false,
          message: '無法獲取用戶權限資訊，請確認帳號權限或重新登入',
          errorCode: 'USER_INFO_NOT_FOUND'
        });
      }

      // 將用戶信息附加到請求對象上
      req.user = userInfo;

      // 轉到下一個中間件
      next();
    } catch (error) {
      console.error('[AUTH] 令牌驗證失敗:', error);
      return res.status(401).json({
        success: false,
        message: '授權憑證無效或已過期',
        errorCode: 'INVALID_AUTH_TOKEN'
      });
    }
  } catch (error) {
    console.error('[AUTH] 身份驗證過程中發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '處理身份驗證時發生內部錯誤',
      errorCode: 'AUTH_INTERNAL_ERROR'
    });
  }
};

/**
 * 角色授權中間件 - 用於 Express 路由
 * 確保用戶具有指定的角色才能訪問路由
 * @param roles 允許的角色列表
 */
export const authorizeRoles = (roles: RoleType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 檢查是否已經過身份驗證
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: '需要先進行身份驗證',
          errorCode: 'AUTHENTICATION_REQUIRED'
        });
      }

      // 檢查用戶角色是否在允許的角色列表中
      if (!roles.includes(user.role as RoleType)) {
        return res.status(403).json({
          success: false,
          message: `此操作需要以下角色之一: ${roles.join(', ')}`,
          errorCode: 'INSUFFICIENT_ROLE'
        });
      }

      // 角色檢查通過，繼續處理
      next();
    } catch (error) {
      console.error('[AUTH] 角色授權過程中發生錯誤:', error);
      return res.status(500).json({
        success: false,
        message: '處理角色授權時發生內部錯誤',
        errorCode: 'AUTHORIZATION_INTERNAL_ERROR'
      });
    }
  };
};