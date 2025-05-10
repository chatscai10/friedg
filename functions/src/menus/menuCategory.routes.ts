import express from 'express';
import { 
  createMenuCategory, 
  getMenuCategoryById, 
  listMenuCategories, 
  updateMenuCategory, 
  deleteMenuCategory 
} from './menuCategory.handlers';

// 導入標準 RBAC 和 Auth 中間件
const { withAuthentication } = require("../middleware/auth.middleware");
const { withTenantIsolation, withRole } = require("../middleware/tenant.middleware");

// 導入請求驗證中間件和驗證schema
import { validateRequest } from '../middleware/validation.middleware';
import { 
  MenuCategoryInputSchema, 
  UpdateMenuCategorySchema,
  MenuCategoryQueryParamsSchema,
  CategoryIdParamsSchema
} from './menuCategory.validators';

// 創建路由器實例
const router = express.Router();

/**
 * GET /api/menu-categories
 * 獲取菜單分類列表
 * 權限：tenant_admin, store_manager, store_staff
 */
router.get("/", 
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager", "store_staff"]),
  validateRequest(MenuCategoryQueryParamsSchema, "query"),
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
  validateRequest(MenuCategoryInputSchema), // 新增的Zod驗證中間件
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
  validateRequest(CategoryIdParamsSchema, "params"),
  validateRequest(UpdateMenuCategorySchema, "body"),
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
  validateRequest(CategoryIdParamsSchema, "params"),
  deleteMenuCategory
);

export default router; 