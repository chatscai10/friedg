/**
 * 超級管理後台 - 租戶管理相關處理函數
 */

import * as admin from 'firebase-admin';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { Tenant, TenantStatus, TenantStatusUpdateParams, TenantResponse } from '../types';
import { hasPermission } from '../../libs/rbac';
import { UserInfo, PermissionQuery } from '../../libs/rbac/types';

// Firestore 集合引用
const db = admin.firestore();
const tenantsCollection = db.collection('tenants');

/**
 * 使用 Zod 定義狀態更新請求的驗證模式
 */
const statusUpdateSchema = z.object({
  status: z.enum([
    TenantStatus.ACTIVE, 
    TenantStatus.INACTIVE, 
    TenantStatus.SUSPENDED, 
    TenantStatus.PENDING_APPROVAL, 
    TenantStatus.TRIAL, 
    TenantStatus.EXPIRED
  ]),
  reason: z.string().optional()
}).strict();

/**
 * 使用 Zod 定義篩選參數的驗證模式
 */
const filtersSchema = z.object({
  status: z.enum([
    TenantStatus.ACTIVE, 
    TenantStatus.INACTIVE, 
    TenantStatus.SUSPENDED, 
    TenantStatus.PENDING_APPROVAL, 
    TenantStatus.TRIAL, 
    TenantStatus.EXPIRED
  ]).optional(),
  plan: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  lastDoc: z.string().optional(),
}).strict();

/**
 * 檢查是否為超級管理員
 * 所有涉及租戶管理的函數都必須先經過此函數檢查權限
 */
const validateSuperAdminAccess = async (req: any): Promise<boolean> => {
  const requestingUser = req.user;
  
  if (!requestingUser) {
    console.error(`未授權：未提供身份驗證信息`);
    return false;
  }
  
  // 創建用戶信息對象
  const userInfo: UserInfo = {
    uid: requestingUser.uid,
    role: requestingUser.role,
    roleLevel: 0, // 超級管理員 
    tenantId: requestingUser.tenantId,
    storeId: requestingUser.storeId
  };
  
  // 創建權限查詢對象
  const permissionQuery: PermissionQuery = {
    action: 'read',
    resource: 'tenants'
  };
  
  const hasAccess = await hasPermission(
    userInfo,
    permissionQuery,
    {} // 空上下文
  );

  if (!hasAccess.granted) {
    console.warn(`未授權訪問嘗試：用戶 ${requestingUser.uid}（角色：${requestingUser.role}）嘗試訪問租戶管理API`);
    return false;
  }
  
  return true;
};

/**
 * 獲取租戶列表（支持狀態過濾）
 */
export const listTenantsForSuperAdmin = async (req: any, res: any) => {
  try {
    // 驗證超級管理員權限
    const isAuthorized = await validateSuperAdminAccess(req);
    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        errorCode: 'E401',
        message: '未授權：您沒有權限訪問租戶管理功能'
      });
    }
    
    // 驗證過濾參數
    const validationResult = filtersSchema.safeParse(req.query);
    
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'E400',
        message: `請求參數錯誤：${validationResult.error.errors[0].message}`
      });
    }
    
    const { status, plan, limit, lastDoc } = validationResult.data;
    
    // 構建查詢
    let query: any = tenantsCollection;
    
    // 應用狀態過濾
    if (status) {
      query = query.where('status', '==', status);
    }
    
    // 應用方案過濾
    if (plan) {
      query = query.where('plan', '==', plan);
    }
    
    // 添加排序（按更新時間降序）
    query = query.orderBy('updatedAt', 'desc');
    
    // 支持分頁
    if (lastDoc) {
      const lastDocSnapshot = await tenantsCollection.doc(lastDoc).get();
      if (!lastDocSnapshot.exists) {
        return res.status(400).json({
          status: 'error',
          errorCode: 'E400',
          message: '無效的分頁參考點'
        });
      }
      query = query.startAfter(lastDocSnapshot);
    }
    
    // 限制結果數量
    query = query.limit(limit);
    
    // 執行查詢
    const tenantsSnapshot = await query.get();
    
    if (tenantsSnapshot.empty) {
      return res.status(200).json({
        status: 'success',
        data: [],
        message: '沒有符合條件的租戶'
      });
    }
    
    // 處理查詢結果
    const tenants: Tenant[] = [];
    let lastVisible: any = null;
    
    tenantsSnapshot.forEach((doc: any) => {
      const tenant = doc.data();
      
      // 將 Firestore Timestamp 轉換為 ISO 日期字符串
      const formattedTenant = {
        ...tenant,
        id: doc.id,
        createdAt: tenant.createdAt?.toDate().toISOString() || null,
        updatedAt: tenant.updatedAt?.toDate().toISOString() || null,
        lastLoginAt: tenant.lastLoginAt?.toDate().toISOString() || null,
        planExpiryDate: tenant.planExpiryDate?.toDate().toISOString() || null
      };
      
      tenants.push(formattedTenant as Tenant);
      lastVisible = doc;
    });
    
    // 構建響應
    const response: TenantResponse = {
      status: 'success',
      data: tenants,
      message: `成功檢索 ${tenants.length} 個租戶`
    };
    
    // 添加分頁信息
    if (lastVisible) {
      Object.assign(response, {
        pagination: {
          lastDoc: lastVisible.id,
          hasMore: tenants.length === limit
        }
      });
    }
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('獲取租戶列表時出錯:', error);
    return res.status(500).json({
      status: 'error',
      errorCode: 'E500',
      message: '獲取租戶列表時發生系統內部錯誤'
    });
  }
};

/**
 * 獲取單一租戶詳情
 */
export const getTenantDetailsForSuperAdmin = async (req: any, res: any) => {
  try {
    // 驗證超級管理員權限
    const isAuthorized = await validateSuperAdminAccess(req);
    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        errorCode: 'E401',
        message: '未授權：您沒有權限訪問租戶管理功能'
      });
    }
    
    // 獲取租戶ID
    const tenantId = req.params.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'E400',
        message: '缺少租戶ID參數'
      });
    }
    
    // 獲取租戶文檔
    const tenantRef = tenantsCollection.doc(tenantId);
    const tenantDoc = await tenantRef.get();
    
    if (!tenantDoc.exists) {
      return res.status(404).json({
        status: 'error',
        errorCode: 'E404',
        message: `未找到ID為 ${tenantId} 的租戶`
      });
    }
    
    // 獲取租戶數據並格式化日期
    const tenantData = tenantDoc.data();
    const tenant: Tenant = {
      ...tenantData as any,
      id: tenantDoc.id,
      createdAt: tenantData!.createdAt?.toDate() || new Date(),
      updatedAt: tenantData!.updatedAt?.toDate() || new Date(),
      lastLoginAt: tenantData!.lastLoginAt?.toDate() || undefined,
      planExpiryDate: tenantData!.planExpiryDate?.toDate() || undefined
    };
    
    return res.status(200).json({
      status: 'success',
      data: tenant,
      message: '成功檢索租戶詳情'
    });
    
  } catch (error) {
    console.error('獲取租戶詳情時出錯:', error);
    return res.status(500).json({
      status: 'error',
      errorCode: 'E500',
      message: '獲取租戶詳情時發生系統內部錯誤'
    });
  }
};

/**
 * 由超級管理員更新租戶狀態
 */
export const updateTenantStatusBySuperAdmin = async (req: any, res: any) => {
  try {
    // 驗證超級管理員權限
    const isAuthorized = await validateSuperAdminAccess(req);
    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        errorCode: 'E401',
        message: '未授權：您沒有權限訪問租戶管理功能'
      });
    }
    
    // 獲取租戶ID
    const tenantId = req.params.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'E400',
        message: '缺少租戶ID參數'
      });
    }
    
    // 驗證請求體
    const validationResult = statusUpdateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'E400',
        message: `請求參數錯誤：${validationResult.error.errors[0].message}`
      });
    }
    
    const updateData = validationResult.data;
    
    // 獲取租戶文檔
    const tenantRef = tenantsCollection.doc(tenantId);
    const tenantDoc = await tenantRef.get();
    
    if (!tenantDoc.exists) {
      return res.status(404).json({
        status: 'error',
        errorCode: 'E404',
        message: `未找到ID為 ${tenantId} 的租戶`
      });
    }
    
    // 記錄操作用戶信息
    const requestingUser = req.user;
    
    // 使用事務進行狀態更新
    await db.runTransaction(async (transaction) => {
      // 準備更新數據
      const updatePayload: any = {
        status: updateData.status,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: requestingUser.uid
      };
      
      // 如果提供了原因，則添加到更新數據中
      if (updateData.status === TenantStatus.SUSPENDED && updateData.reason) {
        updatePayload.suspensionReason = updateData.reason;
      } else if (updateData.status !== TenantStatus.SUSPENDED) {
        // 如果狀態不是 suspended，則清除 suspensionReason
        updatePayload.suspensionReason = null;
      }
      
      // 執行更新
      transaction.update(tenantRef, updatePayload);
    });
    
    // 獲取更新後的租戶數據
    const updatedTenantDoc = await tenantRef.get();
    const updatedTenantData = updatedTenantDoc.data();
    
    return res.status(200).json({
      status: 'success',
      message: `成功更新租戶 ${updatedTenantData!.name} 的狀態為 ${updateData.status}`,
      data: {
        id: updatedTenantDoc.id,
        ...updatedTenantData,
        updatedAt: updatedTenantData!.updatedAt.toDate().toISOString()
      }
    });
    
  } catch (error) {
    console.error('更新租戶狀態時出錯:', error);
    return res.status(500).json({
      status: 'error',
      errorCode: 'E500',
      message: '更新租戶狀態時發生系統內部錯誤'
    });
  }
}; 