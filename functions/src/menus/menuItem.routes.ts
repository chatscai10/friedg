import express from 'express';
import { createMenuItem, getMenuItemById, listMenuItems, updateMenuItem, deleteMenuItem } from './menuItem.handlers';

// 導入標準 RBAC 和 Auth 中間件
const { checkAuth, checkRole } = require("../middleware/auth.middleware");
const { withTenantIsolation } = require("../middleware/tenant.middleware");

// 導入請求驗證中間件和驗證 schema
import { validateRequest } from '../middleware/validation.middleware';
import { 
  MenuItemInputSchema, 
  UpdateMenuItemInputSchema, 
  MenuItemStatusUpdateSchema,
  ListMenuItemsQuerySchema,
  MenuItemIdParamsSchema
} from './menuItem.validators';

// 創建路由器實例
const router = express.Router();

/**
 * GET /api/menu-items
 * 獲取菜單品項列表
 * 權限：tenant_admin, store_manager, cashier, kitchen_staff
 */
router.get('/', 
  checkAuth,
  checkRole(['tenant_admin', 'store_manager', 'cashier', 'kitchen_staff']),
  validateRequest(ListMenuItemsQuerySchema, 'query'),
  listMenuItems
);

/**
 * POST /api/menu-items
 * 創建新的菜單品項
 * 權限：tenant_admin, store_manager
 */
router.post('/', 
  checkAuth,
  checkRole(['tenant_admin', 'store_manager']),
  validateRequest(MenuItemInputSchema),
  createMenuItem
);

/**
 * GET /api/menu-items/:itemId
 * 獲取單一菜單品項詳情
 * 權限：tenant_admin, store_manager, cashier, kitchen_staff
 */
router.get('/:itemId', 
  checkAuth,
  checkRole(['tenant_admin', 'store_manager', 'cashier', 'kitchen_staff']),
  validateRequest(MenuItemIdParamsSchema, 'params'),
  getMenuItemById
);

/**
 * PUT /api/menu-items/:itemId
 * 更新菜單品項
 * 權限：tenant_admin, store_manager
 */
router.put('/:itemId', 
  checkAuth,
  checkRole(['tenant_admin', 'store_manager']),
  validateRequest(MenuItemIdParamsSchema, 'params'),
  validateRequest(UpdateMenuItemInputSchema),
  updateMenuItem
);

/**
 * DELETE /api/menu-items/:itemId
 * 刪除菜單品項
 * 權限：tenant_admin, store_manager
 */
router.delete('/:itemId', 
  checkAuth,
  checkRole(['tenant_admin', 'store_manager']),
  validateRequest(MenuItemIdParamsSchema, 'params'),
  deleteMenuItem
);

/**
 * PATCH /api/menu-items/:itemId/status
 * 更新菜單品項狀態
 * 權限：tenant_admin, store_manager
 */
router.patch('/:itemId/status',
  checkAuth,
  checkRole(['tenant_admin', 'store_manager']),
  validateRequest(MenuItemStatusUpdateSchema),
  (req, res) => {
    res.status(501).json({
      success: false,
      message: '更新菜單品項狀態功能尚未實現'
    });
  }
);

export default router; 