/**
 * 超級管理後台 - 全局設定管理相關路由
 */
import * as express from 'express';
import { 
  getGlobalSettings, 
  updateGlobalSettings
} from '../handlers/settings.handlers';

// 引入中間件
import { checkAuth, checkRole } from '../../middleware/auth.middleware';

// 創建路由器
const router = express.Router();

/**
 * @route   GET /api/superadmin/settings
 * @desc    獲取全局設定
 * @access  僅限超級管理員
 */
router.get(
  '/', 
  checkAuth,                        // 身份驗證
  checkRole('super_admin'),       // 角色驗證
  getGlobalSettings
);

/**
 * @route   PUT /api/superadmin/settings
 * @desc    更新全局設定 (部分或全部)
 * @access  僅限超級管理員
 */
router.put(
  '/', 
  checkAuth, 
  checkRole('super_admin'), 
  updateGlobalSettings
);

export default router; 