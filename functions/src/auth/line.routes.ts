import { Router } from 'express';
import {
  lineLoginHandler,
  lineCallbackHandler,
  lineTokenExchangeHandler,
  employeeLineLoginHandler
} from './line.handlers';

const router = Router();

/**
 * LINE登入流程路由
 */

// 啟動LINE登入流程，重定向到LINE授權頁面
// GET /auth/line/login
router.get('/line/login', lineLoginHandler);

// 處理LINE授權回調
// GET /auth/line/callback
router.get('/line/callback', lineCallbackHandler);

// 交換LINE Token獲取Firebase自定義Token
// POST /auth/line/token-exchange
router.post('/line/token-exchange', lineTokenExchangeHandler);

// 員工LINE登入
// POST /auth/employee-line-login
router.post('/employee-line-login', employeeLineLoginHandler);

// 保留舊版路由作為向後兼容（如果需要）
// POST /auth/line (舊版API路徑)
router.post('/line', lineTokenExchangeHandler);

export default router; 