import { Request, Response } from 'express';
import { PaginatedRoleResponse, Role, RoleScope } from './roles.types';

// 用於處理角色 API 的簡化版用戶上下文
interface UserContext {
  uid: string;
  email?: string;
  tenantId?: string;
  roleLevel: number;
}

// 角色數據存儲（內存中模擬，而非實際數據庫）
// 在真實場景中，將使用 Firestore 或其他數據庫
const rolesData = [
  {
    roleId: 'role_001',
    roleName: '系統管理員',
    description: '擁有系統中最高權限的角色',
    roleLevel: 1,
    scope: 'global',
    permissions: {
      roles: { create: true, read: true, update: true, delete: true },
      users: { create: true, read: true, update: true, delete: true },
      stores: { create: true, read: true, update: true, delete: true }
    },
    isSystemRole: true,
    isActive: true,
    tenantId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
    updatedBy: 'system'
  },
  {
    roleId: 'role_002',
    roleName: '租戶管理員',
    description: '擁有租戶內所有權限的角色',
    roleLevel: 3,
    scope: 'tenant',
    permissions: {
      roles: { create: true, read: true, update: true, delete: false },
      users: { create: true, read: true, update: true, delete: true },
      stores: { create: true, read: true, update: true, delete: true }
    },
    isSystemRole: true,
    isActive: true,
    tenantId: 'tenant_001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
    updatedBy: 'system'
  },
  {
    roleId: 'role_003',
    roleName: '店鋪經理',
    description: '擁有店鋪內管理權限的角色',
    roleLevel: 5,
    scope: 'store',
    permissions: {
      roles: { create: false, read: true, update: false, delete: false },
      users: { create: true, read: true, update: true, delete: false },
      stores: { create: false, read: true, update: true, delete: false }
    },
    isSystemRole: true,
    isActive: true,
    tenantId: 'tenant_001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
    updatedBy: 'system'
  }
];

/**
 * 獲取角色列表
 * GET /roles
 */
export const listRoles = async (req: Request, res: Response): Promise<Response> => {
  try {
    // 獲取查詢參數
    const { page = '1', limit = '10', scope, search } = req.query;
    
    // 將頁碼和每頁數量轉換為數字
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    
    // 計算分頁偏移量
    const startIndex = (pageNum - 1) * limitNum;
    
    // 篩選角色（模擬數據庫查詢）
    let filteredRoles = [...rolesData];
    
    // 根據 scope 篩選
    if (scope) {
      filteredRoles = filteredRoles.filter(role => role.scope === scope);
    }
    
    // 根據 search 篩選（搜索角色名稱或描述）
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredRoles = filteredRoles.filter(role => 
        role.roleName.toLowerCase().includes(searchLower) || 
        (role.description && role.description.toLowerCase().includes(searchLower))
      );
    }
    
    // 計算總數
    const total = filteredRoles.length;
    
    // 切片獲取當前頁數據
    const paginatedRoles = filteredRoles.slice(startIndex, startIndex + limitNum);
    
    // 返回結果
    return res.status(200).json({
      status: 'success',
      data: paginatedRoles,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('獲取角色列表失敗:', error);
    return res.status(500).json({
      status: 'error',
      message: '獲取角色列表時發生錯誤',
      error: (error as Error).message
    });
  }
};

/**
 * 根據ID獲取角色詳情
 * GET /roles/:roleId
 */
export const getRoleById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { roleId } = req.params;
    
    // 查找角色
    const role = rolesData.find(r => r.roleId === roleId);
    
    if (!role) {
      return res.status(404).json({
        status: 'error',
        message: `找不到ID為 ${roleId} 的角色`
      });
    }
    
    return res.status(200).json({
      status: 'success',
      data: role
    });
  } catch (error) {
    console.error(`獲取角色 ${req.params.roleId} 詳情失敗:`, error);
    return res.status(500).json({
      status: 'error',
      message: '獲取角色詳情時發生錯誤',
      error: (error as Error).message
    });
  }
};

/**
 * 創建新角色
 * POST /roles
 */
export const createRole = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { 
      roleName, 
      description = '', 
      roleLevel, 
      scope, 
      permissions = {}, 
      isSystemRole = false,
      isActive = true,
      tenantId
    } = req.body;
    
    // 基本驗證
    if (!roleName) {
      return res.status(400).json({
        status: 'error',
        message: '角色名稱不能為空'
      });
    }
    
    if (!roleLevel || !Number.isInteger(roleLevel) || roleLevel < 1 || roleLevel > 10) {
      return res.status(400).json({
        status: 'error',
        message: '角色等級必須是1-10之間的整數'
      });
    }
    
    // 生成角色 ID
    const roleId = `role_${Date.now()}`;
    
    // 創建新角色
    const newRole = {
      roleId,
      roleName,
      description,
      roleLevel,
      scope,
      permissions,
      isSystemRole,
      isActive,
      tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user_test', // 在真實環境中使用 req.user.uid
      updatedBy: 'user_test'
    };
    
    // 保存到數據庫 (模擬)
    rolesData.push(newRole);
    
    return res.status(201).json({
      status: 'success',
      message: '成功創建角色',
      data: newRole
    });
  } catch (error) {
    console.error('創建角色失敗:', error);
    return res.status(500).json({
      status: 'error',
      message: '創建角色時發生錯誤',
      error: (error as Error).message
    });
  }
};

/**
 * 更新角色
 * PUT /roles/:roleId
 */
export const updateRole = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { roleId } = req.params;
    const { 
      roleName, 
      description, 
      roleLevel, 
      scope, 
      permissions, 
      isActive 
    } = req.body;
    
    // 查找角色
    const roleIndex = rolesData.findIndex(r => r.roleId === roleId);
    
    if (roleIndex === -1) {
      return res.status(404).json({
        status: 'error',
        message: `找不到ID為 ${roleId} 的角色`
      });
    }
    
    // 獲取當前角色
    const role = { ...rolesData[roleIndex] };
    
    // 判斷是否為系統角色
    if (role.isSystemRole) {
      // 在真實環境中，這裡應該檢查用戶是否有權限修改系統角色
      const currentUser = {
        roleLevel: 1 // 模擬用戶為系統管理員
      };
      
      if (currentUser.roleLevel > 1) {
        return res.status(403).json({
          status: 'error',
          message: '您沒有權限修改系統角色'
        });
      }
    }
    
    // 更新角色屬性
    const updatedRole = {
      ...role,
      ...(roleName && { roleName }),
      ...(description !== undefined && { description }),
      ...(roleLevel && { roleLevel }),
      ...(scope && { scope }),
      ...(permissions && { permissions }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date().toISOString(),
      updatedBy: 'user_test' // 在真實環境中使用 req.user.uid
    };
    
    // 保存更新後的角色 (模擬)
    rolesData[roleIndex] = updatedRole;
    
    return res.status(200).json({
      status: 'success',
      message: '成功更新角色',
      data: updatedRole
    });
  } catch (error) {
    console.error(`更新角色 ${req.params.roleId} 失敗:`, error);
    return res.status(500).json({
      status: 'error',
      message: '更新角色時發生錯誤',
      error: (error as Error).message
    });
  }
};

/**
 * 刪除角色
 * DELETE /roles/:roleId
 */
export const deleteRole = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { roleId } = req.params;
    
    // 查找角色
    const roleIndex = rolesData.findIndex(r => r.roleId === roleId);
    
    if (roleIndex === -1) {
      return res.status(404).json({
        status: 'error',
        message: `找不到ID為 ${roleId} 的角色`
      });
    }
    
    // 獲取要刪除的角色
    const role = rolesData[roleIndex];
    
    // 判斷是否為系統角色
    if (role.isSystemRole) {
      return res.status(403).json({
        status: 'error',
        message: '不能刪除系統角色'
      });
    }
    
    // 刪除角色 (模擬)
    rolesData.splice(roleIndex, 1);
    
    return res.status(200).json({
      status: 'success',
      message: '成功刪除角色',
      data: { roleId }
    });
  } catch (error) {
    console.error(`刪除角色 ${req.params.roleId} 失敗:`, error);
    return res.status(500).json({
      status: 'error',
      message: '刪除角色時發生錯誤',
      error: (error as Error).message
    });
  }
}; 