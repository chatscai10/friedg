/**
 * 租戶訪問檢查中間件
 */
import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { hasPermission } from '../libs/rbac';
import { UserInfo, PermissionQuery, ActionType, ResourceType } from '../libs/rbac/types';
import { UserContext } from '../employees/employee.types';

/**
 * 檢查使用者是否有租戶訪問權限
 * 用於確保使用者只能訪問其所屬租戶的資源
 */
export const checkTenantAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 獲取使用者資訊 (已由 checkAuth 中間件添加)
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: '未授權: 需要用戶認證',
        errorCode: 'AUTH_REQUIRED'
      });
    }
    
    // 確定目標租戶ID
    const targetTenantId = req.body.tenantId || req.query.tenantId as string || user.tenantId;
    
    // 如果請求中沒有租戶ID，且用戶也沒有關聯租戶，則拒絕訪問
    if (!targetTenantId) {
      return res.status(403).json({
        status: 'error',
        message: '訪問被拒絕: 缺少租戶資訊',
        errorCode: 'NO_TENANT_SPECIFIED'
      });
    }
    
    // 如果使用者擁有超級管理員權限，則允許訪問任何租戶
    if (user.role === 'super_admin') {
      // 將目標租戶ID添加到請求中，供後續處理函數使用
      (req as any).targetTenantId = targetTenantId;
      return next();
    }
    
    // 檢查使用者是否屬於目標租戶
    if (user.tenantId !== targetTenantId) {
      return res.status(403).json({
        status: 'error',
        message: '訪問被拒絕: 您無權訪問此租戶的資源',
        errorCode: 'TENANT_ACCESS_DENIED'
      });
    }
    
    // 創建使用者資訊物件，用於權限檢查
    const userInfo: UserInfo = {
      uid: user.uid,
      role: user.role,
      roleLevel: user.roleLevel || 0,
      tenantId: user.tenantId,
      storeId: user.storeId
    };
    
    // 創建權限查詢物件
    const permissionQuery: PermissionQuery = {
      action: req.method === 'GET' ? 'read' : 'write' as ActionType,
      resource: 'tenantData' as ResourceType
    };
    
    // 檢查使用者是否具有必要的權限
    const hasAccess = await hasPermission(
      userInfo, 
      permissionQuery, 
      { tenantId: targetTenantId }
    );
    
    if (!hasAccess.granted) {
      return res.status(403).json({
        status: 'error',
        message: `訪問被拒絕: ${hasAccess.reason || '您沒有必要的權限'}`,
        errorCode: 'PERMISSION_DENIED'
      });
    }
    
    // 將目標租戶ID添加到請求中，供後續處理函數使用
    (req as any).targetTenantId = targetTenantId;
    
    // 如果一切正常，繼續處理請求
    next();
  } catch (error) {
    console.error('租戶訪問檢查發生錯誤:', error);
    return res.status(500).json({
      status: 'error',
      message: '處理訪問權限時發生內部錯誤',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

/**
 * 檢查使用者是否有商店訪問權限
 * 用於確保使用者只能訪問其所屬商店的資源
 */
export const checkStoreAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 獲取使用者資訊 (已由 checkAuth 中間件添加)
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: '未授權: 需要用戶認證',
        errorCode: 'AUTH_REQUIRED'
      });
    }
    
    // 確定目標商店ID
    const targetStoreId = req.body.storeId || req.query.storeId as string || user.storeId;
    
    // 如果請求中沒有商店ID，且用戶也沒有關聯商店，則拒絕訪問
    if (!targetStoreId) {
      return res.status(403).json({
        status: 'error',
        message: '訪問被拒絕: 缺少商店資訊',
        errorCode: 'NO_STORE_SPECIFIED'
      });
    }
    
    // 如果使用者擁有超級管理員權限，則允許訪問任何商店
    if (user.role === 'super_admin') {
      // 將目標商店ID添加到請求中，供後續處理函數使用
      (req as any).targetStoreId = targetStoreId;
      return next();
    }
    
    // 如果使用者是租戶管理員，則允許訪問同一租戶下的任何商店
    if (user.role === 'tenant_admin') {
      // 檢查目標商店是否屬於用戶的租戶
      try {
        const storeRef = admin.firestore().collection('stores').doc(targetStoreId);
        const storeDoc = await storeRef.get();
        
        if (!storeDoc.exists) {
          return res.status(404).json({
            status: 'error',
            message: '找不到指定的商店',
            errorCode: 'STORE_NOT_FOUND'
          });
        }
        
        const storeData = storeDoc.data();
        if (storeData && storeData.tenantId === user.tenantId) {
          // 將目標商店ID添加到請求中，供後續處理函數使用
          (req as any).targetStoreId = targetStoreId;
          return next();
        } else if (storeData && storeData.tenantId !== user.tenantId) {
          return res.status(403).json({
            status: 'error',
            message: '訪問被拒絕: 租戶管理員無權訪問其他租戶的商店',
            errorCode: 'TENANT_MISMATCH_FOR_STORE'
          });
        }
      } catch (error) {
        console.error('檢查商店所屬租戶時發生錯誤:', error);
        return res.status(500).json({
          status: 'error',
          message: '處理訪問權限時發生內部錯誤',
          errorCode: 'INTERNAL_ERROR'
        });
      }
    }
    
    // 檢查使用者是否屬於目標商店
    if (user.storeId !== targetStoreId) {
      return res.status(403).json({
        status: 'error',
        message: '訪問被拒絕: 您無權訪問此商店的資源',
        errorCode: 'STORE_ACCESS_DENIED'
      });
    }
    
    // 創建使用者資訊物件，用於權限檢查
    const userInfo: UserInfo = {
      uid: user.uid,
      role: user.role,
      roleLevel: user.roleLevel || 0,
      tenantId: user.tenantId,
      storeId: user.storeId
    };
    
    // 創建權限查詢物件
    const permissionQuery: PermissionQuery = {
      action: req.method === 'GET' ? 'read' : 'write' as ActionType,
      resource: 'storeData' as ResourceType
    };
    
    // 檢查使用者是否具有必要的權限
    const hasAccess = await hasPermission(
      userInfo, 
      permissionQuery, 
      { tenantId: user.tenantId, storeId: targetStoreId }
    );
    
    if (!hasAccess.granted) {
      return res.status(403).json({
        status: 'error',
        message: `訪問被拒絕: ${hasAccess.reason || '您沒有必要的權限'}`,
        errorCode: 'PERMISSION_DENIED'
      });
    }
    
    // 將目標商店ID添加到請求中，供後續處理函數使用
    (req as any).targetStoreId = targetStoreId;
    
    // 如果一切正常，繼續處理請求
    next();
  } catch (error) {
    console.error('商店訪問檢查發生錯誤:', error);
    return res.status(500).json({
      status: 'error',
      message: '處理訪問權限時發生內部錯誤',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

/**
 * 租戶隔離中間件
 * 確保用戶只能訪問自己租戶的數據
 */
export const withTenantIsolation = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 獲取用戶上下文 (由 withAuthentication 中間件設置)
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }

    // 檢查租戶 ID
    const tenantId = user.tenantId;
    if (!tenantId) {
      console.error(`關鍵錯誤：請求用戶 ${user.uid} 缺少 tenantId claim`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：請求用戶上下文無效（缺少 tenantId）'
      });
    }

    // 檢查請求體中的 tenantId (如果有) 是否與用戶的 tenantId 匹配
    if (req.body && req.body.tenantId && req.body.tenantId !== tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試訪問其他租戶的數據`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法訪問其他租戶的數據'
      });
    }

    // 將租戶 ID 添加到請求中，供後續處理使用
    req.tenantId = tenantId;
    next();
  } catch (error: any) {
    console.error('租戶隔離檢查失敗：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '處理請求時發生錯誤'
    });
  }
};

/**
 * 店鋪隔離中間件
 * 確保店鋪管理員只能訪問自己管理的店鋪數據
 */
export const withStoreIsolation = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }

    // 如果不是店鋪管理員，直接通過
    if (user.role !== 'store_manager') {
      return next();
    }

    // 店鋪管理員必須有 storeId
    if (!user.storeId) {
      console.error(`關鍵錯誤：店鋪管理員 ${user.uid} 缺少 storeId claim`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：店鋪管理員缺少有效的店鋪信息'
      });
    }

    // 檢查請求中的 storeId 參數 (如果有)
    const requestStoreId = req.params.storeId || req.query.storeId || (req.body && req.body.storeId);
    
    if (requestStoreId && typeof requestStoreId === 'string') {
      const isManagerStore = user.storeId === requestStoreId;
      const isAdditionalStore = user.additionalStoreIds && 
                               Array.isArray(user.additionalStoreIds) && 
                               user.additionalStoreIds.includes(requestStoreId);
      
      if (!isManagerStore && !isAdditionalStore) {
        console.warn(`店鋪隔離違規：店鋪管理員 ${user.uid} 嘗試訪問非管理店鋪的數據`);
        return res.status(403).json({
          status: 'error',
          message: '未授權：您只能訪問自己管理的店鋪數據'
        });
      }
    }

    // 將店鋪 ID 添加到請求中，供後續處理使用
    req.storeId = user.storeId;
    req.additionalStoreIds = user.additionalStoreIds;
    next();
  } catch (error: any) {
    console.error('店鋪隔離檢查失敗：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '處理請求時發生錯誤'
    });
  }
};

/**
 * 角色檢查中間件
 * 確保用戶具有所需的角色權限
 * @param roles 允許的角色列表
 */
export const withRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 獲取用戶上下文
      const user = req.user as UserContext;
      if (!user) {
        console.error('未授權：缺少有效的用戶上下文');
        return res.status(401).json({
          status: 'error',
          message: '未授權：缺少有效的用戶憑證'
        });
      }

      // 檢查用戶角色
      const userRole = user.role;
      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      
      // 系統管理員總是有權限
      if (userRole === 'super_admin') {
        return next();
      }

      // 檢查用戶是否具有允許的角色之一
      if (!allowedRoles.includes(userRole)) {
        console.warn(`權限拒絕：用戶 ${user.uid} 角色 ${userRole} 嘗試執行需要 ${allowedRoles.join('/')} 角色的操作`);
        return res.status(403).json({
          status: 'error',
          message: '未授權：您沒有執行此操作的權限'
        });
      }

      next();
    } catch (error: any) {
      console.error('角色權限檢查失敗：', error);
      return res.status(500).json({
        status: 'error',
        message: error.message || '處理請求時發生錯誤'
      });
    }
  };
}; 