/**
 * 排班系統API路由
 */

import { Router } from 'express';
import {
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  publishSchedules,
  generateSchedules,
  confirmSchedule
} from './handlers';
import {
  authenticateRequest,
  enforceTenantIsolation,
  enforceStoreIsolation,
  authorizeRoles
} from '../middleware/express-auth.middleware';

const router = Router();

// 獲取排班列表 - store_staff可查看，但僅自己的排班
router.get('/', authenticateRequest, enforceTenantIsolation, getSchedules);

// 獲取單個排班詳情 - store_staff可查看自己的排班
router.get('/:scheduleId', authenticateRequest, enforceTenantIsolation, getScheduleById);

// 創建排班 - 僅店長以上權限可創建
router.post('/', authenticateRequest, enforceTenantIsolation, enforceStoreIsolation,
  authorizeRoles(['store_manager', 'tenant_admin', 'super_admin']), createSchedule);

// 更新排班 - 僅店長以上權限可更新
router.put('/:scheduleId', authenticateRequest, enforceTenantIsolation, enforceStoreIsolation,
  authorizeRoles(['store_manager', 'tenant_admin', 'super_admin']), updateSchedule);

// 刪除排班 - 僅店長以上權限可刪除
router.delete('/:scheduleId', authenticateRequest, enforceTenantIsolation, enforceStoreIsolation,
  authorizeRoles(['store_manager', 'tenant_admin', 'super_admin']), deleteSchedule);

// 批量發布排班 - 僅店長以上權限可發布
router.post('/publish', authenticateRequest, enforceTenantIsolation, enforceStoreIsolation,
  authorizeRoles(['store_manager', 'tenant_admin', 'super_admin']), publishSchedules);

// 自動排班生成 - 僅店長以上權限可生成
router.post('/generate', authenticateRequest, enforceTenantIsolation, enforceStoreIsolation,
  authorizeRoles(['store_manager', 'tenant_admin', 'super_admin']), generateSchedules);

// 員工確認排班 - 一般員工可確認自己的排班
router.post('/:scheduleId/confirm', authenticateRequest, enforceTenantIsolation, confirmSchedule);

export default router;