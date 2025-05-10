import { Router } from 'express';
import { authenticateUser } from '../middleware/authenticateUser';
import { sendTestEmail, getUserNotifications, markNotificationAsRead } from './notification.handler';

// 創建路由實例
const router = Router();

// 應用認證中介軟體到大部分通知路由
router.use(authenticateUser);

/**
 * 發送測試電子郵件通知
 * POST /api/notifications/send-test-email
 * @description 發送測試電子郵件，僅用於測試環境
 */
router.post('/send-test-email', sendTestEmail);

/**
 * 獲取用戶通知列表
 * GET /api/notifications
 * @description 獲取當前登錄用戶的通知列表
 */
router.get('/', getUserNotifications);

/**
 * 標記通知為已讀
 * PATCH /api/notifications/:id/read
 * @description 將指定的通知標記為已讀
 */
router.patch('/:id/read', markNotificationAsRead);

export default router; 