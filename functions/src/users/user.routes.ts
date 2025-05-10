import express from 'express';
import { getProfileHandler, updateProfileHandler } from './user.handlers';
import { UpdateProfileSchema } from './user.validators';
import { validateRequest } from '../middleware/validation.middleware';
import { isAuthenticated } from '../middleware/auth';

/**
 * 用戶Profile API路由
 * 提供查詢和更新當前登入用戶資料的端點
 */
const router = express.Router();

/**
 * @swagger
 * /api/v1/profile/me:
 *   get:
 *     summary: 獲取當前用戶資料
 *     description: 獲取已登入用戶的個人資料
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功獲取用戶資料
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     uid:
 *                       type: string
 *                     displayName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     photoURL:
 *                       type: string
 *                     phoneNumber:
 *                       type: string
 *       401:
 *         description: 用戶未認證
 *       404:
 *         description: 找不到用戶資料
 *       500:
 *         description: 服務器內部錯誤
 */
router.get('/me', isAuthenticated, getProfileHandler);

/**
 * @swagger
 * /api/v1/profile/me:
 *   put:
 *     summary: 更新當前用戶資料
 *     description: 更新已登入用戶的個人資料
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 example: "張三"
 *               photoURL:
 *                 type: string
 *                 example: "https://example.com/photo.jpg"
 *               phoneNumber:
 *                 type: string
 *                 example: "+886912345678"
 *     responses:
 *       200:
 *         description: 成功更新用戶資料
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "成功更新用戶資料"
 *       400:
 *         description: 請求數據格式無效
 *       401:
 *         description: 用戶未認證
 *       404:
 *         description: 找不到用戶資料
 *       500:
 *         description: 服務器內部錯誤
 */
router.put('/me', 
  isAuthenticated, 
  validateRequest(UpdateProfileSchema), 
  updateProfileHandler
);

export default router; 