/**
 * 超級管理後台 - 服務方案管理相關路由
 */
import * as express from 'express';
import {
  createServicePlan, 
  getServicePlanById, 
  listServicePlans, 
  updateServicePlan,
  updateServicePlanStatus 
} from '../handlers/plan.handlers';

// 引入中間件
import { checkAuth, checkRole } from '../../middleware/auth.middleware';

// 創建路由器
const router = express.Router();

/**
 * @route   GET /api/superadmin/plans
 * @desc    獲取服務方案列表
 * @access  僅限超級管理員
 */
router.get(
  '/', 
  checkAuth,                        // 身份驗證
  checkRole('super_admin'),       // 角色驗證
  listServicePlans
);

/**
 * @route   GET /api/superadmin/plans/:planId
 * @desc    獲取單一服務方案詳細資訊
 * @access  僅限超級管理員
 */
router.get(
  '/:planId', 
  checkAuth, 
  checkRole('super_admin'), 
  getServicePlanById
);

/**
 * @route   POST /api/superadmin/plans
 * @desc    創建新服務方案
 * @access  僅限超級管理員
 */
router.post(
  '/', 
  checkAuth, 
  checkRole('super_admin'), 
  createServicePlan
);

/**
 * @route   PUT /api/superadmin/plans/:planId
 * @desc    更新服務方案
 * @access  僅限超級管理員
 */
router.put(
  '/:planId', 
  checkAuth, 
  checkRole('super_admin'), 
  updateServicePlan
);

/**
 * @route   PATCH /api/superadmin/plans/:planId/status
 * @desc    更新服務方案狀態(啟用/停用)
 * @access  僅限超級管理員
 */
router.patch(
  '/:planId/status', 
  checkAuth, 
  checkRole('super_admin'), 
  updateServicePlanStatus
);

export default router; 