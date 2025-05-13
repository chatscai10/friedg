import express from 'express';
import { callPickupNumber, getPickupCallHistory } from './pickup.handlers';

// 導入 Express 風格的 RBAC 和 Auth 中間件
const { checkAuth, checkRole } = require("../middleware/auth.middleware");
const { checkTenantAccess } = require("../middleware/tenant.middleware");

// 創建路由器實例
const router = express.Router();

/**
 * POST /api/pickup/stores/:storeId/call
 * 叫取餐號碼
 * 權限：tenant_admin, store_manager, store_staff
 */
router.post("/stores/:storeId/call",
  checkAuth,                                        // 驗證用戶是否已登入
  checkTenantAccess,                                // 確保租戶隔離
  checkRole(["tenant_admin", "store_manager", "store_staff"]), // 角色授權
  callPickupNumber                                  // 處理叫號
);

/**
 * GET /api/pickup/stores/:storeId/history
 * 獲取店鋪叫號歷史
 * 權限：tenant_admin, store_manager, store_staff
 */
router.get("/stores/:storeId/history",
  checkAuth,                                        // 驗證用戶是否已登入
  checkTenantAccess,                                // 確保租戶隔離
  checkRole(["tenant_admin", "store_manager", "store_staff"]), // 角色授權
  getPickupCallHistory                              // 處理獲取叫號歷史
);

export default router; 