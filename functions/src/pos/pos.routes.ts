import express from 'express';
import { getPosOrders, updatePosOrderStatus, triggerOrderPrint } from './pos.handlers';

// 導入 Express 風格的 RBAC 和 Auth 中間件
const { checkAuth, checkRole } = require("../middleware/auth.middleware");
const { checkTenantAccess } = require("../middleware/tenant.middleware");

// 創建路由器實例
const router = express.Router();

/**
 * GET /api/pos/stores/:storeId/orders
 * 獲取指定分店的活躍訂單
 * 權限：tenant_admin, store_manager, store_staff
 */
router.get("/stores/:storeId/orders",
  checkAuth,                                        // 驗證用戶是否已登入
  checkTenantAccess,                                // 確保租戶隔離
  checkRole(["tenant_admin", "store_manager", "store_staff"]), // 角色授權
  getPosOrders                                      // 處理獲取訂單列表
);

/**
 * PATCH /api/pos/orders/:orderId/status
 * 更新訂單狀態
 * 權限：tenant_admin, store_manager, store_staff
 */
router.patch("/orders/:orderId/status",
  checkAuth,                                        // 驗證用戶是否已登入
  checkTenantAccess,                                // 確保租戶隔離
  checkRole(["tenant_admin", "store_manager", "store_staff"]), // 角色授權
  updatePosOrderStatus                              // 處理更新訂單狀態
);

/**
 * POST /api/pos/orders/:orderId/print
 * 觸發訂單收據列印
 * 權限：tenant_admin, store_manager, store_staff
 */
router.post("/orders/:orderId/print",
  checkAuth,                                        // 驗證用戶是否已登入
  checkTenantAccess,                                // 確保租戶隔離
  checkRole(["tenant_admin", "store_manager", "store_staff"]), // 角色授權
  triggerOrderPrint                                 // 處理觸發訂單列印
);

export default router; 