/**
 * 超級管理後台 - 租戶管理相關路由
 */
import * as express from 'express';
import { 
  listTenantsForSuperAdmin, 
  getTenantDetailsForSuperAdmin, 
  updateTenantStatusBySuperAdmin 
} from '../handlers/tenant.handlers';

// 引入中間件
import { checkAuth, checkRole } from '../../middleware/auth.middleware';

// 創建路由器
const router = express.Router();

/**
 * @route   GET /api/superadmin/tenants
 * @desc    獲取租戶列表（支持過濾）
 * @access  僅限超級管理員
 */
router.get(
  '/', 
  checkAuth,                        // 身份驗證
  checkRole('super_admin'),       // 角色驗證
  listTenantsForSuperAdmin
);

/**
 * @route   GET /api/superadmin/tenants/:tenantId
 * @desc    獲取單一租戶詳細資訊
 * @access  僅限超級管理員
 */
router.get(
  '/:tenantId', 
  checkAuth,                        // 身份驗證
  checkRole('super_admin'),       // 角色驗證
  getTenantDetailsForSuperAdmin
);

/**
 * @route   PATCH /api/superadmin/tenants/:tenantId/status
 * @desc    更新租戶狀態
 * @access  僅限超級管理員
 */
router.patch(
  '/:tenantId/status', 
  checkAuth,                        // 身份驗證
  checkRole('super_admin'),       // 角色驗證
  updateTenantStatusBySuperAdmin
);

export default router; 