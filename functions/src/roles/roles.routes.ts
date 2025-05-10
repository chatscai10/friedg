import { Router } from 'express';
import { 
  listRoles, 
  getRoleById, 
  createRole, 
  updateRole, 
  deleteRole, 
  updateRolePermissions, 
  assignRoleToUser 
} from './roles.handlers';

// 引入中介軟體
import { withAuthentication as authenticateJWT, checkTenantAccess } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';

// 引入驗證 schema
import { 
  CreateRoleSchema,
  UpdateRoleSchema,
  RolePermissionsSchema,
  AssignRoleSchema
} from './roles.validators';

// 創建 Router 實例
const router = Router();

/**
 * 獲取角色列表
 * GET /roles
 */
router.get(
  '/',
  authenticateJWT,
  checkTenantAccess,
  listRoles
);

/**
 * 獲取單個角色
 * GET /roles/:roleId
 */
router.get(
  '/:roleId',
  authenticateJWT,
  checkTenantAccess,
  getRoleById
);

/**
 * 創建新角色
 * POST /roles
 */
router.post(
  '/',
  authenticateJWT,
  checkTenantAccess,
  validateRequest(CreateRoleSchema),
  createRole
);

/**
 * 更新角色
 * PUT /roles/:roleId
 */
router.put(
  '/:roleId',
  authenticateJWT,
  checkTenantAccess,
  validateRequest(UpdateRoleSchema),
  updateRole
);

/**
 * 刪除角色 (邏輯刪除)
 * DELETE /roles/:roleId
 */
router.delete(
  '/:roleId',
  authenticateJWT,
  checkTenantAccess,
  deleteRole
);

/**
 * 更新角色權限
 * PUT /roles/:roleId/permissions
 */
router.put(
  '/:roleId/permissions',
  authenticateJWT,
  checkTenantAccess,
  validateRequest(RolePermissionsSchema),
  updateRolePermissions
);

/**
 * 分配角色給用戶
 * POST /roles/:roleId/assign
 */
router.post(
  '/:roleId/assign',
  authenticateJWT,
  checkTenantAccess,
  validateRequest(AssignRoleSchema),
  assignRoleToUser
);

export default router; 