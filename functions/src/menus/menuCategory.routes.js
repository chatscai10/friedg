const express = require("express");
const { createMenuCategory, getMenuCategoryById, listMenuCategories, updateMenuCategory, deleteMenuCategory } = require("./menuCategory.handlers");

// 導入標準 RBAC 和 Auth 中間件，替換舊有的中間件
const { withAuthentication } = require("../middleware/auth.middleware");
const { withTenantIsolation, withRole } = require("../middleware/tenant.middleware");

// eslint-disable-next-line new-cap
const router = express.Router();

/**
 * GET /api/menu-categories
 * 獲取菜單分類列表
 * 權限：tenant_admin, store_manager
 */
router.get("/", 
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  listMenuCategories
);

/**
 * POST /api/menu-categories
 * 創建新的菜單分類
 * 權限：tenant_admin, store_manager
 */
router.post("/", 
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  createMenuCategory
);

/**
 * GET /api/menu-categories/:categoryId
 * 獲取單一菜單分類詳情
 * 權限：tenant_admin, store_manager
 */
router.get("/:categoryId", 
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  getMenuCategoryById
);

/**
 * PUT /api/menu-categories/:categoryId
 * 更新菜單分類
 * 權限：tenant_admin, store_manager
 */
router.put("/:categoryId", 
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  updateMenuCategory
);

/**
 * DELETE /api/menu-categories/:categoryId
 * 刪除菜單分類
 * 權限：tenant_admin
 */
router.delete("/:categoryId", 
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin"]),
  deleteMenuCategory
);

module.exports = router; 