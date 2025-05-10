import { Request, Response } from 'express';
import { firestore } from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  Role, 
  CreateRoleRequest, 
  UpdateRoleRequest, 
  AssignRoleRequest,
  Permission,
  PaginatedRoleResponse,
  UserContext
} from './roles.types';

// 獲取 Firestore 實例
const db = firestore();
const rolesCollection = db.collection('roles');
const usersCollection = db.collection('users');

// 生成唯一的角色 ID (格式: role_{隨機字符})
function generateRoleId(): string {
  const randomStr = Math.random().toString(36).substring(2, 6);
  return `role_${randomStr}`;
}

/**
 * 獲取角色列表
 * GET /roles
 */
export const listRoles = async (req: Request, res: Response): Promise<Response> => {
  try {
    // 獲取查詢參數
    const { 
      page = 1, 
      limit = 20,
      isSystemRole
    } = req.query;
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 獲取租戶 ID (除非是超級管理員，否則必須有租戶 ID)
    const tenantId = user.tenantId;
    if (!tenantId && user.role !== 'super_admin') {
      console.error(`關鍵錯誤：請求用戶 ${user.uid} 缺少 tenantId claim`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：請求用戶上下文無效（缺少 tenantId）'
      });
    }
    
    // 構建查詢
    let query = rolesCollection;
    
    // 租戶隔離 - 如果不是超級管理員，只能查看自己租戶的角色
    if (user.role !== 'super_admin') {
      query = query.where('tenantId', '==', tenantId);
    }
    
    // 系統角色過濾
    if (isSystemRole !== undefined) {
      const isSystemRoleBool = isSystemRole === 'true';
      query = query.where('isSystemRole', '==', isSystemRoleBool);
    }
    
    // 執行分頁查詢
    const pageSize = Math.min(50, Number(limit) || 20);
    const offset = (Number(page) - 1) * pageSize;
    
    // 獲取總數
    const snapshot = await query.get();
    const totalCount = snapshot.size;
    const totalPages = Math.ceil(totalCount / pageSize);
    
    // 應用分頁
    const pagedQuery = query.limit(pageSize);
    
    // 如果需要跳過結果，使用偏移量
    const pagedSnapshot = await (offset 
      ? pagedQuery.offset(offset).get() 
      : pagedQuery.get());
    
    // 處理結果
    const roles = pagedSnapshot.docs.map(doc => {
      const data = doc.data() as Role;
      let formattedRole = { ...data };
      
      // 處理 Firestore 時間戳
      if (formattedRole.createdAt && typeof formattedRole.createdAt !== 'string') {
        formattedRole.createdAt = formattedRole.createdAt.toDate().toISOString();
      }
      
      if (formattedRole.updatedAt && typeof formattedRole.updatedAt !== 'string') {
        formattedRole.updatedAt = formattedRole.updatedAt.toDate().toISOString();
      }
      
      return formattedRole;
    });
    
    // 構建回應
    const response: PaginatedRoleResponse = {
      status: 'success',
      data: roles,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: pageSize,
        totalPages: totalPages
      }
    };
    
    return res.status(200).json(response);
    
  } catch (error: any) {
    console.error('獲取角色列表時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 獲取單個角色
 * GET /roles/{roleId}
 */
export const getRoleById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { roleId } = req.params;
    
    // 驗證路徑參數
    if (!roleId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 roleId 參數'
      });
    }
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 查詢角色
    const roleDoc = await rolesCollection.doc(roleId).get();
    
    // 檢查角色是否存在
    if (!roleDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${roleId} 的角色`
      });
    }
    
    const roleData = roleDoc.data() as Role;
    
    // 租戶隔離 - 非超級管理員只能查看自己租戶的角色
    if (user.role !== 'super_admin' && roleData.tenantId !== user.tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試訪問其他租戶的角色`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法訪問其他租戶的角色'
      });
    }
    
    // 處理 Firestore 時間戳
    let formattedRole = { ...roleData };
    
    if (formattedRole.createdAt && typeof formattedRole.createdAt !== 'string') {
      formattedRole.createdAt = formattedRole.createdAt.toDate().toISOString();
    }
    
    if (formattedRole.updatedAt && typeof formattedRole.updatedAt !== 'string') {
      formattedRole.updatedAt = formattedRole.updatedAt.toDate().toISOString();
    }
    
    // 返回角色資料
    return res.status(200).json({
      status: 'success',
      data: formattedRole
    });
    
  } catch (error: any) {
    console.error('獲取角色資料時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 創建新角色
 * POST /roles
 */
export const createRole = async (req: Request, res: Response): Promise<Response> => {
  try {
    // 獲取經過驗證的請求數據
    const requestData: CreateRoleRequest = req.body;
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 租戶隔離 - 只有超級管理員可以創建系統角色
    if (requestData.isSystemRole && user.role !== 'super_admin') {
      console.warn(`權限拒絕：用戶 ${user.uid} 嘗試創建系統角色`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：只有超級管理員可以創建系統角色'
      });
    }
    
    // 如果是租戶角色，確保是同一租戶
    if (!requestData.isSystemRole) {
      const tenantId = user.tenantId;
      
      if (!tenantId) {
        console.error(`關鍵錯誤：請求用戶 ${user.uid} 缺少 tenantId claim`);
        return res.status(403).json({
          status: 'error',
          message: '未授權：請求用戶上下文無效（缺少 tenantId）'
        });
      }
      
      // 確保使用者無法為其他租戶創建角色
      if (requestData.tenantId !== tenantId) {
        console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試為其他租戶創建角色`);
        return res.status(403).json({
          status: 'error',
          message: '未授權：您無法為其他租戶創建角色'
        });
      }
    }
    
    // 檢查角色等級 - 不能創建比自己高權限的角色
    if (requestData.level < user.roleLevel) {
      console.warn(`權限拒絕：用戶 ${user.uid} (等級 ${user.roleLevel}) 嘗試創建更高權限的角色 (等級 ${requestData.level})`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法創建比自己權限等級更高的角色'
      });
    }
    
    // 生成角色 ID
    const roleId = generateRoleId();
    
    // 創建角色數據
    const roleData: Role = {
      roleId,
      roleName: requestData.roleName,
      description: requestData.description || '',
      level: requestData.level,
      permissions: requestData.permissions || {},
      isSystemRole: requestData.isSystemRole || false,
      isActive: requestData.isActive !== undefined ? requestData.isActive : true,
      tenantId: requestData.isSystemRole ? null : requestData.tenantId,
      createdAt: FieldValue.serverTimestamp() as any,
      updatedAt: FieldValue.serverTimestamp() as any,
      createdBy: user.uid,
      updatedBy: user.uid
    };
    
    // 儲存到 Firestore
    await rolesCollection.doc(roleId).set(roleData);
    console.log(`成功創建角色：${roleId}`);
    
    // 返回成功響應
    const now = new Date().toISOString();
    const responseData = {
      ...roleData,
      createdAt: now,
      updatedAt: now
    };
    
    return res.status(201).json({
      status: 'success',
      data: responseData
    });
    
  } catch (error: any) {
    console.error('創建角色時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 更新角色
 * PUT /roles/{roleId}
 */
export const updateRole = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { roleId } = req.params;
    
    // 驗證路徑參數
    if (!roleId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 roleId 參數'
      });
    }
    
    // 獲取經過驗證的請求數據
    const updateData: UpdateRoleRequest = req.body;
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 獲取當前角色資料
    const roleDoc = await rolesCollection.doc(roleId).get();
    
    // 檢查角色是否存在
    if (!roleDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${roleId} 的角色`
      });
    }
    
    const roleData = roleDoc.data() as Role;
    
    // 租戶隔離 - 非超級管理員只能更新自己租戶的角色
    if (user.role !== 'super_admin' && roleData.tenantId !== user.tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試更新其他租戶的角色`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法更新其他租戶的角色'
      });
    }
    
    // 系統角色限制 - 只有超級管理員可以更新系統角色
    if (roleData.isSystemRole && user.role !== 'super_admin') {
      console.warn(`權限拒絕：用戶 ${user.uid} 嘗試更新系統角色`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：只有超級管理員可以更新系統角色'
      });
    }
    
    // 檢查角色等級 - 不能更改為比自己高權限的角色
    if (updateData.level !== undefined && updateData.level < user.roleLevel) {
      console.warn(`權限拒絕：用戶 ${user.uid} (等級 ${user.roleLevel}) 嘗試修改角色為更高權限 (等級 ${updateData.level})`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法將角色權限等級設置為比自己更高'
      });
    }
    
    // 構建更新數據
    const updateObject: any = {
      ...updateData,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid
    };
    
    // 禁止更改某些欄位
    delete updateObject.roleId;
    delete updateObject.tenantId;
    delete updateObject.isSystemRole;
    delete updateObject.createdAt;
    delete updateObject.createdBy;
    
    // 執行更新操作
    await rolesCollection.doc(roleId).update(updateObject);
    console.log(`成功更新角色 ${roleId}`);
    
    // 獲取更新後的角色資料
    const updatedRoleDoc = await rolesCollection.doc(roleId).get();
    const updatedRoleData = updatedRoleDoc.data() as Role;
    
    // 處理 Firestore 時間戳
    let formattedRole = { ...updatedRoleData };
    
    if (formattedRole.createdAt && typeof formattedRole.createdAt !== 'string') {
      formattedRole.createdAt = formattedRole.createdAt.toDate().toISOString();
    }
    
    if (formattedRole.updatedAt && typeof formattedRole.updatedAt !== 'string') {
      formattedRole.updatedAt = formattedRole.updatedAt.toDate().toISOString();
    }
    
    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      data: formattedRole
    });
    
  } catch (error: any) {
    console.error('更新角色時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 刪除角色
 * DELETE /roles/{roleId}
 */
export const deleteRole = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { roleId } = req.params;
    
    // 驗證路徑參數
    if (!roleId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 roleId 參數'
      });
    }
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 獲取當前角色資料
    const roleDoc = await rolesCollection.doc(roleId).get();
    
    // 檢查角色是否存在
    if (!roleDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${roleId} 的角色`
      });
    }
    
    const roleData = roleDoc.data() as Role;
    
    // 租戶隔離 - 非超級管理員只能刪除自己租戶的角色
    if (user.role !== 'super_admin' && roleData.tenantId !== user.tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試刪除其他租戶的角色`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法刪除其他租戶的角色'
      });
    }
    
    // 系統角色限制 - 系統角色不能刪除
    if (roleData.isSystemRole) {
      console.warn(`操作拒絕：用戶 ${user.uid} 嘗試刪除系統角色`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：系統角色不能被刪除'
      });
    }
    
    // 檢查角色是否正在使用（此處可以添加檢查邏輯，例如查詢使用此角色的用戶數量）
    // 這裡只是簡單示例，實際實作可能需要更複雜的檢查
    // TODO: 檢查角色是否正在使用
    
    // 執行刪除操作 (邏輯刪除，將狀態設為無效)
    await rolesCollection.doc(roleId).update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid
    });
    console.log(`成功邏輯刪除角色 ${roleId}`);
    
    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      message: `角色 ${roleId} 已成功停用`
    });
    
  } catch (error: any) {
    console.error('刪除角色時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 更新角色權限
 * PUT /roles/{roleId}/permissions
 */
export const updateRolePermissions = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { roleId } = req.params;
    
    // 驗證路徑參數
    if (!roleId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 roleId 參數'
      });
    }
    
    // 獲取經過驗證的請求數據
    const permissions: { [key: string]: Permission } = req.body.permissions;
    
    if (!permissions || Object.keys(permissions).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: '請提供要更新的權限配置'
      });
    }
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 獲取當前角色資料
    const roleDoc = await rolesCollection.doc(roleId).get();
    
    // 檢查角色是否存在
    if (!roleDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${roleId} 的角色`
      });
    }
    
    const roleData = roleDoc.data() as Role;
    
    // 租戶隔離 - 非超級管理員只能更新自己租戶的角色
    if (user.role !== 'super_admin' && roleData.tenantId !== user.tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試更新其他租戶的角色權限`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法更新其他租戶的角色權限'
      });
    }
    
    // 系統角色限制 - 只有超級管理員可以更新系統角色權限
    if (roleData.isSystemRole && user.role !== 'super_admin') {
      console.warn(`權限拒絕：用戶 ${user.uid} 嘗試更新系統角色權限`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：只有超級管理員可以更新系統角色權限'
      });
    }
    
    // 執行更新操作
    await rolesCollection.doc(roleId).update({
      permissions,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid
    });
    console.log(`成功更新角色 ${roleId} 的權限`);
    
    // 獲取更新後的角色資料
    const updatedRoleDoc = await rolesCollection.doc(roleId).get();
    const updatedRoleData = updatedRoleDoc.data() as Role;
    
    // 處理 Firestore 時間戳
    let formattedRole = { ...updatedRoleData };
    
    if (formattedRole.createdAt && typeof formattedRole.createdAt !== 'string') {
      formattedRole.createdAt = formattedRole.createdAt.toDate().toISOString();
    }
    
    if (formattedRole.updatedAt && typeof formattedRole.updatedAt !== 'string') {
      formattedRole.updatedAt = formattedRole.updatedAt.toDate().toISOString();
    }
    
    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      data: formattedRole
    });
    
  } catch (error: any) {
    console.error('更新角色權限時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 分配角色給用戶
 * POST /roles/{roleId}/assign
 */
export const assignRoleToUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { roleId } = req.params;
    
    // 驗證路徑參數
    if (!roleId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 roleId 參數'
      });
    }
    
    // 獲取經過驗證的請求數據
    const requestData: AssignRoleRequest = req.body;
    
    if (!requestData.userId) {
      return res.status(400).json({
        status: 'error',
        message: '請提供用戶 ID'
      });
    }
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 獲取角色資料
    const roleDoc = await rolesCollection.doc(roleId).get();
    
    // 檢查角色是否存在
    if (!roleDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${roleId} 的角色`
      });
    }
    
    const roleData = roleDoc.data() as Role;
    
    // 租戶隔離 - 非超級管理員只能分配自己租戶的角色
    if (user.role !== 'super_admin' && roleData.tenantId !== user.tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試分配其他租戶的角色`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法分配其他租戶的角色'
      });
    }
    
    // 系統角色限制 - 只有超級管理員可以分配系統角色
    if (roleData.isSystemRole && user.role !== 'super_admin') {
      console.warn(`權限拒絕：用戶 ${user.uid} 嘗試分配系統角色`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：只有超級管理員可以分配系統角色'
      });
    }
    
    // 檢查角色等級 - 不能分配比自己高權限的角色
    if (roleData.level < user.roleLevel) {
      console.warn(`權限拒絕：用戶 ${user.uid} (等級 ${user.roleLevel}) 嘗試分配更高權限的角色 (等級 ${roleData.level})`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法分配比自己權限等級更高的角色'
      });
    }
    
    // 檢查目標用戶是否存在
    const targetUserDoc = await usersCollection.doc(requestData.userId).get();
    
    if (!targetUserDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${requestData.userId} 的用戶`
      });
    }
    
    // 租戶隔離 - 非超級管理員只能為同一租戶的用戶分配角色
    const targetUserData = targetUserDoc.data();
    if (user.role !== 'super_admin' && targetUserData.tenantId !== user.tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試為其他租戶的用戶分配角色`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法為其他租戶的用戶分配角色'
      });
    }
    
    // 執行角色分配操作
    // 一般來說，這是通過更新用戶的自定義聲明（Custom Claims）完成的
    // 但在 Firebase Admin SDK 中，此操作需要管理權限
    // 這裡提供一個簡化的示例，實際實作可能需要與 Firebase Auth 深度整合
    
    // 1. 更新用戶文檔中的角色信息
    await usersCollection.doc(requestData.userId).update({
      roleId,
      roleName: roleData.roleName,
      roleLevel: roleData.level,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid
    });
    
    // 2. 如果需要，更新用戶的 Custom Claims（需要額外權限）
    // 這部分可能需要通過 Cloud Functions 觸發器或其他方式實現
    
    console.log(`成功將角色 ${roleId} 分配給用戶 ${requestData.userId}`);
    
    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      message: `已成功將角色 ${roleData.roleName} 分配給用戶`,
      data: {
        userId: requestData.userId,
        roleId: roleId,
        roleName: roleData.roleName,
        roleLevel: roleData.level
      }
    });
    
  } catch (error: any) {
    console.error('分配角色時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
}; 