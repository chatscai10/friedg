import { Router } from 'express';
import { getProfileHandler, updateProfileHandler, updateUserStatus, getUsers, getUser } from './user.handlers';
import { withAuthentication } from '../middleware/auth.middleware';
import { checkPermissions } from '../middleware/checkPermissions';

/**
 * 用戶Profile API路由
 * 提供查詢和更新當前登入用戶資料的端點
 */
const router = Router();

// 獲取當前用戶資料
router.get('/me', getProfileHandler);

// 更新當前用戶資料
router.put('/me', updateProfileHandler);

/**
 * 用戶管理路由 (管理員功能)
 */
const adminRouter = Router();

// 更新用戶狀態
adminRouter.put(
  '/:userId/status',
  withAuthentication,
  checkPermissions([{ action: 'update', resource: 'users' }]),
  updateUserStatus
);

// 測試用：獲取用戶列表
adminRouter.get('/', getUsers);

// 測試用：獲取單個用戶
adminRouter.get('/:userId', getUser);

// 將用戶管理路由添加到導出中
export default {
  userProfileRouter: router,
  adminRouter: adminRouter,
  default: router
}; 