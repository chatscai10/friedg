import { Router } from 'express';
import { withAuthentication } from '../middleware/auth';
import { checkTenantAccess } from '../middleware/tenant';
import { validateEmployeeAccess, validateClockInRequest, validateClockOutRequest } from './attendance.validators';
import { AttendanceHandlers } from './attendance.handlers';

const router = Router();

/**
 * @route POST /attendance/clock-in
 * @desc 員工上班打卡
 * @access Private - 限員工及以上角色
 */
router.post(
  '/clock-in',
  withAuthentication,
  checkTenantAccess,
  validateEmployeeAccess,
  validateClockInRequest,
  AttendanceHandlers.clockIn
);

/**
 * @route POST /attendance/clock-out
 * @desc 員工下班打卡
 * @access Private - 限員工及以上角色
 */
router.post(
  '/clock-out',
  withAuthentication,
  checkTenantAccess,
  validateEmployeeAccess,
  validateClockOutRequest,
  AttendanceHandlers.clockOut
);

/**
 * @route GET /attendance/logs
 * @desc 獲取出勤紀錄列表
 * @access Private - 限員工及以上角色
 */
router.get(
  '/logs',
  withAuthentication,
  checkTenantAccess,
  validateEmployeeAccess,
  AttendanceHandlers.listAttendanceLogs
);

/**
 * @route GET /attendance/logs/:id
 * @desc 獲取特定出勤紀錄詳情
 * @access Private - 限員工及以上角色
 */
router.get(
  '/logs/:id',
  withAuthentication,
  checkTenantAccess,
  validateEmployeeAccess,
  AttendanceHandlers.getAttendanceById
);

/**
 * @route GET /attendance/logs/last
 * @desc 獲取最近一次出勤紀錄
 * @access Private - 限員工及以上角色
 */
router.get(
  '/logs/last',
  withAuthentication,
  checkTenantAccess,
  validateEmployeeAccess,
  AttendanceHandlers.getLastAttendanceLog
);

export default router; 