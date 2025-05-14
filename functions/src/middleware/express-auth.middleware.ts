/**
 * 吃雞排找不早系統 - Express 風格的身份驗證中間件
 * 為 Express 路由提供身份驗證和授權功能
 */

import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { RoleLevelMap, RoleType } from '../libs/rbac/types';
import { getUserInfoFromClaims, UserInfo } from '../libs/rbac';
import { validateRoleType } from '../libs/rbac/utils/validators';

// 擴展Express Request類型，添加user屬性
declare global {
  namespace Express {
    interface Request {
      user?: UserInfo;
    }
  }
}

/**
 * Express 風格的身份驗證中間件
 * 從 Bearer Token 中提取用戶信息並設置到 req.user
 */
export const authenticateRequest = async (
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
};

/**
 * Express 風格的角色授權中間件
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

/**
 * Express 風格的租戶隔離中間件
 * 確保用戶只能訪問自己租戶的資源
 */
export const enforceTenantIsolation = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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

    // 超級管理員可以訪問任何租戶
    if (user.role === 'super_admin') {
      return next();
    }

    // 確保用戶有租戶ID
    if (!user.tenantId) {
      return res.status(403).json({
        success: false,
        message: '用戶未關聯到任何租戶',
        errorCode: 'NO_TENANT_ASSOCIATION'
      });
    }

    // 檢查請求數據中是否有租戶ID，如果有則必須與用戶租戶ID匹配
    const requestTenantId = req.body.tenantId || req.query.tenantId as string;
    if (requestTenantId && requestTenantId !== user.tenantId) {
      return res.status(403).json({
        success: false,
        message: '無法訪問其他租戶的資源',
        errorCode: 'TENANT_ISOLATION_VIOLATION'
      });
    }

    // 將用戶的租戶ID注入到請求中（如果尚未存在）
    if (!req.body.tenantId) {
      req.body.tenantId = user.tenantId;
    }
    if (!req.query.tenantId) {
      req.query.tenantId = user.tenantId;
    }

    next();
  } catch (error) {
    console.error('[AUTH] 租戶隔離檢查發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '處理租戶隔離時發生內部錯誤',
      errorCode: 'TENANT_ISOLATION_ERROR'
    });
  }
};

/**
 * Express 風格的店鋪隔離中間件
 * 確保用戶只能訪問自己店鋪的資源
 */
export const enforceStoreIsolation = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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

    // 租戶管理員和超級管理員可以訪問租戶內的任何店鋪
    if (user.role === 'super_admin' || user.role === 'tenant_admin') {
      return next();
    }

    // 確保用戶有店鋪ID
    if (!user.storeId) {
      return res.status(403).json({
        success: false,
        message: '用戶未關聯到任何店鋪',
        errorCode: 'NO_STORE_ASSOCIATION'
      });
    }

    // 檢查請求數據中是否有店鋪ID
    const requestStoreId = req.body.storeId || req.query.storeId as string;
    if (requestStoreId) {
      // 檢查是否是用戶的主要店鋪或額外店鋪
      const hasAccess = requestStoreId === user.storeId ||
                        (user.additionalStoreIds &&
                         user.additionalStoreIds.includes(requestStoreId));

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: '無權訪問非授權店鋪的資源',
          errorCode: 'STORE_ISOLATION_VIOLATION'
        });
      }
    } else {
      // 如果請求中沒有指定店鋪ID，使用用戶的主要店鋪ID
      req.body.storeId = user.storeId;
      req.query.storeId = user.storeId;
    }

    next();
  } catch (error) {
    console.error('[AUTH] 店鋪隔離檢查發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '處理店鋪隔離時發生內部錯誤',
      errorCode: 'STORE_ISOLATION_ERROR'
    });
  }
};
