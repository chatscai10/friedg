import express from 'express';
import { createOrderHandler, listOrdersHandler, getOrderByIdHandler } from './orders.handlers';

// 導入 Express 風格的 RBAC 和 Auth 中間件
const { checkAuth, checkRole } = require("../middleware/auth.middleware");
const { checkTenantAccess } = require("../middleware/tenant.middleware");

// 導入請求驗證中間件和驗證schema
import { validateRequest } from '../middleware/validation.middleware';
import { CreateOrderSchema, ListOrdersQuerySchema } from './orders.validators';

// 創建路由器實例
const router = express.Router();

/**
 * POST /api/orders
 * 創建新訂單
 * 權限：tenant_admin, store_manager, store_staff
 * 
 * 由於訂單可能由多種角色創建（包括店員和管理員），我們設置了較寬的權限範圍。
 * 同時通過checkTenantAccess確保租戶隔離，防止跨租戶數據訪問。
 */
router.post("/", 
  checkAuth,                                        // 驗證用戶是否已登入
  checkTenantAccess,                                // 確保租戶隔離
  checkRole("tenant_admin"),                        // 角色授權
  validateRequest(CreateOrderSchema),               // 請求數據驗證
  createOrderHandler                                // 處理創建訂單
);

/**
 * GET /api/orders
 * 獲取訂單列表
 * 權限：tenant_admin, store_manager, store_staff
 */
router.get("/",
  checkAuth,                                        // 驗證用戶是否已登入
  checkTenantAccess,                                // 確保租戶隔離
  checkRole("tenant_admin"),                        // 角色授權
  listOrdersHandler                                 // 處理獲取訂單列表
);

/**
 * GET /api/orders/:orderId
 * 獲取單一訂單詳情
 * 權限：tenant_admin, store_manager, store_staff
 */
router.get("/:orderId",
  checkAuth,                                        // 驗證用戶是否已登入
  checkTenantAccess,                                // 確保租戶隔離
  checkRole("tenant_admin"),                        // 角色授權
  getOrderByIdHandler                              // 處理獲取單一訂單
);

/**
 * 其他訂單相關路由將在此處添加，例如：
 * - PUT /api/orders/:orderId/status - 更新訂單狀態
 * - POST /api/orders/:orderId/payment - 記錄訂單支付
 */

export default router; 