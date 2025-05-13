import express from 'express';
import { createSchedule, listSchedules, updateSchedule, deleteSchedule } from './scheduling.handlers';
import { authenticate } from '../middleware/auth';
import { validateRoles } from '../middleware/rbac';

const router = express.Router();

/**
 * 排班管理路由
 */

// GET /api/schedules - 查詢排班記錄列表
// 所有角色都可以查詢，權限控制在 handler 中實作 (一般員工只能查詢自己的排班)
router.get('/', authenticate, listSchedules);

// POST /api/schedules - 創建排班記錄
// 只有租戶管理員和店長可以創建排班
router.post('/', authenticate, validateRoles(['tenant_admin', 'store_manager']), createSchedule);

// PUT /api/schedules/:scheduleId - 更新排班記錄
// 權限控制在 handler 中實作
router.put('/:scheduleId', authenticate, updateSchedule);

// DELETE /api/schedules/:scheduleId - 刪除排班記錄
// 權限控制在 handler 中實作
router.delete('/:scheduleId', authenticate, deleteSchedule);

export default router; 