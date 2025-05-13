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
  UserContext,
  RoleScope
} from './roles.types';
import { roleService, RoleFilter } from './roles.service';

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
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const sort = req.query.sortBy as string || 'createdAt';
    const order = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
    const isActive = req.query.isActive ? req.query.isActive === 'true' : undefined;
    const isSystemRole = req.query.isSystemRole ? req.query.isSystemRole === 'true' : undefined;
    const scope = req.query.scope as RoleScope | undefined;
    const tenantId = req.query.tenantId as string | undefined;
    const query = req.query.query as string;

    // 構建過濾條件
    const filter: RoleFilter = {
      page,
      limit,
      sort,
      order,
      isActive,
      isSystemRole,
      scope,
      tenantId,
      query
    };
    
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
    if (!user.tenantId && user.roleLevel !== 0) {
      console.error(`關鍵錯誤：請求用戶 ${user.uid} 缺少 tenantId claim 且非超級管理員`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：請求用戶上下文無效（缺少 tenantId）'
      });
    }

    // 驗證scope參數
    if (scope && !['global', 'tenant', 'store'].includes(scope)) {
      return res.status(400).json({
        status: 'error',
        message: 'scope參數無效，有效值為：global, tenant, store'
      });
    }
    
    // 驗證tenantId參數 - 非超級管理員只能查詢自己租戶的角色
    if (tenantId && user.roleLevel !== 0 && tenantId !== user.tenantId) {
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法查詢其他租戶的角色'
      });
    }

    try {
      // 使用服務層獲取角色列表
      const result = await roleService.listRoles(filter, user);
      
      // 構建分頁響應
      const response: PaginatedRoleResponse = {
        status: 'success',
        data: result.roles,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        },
        message: '角色列表查詢成功'
      };

      return res.status(200).json(response);
    } catch (error: any) {
      // 處理權限錯誤
      if (error.message && error.message.includes('未授權')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      throw error; // 重新拋出其他錯誤
    }
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

    try {
      // 使用服務層獲取角色數據
      const role = await roleService.getRoleById(roleId, user);
      
      if (!role) {
        return res.status(404).json({
          status: 'error',
          message: `未找到 ID 為 ${roleId} 的角色`
        });
      }

      return res.status(200).json({
        status: 'success',
        data: role
      });
    } catch (error: any) {
      // 處理權限錯誤
      if (error.message && error.message.includes('未授權')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      throw error; // 重新拋出其他錯誤
    }
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

    // 處理scope和tenantId的關聯性
    if (requestData.scope === 'global') {
      // 全域範圍角色不應該有tenantId
      if (requestData.tenantId) {
        return res.status(400).json({
          status: 'error',
          message: '全域範圍角色不應指定租戶ID'
        });
      }
    } else {
      // 非全域範圍角色必須有tenantId
      if (!requestData.tenantId) {
        return res.status(400).json({
          status: 'error',
          message: `${requestData.scope === 'tenant' ? '租戶' : '店鋪'}範圍角色必須指定租戶ID`
        });
      }
      
      // 確保tenantId與用戶的tenantId一致（租戶隔離）
      if (user.tenantId && user.tenantId !== requestData.tenantId) {
        return res.status(403).json({
          status: 'error',
          message: '未授權：您無法為其他租戶創建角色'
        });
      }
    }
    
    // 系統角色驗證 - 只有超級管理員可以創建系統角色
    if (requestData.isSystemRole && user.roleLevel > 0) {
      return res.status(403).json({
        status: 'error',
        message: '未授權：只有超級管理員可以創建系統角色'
      });
    }

    try {
      // 使用服務層創建角色
      const role = await roleService.createRole(requestData, user);
      
      // 返回成功響應 (HTTP 201 Created)
      return res.status(201).json({
        status: 'success',
        data: role,
        message: '角色新增成功'
      });
    } catch (error: any) {
      // 處理各種錯誤情況
      if (error.message && error.message.includes('未授權')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      // 處理角色名稱重複錯誤
      if (error.message && error.message.includes('已存在')) {
        return res.status(409).json({
          status: 'error',
          message: error.message
        });
      }
      
      // 處理權限驗證錯誤
      if (error.message && error.message.includes('權限驗證失敗')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      
      // 處理角色等級錯誤
      if (error.message && error.message.includes('權限等級')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      // 處理其他業務邏輯錯誤
      if (error.message) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      
      throw error; // 重新拋出未處理的錯誤
    }
  } catch (error: any) {
    console.error('創建角色時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: '系統內部錯誤，無法創建角色'
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
    
    try {
      // 使用服務層更新角色
      const updatedRole = await roleService.updateRole(roleId, updateData, user);
      
      if (!updatedRole) {
        return res.status(404).json({
          status: 'error',
          message: `未找到 ID 為 ${roleId} 的角色`
        });
      }
      
      // 返回成功響應
      return res.status(200).json({
        status: 'success',
        data: updatedRole,
        message: '角色更新成功'
      });
    } catch (error: any) {
      // 處理權限錯誤
      if (error.message && error.message.includes('未授權')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      // 處理驗證錯誤
      if (error.message && (
          error.message.includes('驗證失敗') || 
          error.message.includes('已存在') || 
          error.message.includes('不可修改') ||
          error.message.includes('無法將')
        )) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      
      throw error; // 重新拋出其他錯誤
    }
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
    
    try {
      // 使用服務層執行角色刪除
      const success = await roleService.deleteRole(roleId, user);
      
      if (!success) {
        return res.status(404).json({
          status: 'error',
          message: `未找到 ID 為 ${roleId} 的角色`
        });
      }
      
      // 返回成功響應
      return res.status(200).json({
        status: 'success',
        message: `角色 ${roleId} 已成功刪除`
      });
    } catch (error: any) {
      // 處理權限錯誤
      if (error.message && error.message.includes('未授權')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      // 處理角色使用中錯誤 
      if (error.message && error.message.includes('角色正在使用中')) {
        return res.status(409).json({
          status: 'error',
          message: error.message
        });
      }
      
      throw error; // 重新拋出其他錯誤
    }
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
    
    try {
      // 使用服務層更新角色權限
      const updatedRole = await roleService.updateRolePermissions(roleId, permissions, user);
      
      if (!updatedRole) {
        return res.status(404).json({
          status: 'error',
          message: `未找到 ID 為 ${roleId} 的角色`
        });
      }
      
      // 返回成功響應
      return res.status(200).json({
        status: 'success',
        data: updatedRole
      });
    } catch (error: any) {
      // 處理權限錯誤
      if (error.message && error.message.includes('未授權')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      throw error; // 重新拋出其他錯誤
    }
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
    
    try {
      // 獲取角色資料
      const role = await roleService.getRoleById(roleId, user);
      
      if (!role) {
        return res.status(404).json({
          status: 'error',
          message: `未找到 ID 為 ${roleId} 的角色`
        });
      }
      
      // 檢查角色等級 - 不能分配比自己高權限的角色
      if (role.roleLevel < user.roleLevel) {
        return res.status(403).json({
          status: 'error',
          message: '未授權：您無法將用戶分配到超出您權限的角色'
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
      if (user.roleLevel !== 0 && targetUserData.tenantId !== user.tenantId) {
        return res.status(403).json({
          status: 'error',
          message: '未授權：您無法為其他租戶的用戶分配角色'
        });
      }
      
      // 執行角色分配操作
      await usersCollection.doc(requestData.userId).update({
        roleId,
        roleName: role.roleName,
        roleLevel: role.roleLevel,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        updatedBy: user.uid
      });
      
      console.log(`成功將角色 ${roleId} 分配給用戶 ${requestData.userId}`);
      
      // 返回成功響應
      return res.status(200).json({
        status: 'success',
        message: `已成功將角色 ${role.roleName} 分配給用戶`,
        data: {
          userId: requestData.userId,
          roleId: roleId,
          roleName: role.roleName,
          roleLevel: role.roleLevel
        }
      });
    } catch (error: any) {
      // 處理權限錯誤
      if (error.message && error.message.includes('未授權')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      throw error; // 重新拋出其他錯誤
    }
  } catch (error: any) {
    console.error('分配角色時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
}; 