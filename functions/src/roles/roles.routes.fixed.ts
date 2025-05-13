import { Router } from 'express';
import { 
  listRoles, 
  getRoleById
} from './roles.handlers.fixed';

// 引入中介軟體
import { withAuthentication, checkTenantAccess } from '../middleware/auth.middleware.fixed';

// 創建 Router 實例
const router = Router();

/**
 * 獲取角色列表
 * GET /roles
 */
router.get(
  '/',
  withAuthentication,
  checkTenantAccess,
  listRoles
);

/**
 * 獲取單個角色
 * GET /roles/:roleId
 */
router.get(
  '/:roleId',
  withAuthentication,
  checkTenantAccess,
  getRoleById
);

// 暫時移除其他路由處理：POST, PUT, DELETE，以減少編譯問題
// 等基本GET功能正常後，再逐步添加其他功能

export default router; 