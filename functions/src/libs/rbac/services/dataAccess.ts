/**
 * 吃雞排找不早系統 - RBAC函式庫
 * 資料存取層(Data Access Layer)
 */

import * as admin from 'firebase-admin';
import { 
  UserInfo, 
  RoleType, 
  RoleLevel, 
  RoleLevelMap, 
  SpecialPermissions, 
  PermissionContext 
} from '../types';
import { CACHE_CONFIG } from '../constants';

// 內部緩存，用於減少Firestore訪問次數
const userCache = new Map<string, { user: UserInfo, timestamp: number }>();

/**
 * 根據用戶ID獲取用戶資訊
 * @param uid 用戶ID
 * @returns 用戶資訊，包含角色等
 */
export async function getUserInfo(uid: string): Promise<UserInfo | null> {
  // 檢查緩存
  const cachedUser = userCache.get(uid);
  const now = Date.now();
  
  // 如果緩存有效，直接返回
  if (cachedUser && now - cachedUser.timestamp < CACHE_CONFIG.USER_INFO_TTL) {
    return cachedUser.user;
  }
  
  try {
    // 從Firestore獲取用戶文檔
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return null;
    }
    
    const userData = userDoc.data() as any;
    
    // 檢查用戶角色
    const role: RoleType = userData.role || 'customer'; // 默認為客戶角色
    const roleLevel = RoleLevelMap[role] || RoleLevel.CUSTOMER;
    
    // 構建用戶資訊
    const userInfo: UserInfo = {
      uid,
      role,
      roleLevel,
      tenantId: userData.tenantId,
      storeId: userData.storeId,
      additionalStoreIds: userData.additionalStoreIds || [],
      permissions: extractSpecialPermissions(userData)
    };
    
    // 更新緩存
    userCache.set(uid, { user: userInfo, timestamp: now });
    
    // 確保緩存不會無限增長
    if (userCache.size > CACHE_CONFIG.MAX_CACHE_SIZE) {
      pruneCache();
    }
    
    return userInfo;
  } catch (error) {
    console.error('獲取用戶資訊失敗:', error);
    return null;
  }
}

/**
 * 從用戶聲明（JWT或Auth Token）獲取用戶資訊
 * @param authClaims 認證聲明
 * @returns 用戶資訊，包含角色等
 */
export async function getUserInfoFromClaims(authClaims: Record<string, any>): Promise<UserInfo | null> {
  const uid = authClaims.uid || authClaims.sub;
  
  if (!uid) {
    return null;
  }
  
  // 如果聲明中包含必要的用戶資訊，直接構建（避免訪問Firestore）
  if (authClaims.role) {
    const role: RoleType = authClaims.role;
    
    return {
      uid,
      role,
      roleLevel: RoleLevelMap[role] || RoleLevel.CUSTOMER,
      tenantId: authClaims.tenantId,
      storeId: authClaims.storeId,
      additionalStoreIds: authClaims.additionalStoreIds || [],
      permissions: {
        canDiscount: authClaims.canDiscount === true,
        canRefund: authClaims.canRefund === true,
        maxDiscountPercentage: authClaims.maxDiscountPercentage,
        maxRefundAmount: authClaims.maxRefundAmount
      }
    };
  }
  
  // 否則，從數據庫獲取完整的用戶資訊
  return getUserInfo(uid);
}

/**
 * 獲取資源信息
 * @param resourceType 資源類型
 * @param resourceId 資源ID
 * @returns 資源數據
 */
export async function getResourceInfo(
  resourceType: string, 
  resourceId: string
): Promise<Record<string, any> | null> {
  try {
    // 根據資源類型確定集合名稱
    let collectionName: string;
    
    // 映射資源類型到集合名稱（根據數據庫設計調整）
    switch (resourceType) {
      case 'users':
        collectionName = 'users';
        break;
      case 'tenants':
        collectionName = 'tenants';
        break;
      case 'stores':
        collectionName = 'stores';
        break;
      case 'employees':
        collectionName = 'employees';
        break;
      case 'orders':
        collectionName = 'orders';
        break;
      case 'menuItems':
        collectionName = 'menuItems';
        break;
      // 其他資源類型...
      default:
        collectionName = resourceType; // 默認與資源類型同名
    }
    
    const docRef = admin.firestore().collection(collectionName).doc(resourceId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return null;
    }
    
    return docSnap.data() || null;
  } catch (error) {
    console.error(`獲取資源信息失敗 (類型: ${resourceType}, ID: ${resourceId}):`, error);
    return null;
  }
}

/**
 * 構建權限上下文
 * @param resourceType 資源類型
 * @param resourceId 資源ID
 * @param additionalData 額外數據
 * @returns 權限上下文
 */
export async function buildPermissionContext(
  resourceType: string,
  resourceId: string,
  additionalData?: Record<string, any>
): Promise<PermissionContext> {
  const context: PermissionContext = {
    additionalData: additionalData || {}
  };
  
  // 如果提供了資源ID，獲取資源信息
  if (resourceId) {
    const resourceInfo = await getResourceInfo(resourceType, resourceId);
    
    if (resourceInfo) {
      // 設置租戶ID和店鋪ID（如果資源中包含這些信息）
      if (resourceInfo.tenantId) {
        context.tenantId = resourceInfo.tenantId;
      }
      
      if (resourceInfo.storeId) {
        context.storeId = resourceInfo.storeId;
      }
      
      // 合併資源數據到額外數據中
      context.additionalData = {
        ...resourceInfo,
        ...context.additionalData
      };
    }
  }
  
  return context;
}

/**
 * 從用戶數據中提取特殊權限
 * @param userData 用戶數據
 * @returns 特殊權限
 */
function extractSpecialPermissions(userData: any): SpecialPermissions {
  const permissions: SpecialPermissions = {};
  
  // 提取明確定義的特殊權限
  if (userData.permissions) {
    if (typeof userData.permissions.canDiscount === 'boolean') {
      permissions.canDiscount = userData.permissions.canDiscount;
    }
    
    if (typeof userData.permissions.canRefund === 'boolean') {
      permissions.canRefund = userData.permissions.canRefund;
    }
    
    if (userData.permissions.maxDiscountPercentage !== undefined) {
      permissions.maxDiscountPercentage = userData.permissions.maxDiscountPercentage;
    }
    
    if (userData.permissions.maxRefundAmount !== undefined) {
      permissions.maxRefundAmount = userData.permissions.maxRefundAmount;
    }
    
    // 其他自定義權限
    Object.keys(userData.permissions).forEach(key => {
      if (!['canDiscount', 'canRefund', 'maxDiscountPercentage', 'maxRefundAmount'].includes(key)) {
        permissions[key] = userData.permissions[key];
      }
    });
  }
  
  return permissions;
}

/**
 * 清理舊的緩存條目
 */
function pruneCache() {
  const now = Date.now();
  const expiredThreshold = now - CACHE_CONFIG.USER_INFO_TTL;
  
  // 刪除過期的條目
  for (const [uid, entry] of userCache.entries()) {
    if (entry.timestamp < expiredThreshold) {
      userCache.delete(uid);
    }
  }
  
  // 如果還是太多，按時間排序刪除最舊的條目
  if (userCache.size > CACHE_CONFIG.MAX_CACHE_SIZE * 0.8) {
    const entries = Array.from(userCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
    // 刪除最舊的20%
    const toDelete = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toDelete; i++) {
      userCache.delete(entries[i][0]);
    }
  }
} 