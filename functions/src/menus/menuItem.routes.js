const express = require("express");
const { createMenuItem, getMenuItemById, listMenuItems, updateMenuItem, deleteMenuItem } = require("./menuItem.handlers");

// 導入標準 RBAC 和 Auth 中間件，替換舊有的中間件
const { withAuthentication } = require("../middleware/auth.middleware");
const { withTenantIsolation, withRole } = require("../middleware/tenant.middleware");

// eslint-disable-next-line new-cap
const router = express.Router();

/**
 * GET /api/menu-items
 * 獲取菜單項目列表
 * 權限：tenant_admin, store_manager
 */
router.get("/", 
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  listMenuItems
);

/**
 * POST /api/menu-items
 * 創建新的菜單項目
 * 權限：tenant_admin, store_manager
 */
router.post("/", 
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  createMenuItem
);

/**
 * GET /api/menu-items/:itemId
 * 獲取單一菜單項目詳情
 * 權限：tenant_admin, store_manager
 */
router.get("/:itemId", 
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  getMenuItemById
);

/**
 * PUT /api/menu-items/:itemId
 * 更新菜單項目
 * 權限：tenant_admin, store_manager
 */
router.put("/:itemId", 
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  updateMenuItem
);

/**
 * DELETE /api/menu-items/:itemId
 * 刪除菜單項目
 * 權限：tenant_admin, store_manager
 */
router.delete("/:itemId", 
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  deleteMenuItem
);

module.exports = router; 