const express = require("express");
const { createOrder, getOrderById, listOrders, updateOrderStatus } = require("./order.handlers");

// 導入標準 RBAC 和 Auth 中間件，替換舊有的中間件
const { withAuthentication } = require("../middleware/auth.middleware");
const { withTenantIsolation, withStoreIsolation, withRole } = require("../middleware/tenant.middleware");

// eslint-disable-next-line new-cap
const router = express.Router();

/**
 * POST /api/orders
 * 創建新訂單
 * 權限：tenant_admin, store_manager, store_staff, customer
 */
router.post("/", 
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager", "store_staff", "customer"]),
  createOrder
);

/**
 * GET /api/orders/:orderId
 * 獲取指定訂單詳情
 * 權限：tenant_admin, store_manager, store_staff
 */
router.get("/:orderId", 
  withAuthentication,
  withTenantIsolation,
  withStoreIsolation,
  withRole(["tenant_admin", "store_manager", "store_staff"]),
  getOrderById
);

/**
 * PUT /api/orders/:orderId/status
 * 更新訂單狀態
 * 權限：tenant_admin, store_manager, store_staff
 */
router.put("/:orderId/status", 
  withAuthentication,
  withTenantIsolation,
  withStoreIsolation,
  withRole(["tenant_admin", "store_manager", "store_staff"]),
  updateOrderStatus
);

/**
 * GET /api/orders
 * 獲取訂單列表
 * 權限：tenant_admin, store_manager, store_staff
 * 支持多種篩選條件和分頁
 */
router.get("/", 
  withAuthentication,
  withTenantIsolation,
  withStoreIsolation,
  withRole(["tenant_admin", "store_manager", "store_staff"]),
  listOrders
);

module.exports = router; 