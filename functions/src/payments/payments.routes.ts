import * as express from 'express';
import { requestLinePayPayment, confirmLinePayPayment } from './payments.handlers';
import { withAuthentication as authMiddleware } from '../middleware/auth.middleware';

/**
 * 支付 API 路由
 */
const router = express.Router();

/**
 * POST /payments/linepay/request
 * 
 * 發起 LINE Pay 支付請求
 */
router.post('/linepay/request', authMiddleware, requestLinePayPayment);

/**
 * POST /payments/linepay/confirm
 * 
 * 確認 LINE Pay 交易
 */
router.post('/linepay/confirm', confirmLinePayPayment);

export default router; 