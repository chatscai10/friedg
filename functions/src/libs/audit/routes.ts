/**
 * 操作日誌 (Audit Log) 模組 - 路由
 */
import * as express from 'express';
import { queryAuditLogs, getAuditLogDetail } from './handlers';
import { checkAuth, checkRole } from '../../middleware/auth.middleware';

const router = express.Router();

/**
 * @route   GET /api/audit/logs
 * @desc    查詢操作日誌
 * @access  需要超級管理員或租戶管理員權限
 */
router.get('/logs', checkAuth, checkRole('tenant_admin'), queryAuditLogs);

/**
 * @route   GET /api/audit/logs/:id
 * @desc    獲取操作日誌詳情
 * @access  需要超級管理員或租戶管理員權限
 */
router.get('/logs/:id', checkAuth, checkRole('tenant_admin'), getAuditLogDetail);

export default router; 