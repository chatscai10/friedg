/**
 * 租戶隔離中間件
 * 確保所有API請求都經過租戶隔離檢查，防止跨租戶數據訪問
 */

import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// 擴展Request類型，添加租戶上下文
export interface TenantRequest extends Request {
  tenantContext?: {
    tenantId: string;
    storeId?: string;
    role: string;
    roleLevel: number;
    uid: string;
  };
}

/**
 * 租戶隔離中間件
 * 從用戶令牌中提取租戶ID，並將其添加到請求上下文中
 * 如果請求嘗試訪問不屬於用戶租戶的資源，則拒絕請求
 */
export const tenantIsolation = () => {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
      // 檢查是否已經通過身份驗證
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: '未授權：請先登入'
        });
      }

      // 從Firebase Auth獲取用戶聲明
      const uid = req.user.uid;
      const userRecord = await admin.auth().getUser(uid);
      const customClaims = userRecord.customClaims || {};
      
      // 提取租戶ID和角色
      const tenantId = customClaims.tenantId;
      const storeId = customClaims.storeId;
      const role = customClaims.role || 'customer';
      const roleLevel = customClaims.roleLevel || 99; // 默認為最低權限
      
      // 超級管理員不受租戶隔離限制
      if (role === 'super_admin') {
        // 仍然設置上下文，但不強制租戶隔離
        req.tenantContext = {
          tenantId: 'system', // 超級管理員使用系統租戶
          role,
          roleLevel,
          uid
        };
        return next();
      }
      
      // 檢查是否有租戶ID
      if (!tenantId) {
        console.error(`用戶 ${uid} 缺少租戶ID`);
        return res.status(403).json({
          status: 'error',
          message: '拒絕訪問：用戶未關聯到任何租戶'
        });
      }
      
      // 設置租戶上下文
      req.tenantContext = {
        tenantId,
        storeId,
        role,
        roleLevel,
        uid
      };
      
      // 檢查URL參數中是否有tenantId，如果有，確保與用戶的tenantId匹配
      const urlTenantId = req.params.tenantId || req.query.tenantId;
      if (urlTenantId && urlTenantId !== tenantId && role !== 'super_admin') {
        console.warn(`租戶隔離違規：用戶 ${uid} (租戶 ${tenantId}) 嘗試訪問租戶 ${urlTenantId} 的資源`);
        return res.status(403).json({
          status: 'error',
          message: '拒絕訪問：您無權訪問其他租戶的資源'
        });
      }
      
      // 檢查請求體中是否有tenantId，如果有，確保與用戶的tenantId匹配
      if (req.body && req.body.tenantId && req.body.tenantId !== tenantId && role !== 'super_admin') {
        console.warn(`租戶隔離違規：用戶 ${uid} (租戶 ${tenantId}) 嘗試在請求體中使用租戶 ${req.body.tenantId}`);
        return res.status(403).json({
          status: 'error',
          message: '拒絕訪問：您無法在請求中使用其他租戶的ID'
        });
      }
      
      // 如果是店鋪管理員或員工，檢查storeId
      if (['store_manager', 'shift_leader', 'senior_staff', 'staff', 'trainee'].includes(role)) {
        const urlStoreId = req.params.storeId || req.query.storeId;
        if (urlStoreId && urlStoreId !== storeId) {
          console.warn(`店鋪隔離違規：用戶 ${uid} (店鋪 ${storeId}) 嘗試訪問店鋪 ${urlStoreId} 的資源`);
          return res.status(403).json({
            status: 'error',
            message: '拒絕訪問：您無權訪問其他店鋪的資源'
          });
        }
        
        // 檢查請求體中是否有storeId
        if (req.body && req.body.storeId && req.body.storeId !== storeId) {
          console.warn(`店鋪隔離違規：用戶 ${uid} (店鋪 ${storeId}) 嘗試在請求體中使用店鋪 ${req.body.storeId}`);
          return res.status(403).json({
            status: 'error',
            message: '拒絕訪問：您無法在請求中使用其他店鋪的ID'
          });
        }
      }
      
      // 通過所有檢查，繼續處理請求
      next();
    } catch (error) {
      console.error('租戶隔離中間件錯誤：', error);
      functions.logger.error('租戶隔離中間件錯誤', error);
      
      return res.status(500).json({
        status: 'error',
        message: '處理請求時發生錯誤',
        details: error.message
      });
    }
  };
};

/**
 * 強制添加租戶ID到請求體
 * 確保所有寫入操作都包含正確的租戶ID
 */
export const enforceTenantId = () => {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
      // 跳過GET和DELETE請求
      if (['GET', 'DELETE'].includes(req.method)) {
        return next();
      }
      
      // 確保請求有租戶上下文
      if (!req.tenantContext) {
        return res.status(500).json({
          status: 'error',
          message: '租戶上下文缺失，請確保先使用tenantIsolation中間件'
        });
      }
      
      // 超級管理員不強制添加租戶ID
      if (req.tenantContext.role === 'super_admin') {
        return next();
      }
      
      // 確保請求體存在
      if (!req.body) {
        req.body = {};
      }
      
      // 強制添加租戶ID
      req.body.tenantId = req.tenantContext.tenantId;
      
      // 如果用戶是店鋪級別的角色，也添加storeId
      if (['store_manager', 'shift_leader', 'senior_staff', 'staff', 'trainee'].includes(req.tenantContext.role) && req.tenantContext.storeId) {
        req.body.storeId = req.tenantContext.storeId;
      }
      
      next();
    } catch (error) {
      console.error('強制添加租戶ID中間件錯誤：', error);
      
      return res.status(500).json({
        status: 'error',
        message: '處理請求時發生錯誤',
        details: error.message
      });
    }
  };
};
