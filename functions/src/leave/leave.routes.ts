import express from 'express';
import { authenticateUser } from '../middleware/auth';
import { 
  listLeaveTypes, 
  createLeaveRequest, 
  listLeaveRequests, 
  updateLeaveRequestStatus 
} from './leave.handlers';

const router = express.Router();

// 獲取假期類別列表路由
router.get('/types', authenticateUser, listLeaveTypes);

// 請假申請相關路由
router.post('/requests', authenticateUser, createLeaveRequest);
router.get('/requests', authenticateUser, listLeaveRequests);
router.patch('/requests/:requestId/status', authenticateUser, updateLeaveRequestStatus);

export default router; 