/**
 * 超級管理後台 - 主模塊
 */
import * as express from 'express';
import tenantRoutes from './routes/tenant.routes';
import planRoutes from './routes/plan.routes';
import settingsRoutes from './routes/settings.routes';

// 創建Express路由器
const router = express.Router();

// 註冊租戶管理路由
router.use('/tenants', tenantRoutes);

// 註冊服務方案管理路由
router.use('/plans', planRoutes);

// 註冊全局設定管理路由
router.use('/settings', settingsRoutes);

// 導出路由器
export const routes = router; 