/**
 * 請假系統API路由
 */

import { Router } from 'express';
import { 
  getLeaveRequests, 
  getLeaveRequestById, 
  createLeaveRequest, 
  updateLeaveRequest, 
  deleteLeaveRequest, 
  approveLeaveRequest
} from './handlers';
import { isAuthenticated } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/tenant';
import { validateResourceAccess } from '../middleware/resource';

const router = Router();

// 獲取請假申請列表
router.get('/', isAuthenticated, validateTenantAccess, getLeaveRequests);

// 獲取請假申請詳情
router.get('/:leaveId', isAuthenticated, validateResourceAccess('leaves'), getLeaveRequestById);

// 創建請假申請
router.post('/', isAuthenticated, validateTenantAccess, createLeaveRequest);

// 更新請假申請
router.put('/:leaveId', isAuthenticated, validateResourceAccess('leaves'), updateLeaveRequest);

// 刪除請假申請
router.delete('/:leaveId', isAuthenticated, validateResourceAccess('leaves'), deleteLeaveRequest);

// 審批請假申請
router.post('/:leaveId/approve', isAuthenticated, validateResourceAccess('leaves'), approveLeaveRequest);

export default router; 