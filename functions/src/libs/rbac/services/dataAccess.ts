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
import { validateRoleType } from '../utils/validators';

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
  // 確保有 uid
  const uid = authClaims.uid || authClaims.sub || authClaims.user_id;
  
  if (!uid) {
    console.error('無法從 authClaims 獲取用戶 ID，缺少 uid/sub/user_id 欄位');
    return null;
  }
  
  try {
    // 增強對聲明中角色信息的處理
    let role: RoleType = 'customer'; // 預設為顧客角色
    
    // 支援多種可能的角色欄位名稱
    if (typeof authClaims.role === 'string') {
      // 直接使用role欄位
      if (validateRoleType(authClaims.role)) {
        role = authClaims.role as RoleType;
      } else {
        console.warn(`用戶 ${uid} 的角色類型無效: "${authClaims.role}"，使用預設角色: customer`);
      }
    } else if (Array.isArray(authClaims.roles) && authClaims.roles.length > 0) {
      // 使用roles陣列中的第一個角色
      const firstRole = authClaims.roles[0];
      if (typeof firstRole === 'string' && validateRoleType(firstRole)) {
        role = firstRole as RoleType;
      } else {
        console.warn(`用戶 ${uid} 的角色陣列首個角色無效: "${firstRole}"，使用預設角色: customer`);
      }
    } else if (authClaims.isAdmin === true) {
      // 特殊處理，僅供測試與相容性使用
      console.warn(`用戶 ${uid} 使用了傳統 isAdmin 標記，建議遷移至標準角色系統`);
      role = 'tenant_admin';
    }
    
    // 確定角色等級
    const roleLevel = RoleLevelMap[role] || RoleLevel.CUSTOMER;
    
    // 增強對租戶ID的安全提取
    let tenantId: string | undefined = undefined;
    
    if (typeof authClaims.tenantId === 'string' && authClaims.tenantId.trim() !== '') {
      tenantId = authClaims.tenantId;
    } else if (typeof authClaims.tenant_id === 'string' && authClaims.tenant_id.trim() !== '') {
      // 支援可能的替代命名
      tenantId = authClaims.tenant_id;
      console.info(`用戶 ${uid} 使用非標準 tenant_id 欄位，建議標準化為 tenantId`);
    }
    
    // 安全地獲取店鋪ID
    let storeId: string | undefined = undefined;
    
    if (typeof authClaims.storeId === 'string' && authClaims.storeId.trim() !== '') {
      storeId = authClaims.storeId;
    } else if (typeof authClaims.store_id === 'string' && authClaims.store_id.trim() !== '') {
      // 支援可能的替代命名
      storeId = authClaims.store_id;
      console.info(`用戶 ${uid} 使用非標準 store_id 欄位，建議標準化為 storeId`);
    }
    
    // 安全地獲取額外店鋪ID列表
    let additionalStoreIds: string[] = [];
    
    if (Array.isArray(authClaims.additionalStoreIds)) {
      additionalStoreIds = authClaims.additionalStoreIds.filter(
        (id: any) => typeof id === 'string' && id.trim() !== ''
      );
    } else if (Array.isArray(authClaims.additional_store_ids)) {
      // 支援可能的替代命名
      additionalStoreIds = authClaims.additional_store_ids.filter(
        (id: any) => typeof id === 'string' && id.trim() !== ''
      );
      console.info(`用戶 ${uid} 使用非標準 additional_store_ids 欄位，建議標準化為 additionalStoreIds`);
    }
    
    // 日誌記錄用戶身份詳情，有助於調試
    if (process.env.NODE_ENV === 'development' || process.env.FUNCTIONS_EMULATOR === 'true') {
      console.log(`用戶身份解析: ${uid}, 角色: ${role}, 租戶ID: ${tenantId || 'N/A'}, 店鋪ID: ${storeId || 'N/A'}, 額外店鋪: ${additionalStoreIds.length > 0 ? additionalStoreIds.join(',') : 'N/A'}`);
    }
    
    // 構建用戶信息對象
    const userInfo: UserInfo = {
      uid,
      role,
      roleLevel,
      tenantId,
      storeId,
      additionalStoreIds,
      permissions: extractPermissionsFromClaims(authClaims)
    };
    
    return userInfo;
  } catch (error) {
    console.error(`解析用戶 ${uid} claims 時發生錯誤:`, error instanceof Error ? error.message : error);
    
    // 嘗試從數據庫作為備選方案獲取
    console.log(`嘗試從數據庫獲取用戶 ${uid} 信息作為備選方案`);
    return getUserInfo(uid);
  }
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
 * 從聲明中提取特殊權限
 * @param claims 認證聲明
 * @returns 特殊權限對象
 */
function extractPermissionsFromClaims(claims: Record<string, any>): SpecialPermissions {
  const permissions: SpecialPermissions = {};
  
  // 使用類型安全的方式提取特殊權限
  if (claims.permissions && typeof claims.permissions === 'object') {
    // 直接使用權限對象
    if (typeof claims.permissions.canDiscount === 'boolean') {
      permissions.canDiscount = claims.permissions.canDiscount;
    }
    
    if (typeof claims.permissions.canRefund === 'boolean') {
      permissions.canRefund = claims.permissions.canRefund;
    }
    
    if (typeof claims.permissions.maxDiscountPercentage === 'number') {
      permissions.maxDiscountPercentage = claims.permissions.maxDiscountPercentage;
    }
    
    if (typeof claims.permissions.maxRefundAmount === 'number') {
      permissions.maxRefundAmount = claims.permissions.maxRefundAmount;
    }
  } else {
    // 備選：直接從頂層claims提取
    if (typeof claims.canDiscount === 'boolean') {
      permissions.canDiscount = claims.canDiscount;
    }
    
    if (typeof claims.canRefund === 'boolean') {
      permissions.canRefund = claims.canRefund;
    }
    
    if (typeof claims.maxDiscountPercentage === 'number') {
      permissions.maxDiscountPercentage = claims.maxDiscountPercentage;
    }
    
    if (typeof claims.maxRefundAmount === 'number') {
      permissions.maxRefundAmount = claims.maxRefundAmount;
    }
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

// 在測試環境下條件性導出內部函數和變數
if (process.env.NODE_ENV === 'test') {
  module.exports.pruneCacheInternal = pruneCache;
  module.exports.userCacheInternal = userCache;
} 