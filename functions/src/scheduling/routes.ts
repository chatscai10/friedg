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
  withAuthentication, 
  withTenantIsolation, 
  withStoreIsolation, 
  withRole 
} from '../middleware/auth.middleware';

const router = Router();

// 獲取排班列表 - store_staff可查看，但僅自己的排班
router.get('/', withAuthentication(withTenantIsolation(getSchedules)));

// 獲取單個排班詳情 - store_staff可查看自己的排班
router.get('/:scheduleId', withAuthentication(withTenantIsolation(getScheduleById)));

// 創建排班 - 僅店長以上權限可創建
router.post('/', withAuthentication(withTenantIsolation(withStoreIsolation(withRole('store_manager', createSchedule)))));

// 更新排班 - 僅店長以上權限可更新
router.put('/:scheduleId', withAuthentication(withTenantIsolation(withStoreIsolation(withRole('store_manager', updateSchedule)))));

// 刪除排班 - 僅店長以上權限可刪除
router.delete('/:scheduleId', withAuthentication(withTenantIsolation(withStoreIsolation(withRole('store_manager', deleteSchedule)))));

// 批量發布排班 - 僅店長以上權限可發布
router.post('/publish', withAuthentication(withTenantIsolation(withStoreIsolation(withRole('store_manager', publishSchedules)))));

// 自動排班生成 - 僅店長以上權限可生成
router.post('/generate', withAuthentication(withTenantIsolation(withStoreIsolation(withRole('store_manager', generateSchedules)))));

// 員工確認排班 - 一般員工可確認自己的排班
router.post('/:scheduleId/confirm', withAuthentication(withTenantIsolation(confirmSchedule)));

export default router; 