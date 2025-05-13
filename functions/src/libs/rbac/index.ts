/**
 * 吃雞排找不早系統 - RBAC函式庫
 * 主要API入口
 */

// 匯出所有類型定義
export * from './types';

// 匯出常量定義
export * from './constants';

// 匯出工具函數
export * from './utils';

// 匯出核心權限解析層功能
import { hasPermission, isRoleAtLeast, getMinimumRoleForAction } from './core/permissionResolver';
export { hasPermission, isRoleAtLeast, getMinimumRoleForAction };

// 匯出資料存取層功能
import { 
  getUserInfo, 
  getUserInfoFromClaims,

  getResourceInfo, 
  buildPermissionContext 
} from './services/dataAccess';
export { 
  getUserInfo, 
  getUserInfoFromClaims,
  getResourceInfo, 
  buildPermissionContext 
};

// 權限中間件 - 用於Firebase Functions
import * as functions from 'firebase-functions';
import { CallableContext, UserInfo, PermissionQuery } from './types';

/**
 * Firebase Functions請求權限檢查中間件
 * @param permissionCheck 權限檢查函數
 * @returns 包裝後的函數
 */
export function withPermissionCheck<T>(
  handler: (data: any, context: CallableContext, user: UserInfo) => Promise<T>,
  permissionCheck: (user: UserInfo) => Promise<boolean | PermissionQuery>
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
        console.error('無法獲取用戶權限資訊:', context.auth.uid);
        throw new functions.https.HttpsError(
          'permission-denied',
          '無法獲取用戶權限資訊，請確認帳號權限或重新登入'
        );
      }

      // 記錄用戶嘗試訪問的資源，方便故障排除
      if (process.env.NODE_ENV === 'development' || process.env.FUNCTIONS_EMULATOR === 'true') {
        console.log(`用戶 ${userInfo.uid} (角色: ${userInfo.role}) 嘗試訪問資源，租戶ID: ${userInfo.tenantId || 'N/A'}`);
      }

      // 執行權限檢查
      const checkResult = await permissionCheck(userInfo);
      
      // 如果檢查結果是布爾值
      if (typeof checkResult === 'boolean') {
        if (!checkResult) {
          throw new functions.https.HttpsError(
            'permission-denied',
            '您沒有執行此操作的權限'
          );
        }
      } 
      // 如果檢查結果是權限查詢
      else {
        // 構建上下文
        const context = await buildPermissionContext(
          checkResult.resource,
          checkResult.resourceId || '',
          data
        );

        // 檢查完整權限
        const permissionResult = await hasPermission(
          userInfo,
          checkResult,
          context
        );

        if (!permissionResult.granted) {
          console.warn(`權限拒絕: ${userInfo.uid} 嘗試 ${checkResult.action} ${checkResult.resource}${checkResult.resourceId ? (' - ' + checkResult.resourceId) : ''} - ${permissionResult.reason}`);
          throw new functions.https.HttpsError(
            'permission-denied',
            permissionResult.reason || '權限拒絕'
          );
        }
      }

      // 執行實際的處理邏輯
      return handler(data, context, userInfo);
    } catch (error) {
      // 處理權限檢查過程中的錯誤
      console.error('權限檢查過程中發生錯誤:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error; // 已經是格式化的錯誤，直接拋出
      }
      
      // 其他未知錯誤
      throw new functions.https.HttpsError(
        'internal',
        `權限檢查時發生內部錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  };
}

/**
 * 簡單的Express中間件，用於檢查HTTP請求的權限
 * @param permissionQuery 權限查詢
 * @returns Express中間件
 */
export function checkPermission(permissionQuery: PermissionQuery) {
  return async (req: any, res: any, next: any) => {
    try {
      // 檢查認證信息
      if (!req.user) {
        return res.status(401).json({ error: '需要登入才能執行此操作' });
      }

      // 獲取用戶資訊
      const userInfo = await getUserInfo(req.user.uid);
      
      if (!userInfo) {
        return res.status(403).json({ error: '無法獲取用戶權限資訊' });
      }

      // 構建權限上下文
      const context = await buildPermissionContext(
        permissionQuery.resource,
        permissionQuery.resourceId || '',
        req.body
      );

      // 檢查權限
      const permissionResult = await hasPermission(userInfo, permissionQuery, context);

      if (!permissionResult.granted) {
        return res.status(403).json({
          error: '權限拒絕',
          reason: permissionResult.reason
        });
      }

      // 將用戶資訊添加到請求中，方便後續使用
      req.userInfo = userInfo;
      
      // 權限檢查通過，繼續處理請求
      next();
    } catch (error) {
      console.error('權限檢查失敗:', error);
      res.status(500).json({ error: '權限檢查時發生錯誤' });
    }
  };
}

/**
 * 初始化RBAC函式庫（確保Firebase Admin已初始化）
 */
export function initRBAC() {
  // 檢查Firebase Admin是否已初始化
  try {
    const app = require('firebase-admin/app').getApp();
    if (!app) {
      throw new Error('Firebase Admin未初始化');
    }
    console.log('RBAC函式庫初始化成功');
  } catch (error) {
    console.error('RBAC函式庫初始化失敗:', error);
    throw new Error('請先初始化Firebase Admin SDK');
  }
} 