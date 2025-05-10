import { Router } from 'express';
import { handlePunch, listAttendanceLogs } from './attendance.handlers';
import { validateRequest } from '../middleware/validateRequest';
import { authenticateUser } from '../middleware/authenticateUser';
import { checkPermissions } from '../middleware/checkPermissions';
import { punchRequestSchema, listAttendanceLogsSchema } from './attendance.validators';

// 創建路由實例
const router = Router();

// 應用認證中介軟體到所有考勤路由
router.use(authenticateUser);

/**
 * 員工打卡路由
 * POST /attendance/punch
 * @description 處理員工 GPS 打卡，驗證位置並記錄考勤狀態
 */
router.post(
  '/punch',
  checkPermissions('attendance', 'create'),
  validateRequest(punchRequestSchema),
  handlePunch
);

/**
 * 獲取考勤記錄列表
 * GET /attendance/logs
 * @description 根據篩選條件獲取考勤記錄列表
 */
router.get(
  '/logs',
  checkPermissions('attendance', 'read'),
  validateRequest(listAttendanceLogsSchema),
  listAttendanceLogs
);

/**
 * （後續可以增加其他考勤相關路由，例如）
 * - 獲取員工打卡記錄
 * - 手動調整打卡記錄
 * - 獲取考勤統計數據
 */

export default router; 