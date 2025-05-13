import express from 'express';
import { createCustomerOrderHandler, getCustomerOrderStatusHandler } from './customer.orders.handlers';

// 導入請求驗證中間件
import { validateRequest } from '../middleware/validation.middleware';
import { CustomerOrderSchema } from './customer.orders.validators';

// 導入可選性的身份驗證中間件
const { optionalAuth } = require('../middleware/auth.middleware');

// 創建路由器實例
const router = express.Router();

/**
 * POST /api/customer/orders
 * 顧客創建新訂單
 * 權限：任何人可訪問（包括匿名用戶）
 */
router.post('/', 
  optionalAuth,                                    // 可選認證中間件 - 允許匿名和已登入用戶
  validateRequest(CustomerOrderSchema),            // 請求數據驗證
  createCustomerOrderHandler                       // 處理創建訂單
);

/**
 * GET /api/customer/orders/:orderId
 * 獲取訂單狀態
 * 權限：訂單所有者或通過訂單號+電話驗證的匿名用戶
 */
router.get('/:orderId', 
  optionalAuth,                                    // 可選認證中間件 - 允許匿名和已登入用戶
  getCustomerOrderStatusHandler                    // 處理獲取訂單狀態
);

export default router; 