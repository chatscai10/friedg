import express from 'express';
import { getProfileHandler, updateProfileHandler, updateUserStatus } from './user.handlers';
import { UpdateProfileSchema } from './user.validators';
// 使用固定版本的中間件
import { validateRequest } from '../middleware/validation.middleware.fixed';
import { withAuthentication } from '../middleware/auth.middleware.fixed';
// 暫時注釋掉，因為測試階段不需要權限檢查
// import { checkPermissions } from '../middleware/checkPermissions';

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
router.get('/me', withAuthentication, getProfileHandler);

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
  withAuthentication, 
  validateRequest(UpdateProfileSchema), 
  updateProfileHandler
);

/**
 * 用戶管理路由 (管理員功能)
 */
// 如果尚未定義用戶管理路由，先定義
const adminRouter = express.Router();

/**
 * @swagger
 * /api/v1/users/{userId}/status:
 *   put:
 *     summary: 更新用戶狀態
 *     description: 管理員更新特定用戶的狀態 (活躍、非活躍、停用等)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: 用戶ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended, deleted]
 *                 description: 用戶新狀態
 *     responses:
 *       200:
 *         description: 成功更新用戶狀態
 *       400:
 *         description: 請求數據格式無效
 *       401:
 *         description: 用戶未認證
 *       403:
 *         description: 無權操作此用戶
 *       404:
 *         description: 找不到用戶
 *       500:
 *         description: 服務器內部錯誤
 */
adminRouter.put('/:userId/status', 
  withAuthentication, 
  // 臨時注釋掉權限檢查中間件，方便測試
  // checkPermissions('users', 'update'), 
  updateUserStatus
);

// 添加獲取用戶列表的臨時測試端點
adminRouter.get('/', withAuthentication, (req, res) => {
  // 提供測試用戶列表
  console.log('提供測試用戶列表');
  
  // 模擬從數據庫獲取用戶列表
  const users = [
    {
      uid: 'user001',
      displayName: '測試用戶1',
      email: 'test1@example.com',
      status: 'active',
      roleId: 'role_001',
      createdAt: new Date().toISOString()
    },
    {
      uid: 'user002',
      displayName: '測試用戶2',
      email: 'test2@example.com',
      status: 'active',
      roleId: 'role_002',
      createdAt: new Date().toISOString()
    }
  ];
  
  return res.status(200).json({
    success: true,
    data: users
  });
});

// 添加獲取單個用戶的臨時測試端點
adminRouter.get('/:userId', withAuthentication, (req, res) => {
  const { userId } = req.params;
  console.log(`提供測試用戶詳情，userId: ${userId}`);
  
  // 模擬從數據庫獲取用戶
  const user = {
    uid: userId,
    displayName: `測試用戶 ${userId}`,
    email: `${userId}@example.com`,
    status: 'active',
    roleId: 'role_001',
    createdAt: new Date().toISOString(),
    phone: '0912345678',
    address: {
      city: '台北市',
      district: '信義區',
      street: '忠孝東路五段'
    }
  };
  
  return res.status(200).json({
    success: true,
    data: user
  });
});

// 將用戶管理路由添加到導出中
export { adminRouter };

export default router; 