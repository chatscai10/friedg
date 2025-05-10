const express = require("express");
const {
  getMenuForStore,
  createMenuCategory,
  getMenuCategoriesByStore,
  updateMenuCategory,
  deleteMenuCategory,
  createMenuItem,
  getMenuItemsByCategory,
  updateMenuItem,
  deleteMenuItem,
  // Placeholders for Admin CRUD handlers
  // getMenuCategories, updateMenuCategory, deleteMenuCategory,
  // createMenuItem, getMenuItems, updateMenuItem, deleteMenuItem,
  // createMenuOption, getMenuOptions, updateMenuOption, deleteMenuOption,
  // Import new option handlers
  createMenuOption,
  getMenuOptionsByItem,
  updateMenuOption,
  deleteMenuOption,
  getAllMenuCategories,
} = require("./menu.handlers");

// 導入標準 RBAC 和 Auth 中間件，替換舊有的中間件
const { withAuthentication } = require("../middleware/auth.middleware");
const { withTenantIsolation, withRole } = require("../middleware/tenant.middleware");

// eslint-disable-next-line new-cap
const router = express.Router();

// --- Public Routes ---
// GET /api/menus/store/{storeId} - Get menu for a specific store (for customer PWA)
router.get("/store/:storeId", getMenuForStore);

// 公開菜單 API - GET /menu 映射到 getMenuForStore
// 為了向後相容，這將保持與 /store/:storeId 端點相同的處理函數
router.get("/", (req, res) => {
  // 從查詢參數獲取 storeId，作為必要參數
  const storeId = req.query.storeId;
  
  if (!storeId) {
    return res.status(400).send({ 
      success: false, 
      message: "缺少必要的 storeId 查詢參數" 
    });
  }
  
  // 將 storeId 添加到請求參數中，以便重用 getMenuForStore 處理函數
  req.params.storeId = storeId;
  
  // 調用現有處理程序
  return getMenuForStore(req, res);
});

// --- Admin Routes (Require Authentication & Authorization) ---

// Categories
router.get(
  "/categories", 
  withAuthentication, 
  withTenantIsolation, 
  withRole(["tenant_admin", "store_manager"]), 
  getAllMenuCategories
);

router.post(
  "/categories", 
  withAuthentication, 
  withTenantIsolation, 
  withRole(["tenant_admin", "store_manager"]), 
  createMenuCategory
);

router.get(
  "/categories/store/:storeId", 
  withAuthentication, 
  withTenantIsolation, 
  withRole(["tenant_admin", "store_manager"]), 
  getMenuCategoriesByStore
);

router.put(
  "/categories/:categoryId", 
  withAuthentication, 
  withTenantIsolation, 
  withRole(["tenant_admin", "store_manager"]), 
  updateMenuCategory
);

router.delete(
  "/categories/:categoryId", 
  withAuthentication, 
  withTenantIsolation, 
  withRole(["tenant_admin"]), // 僅租戶管理員可刪除
  deleteMenuCategory
);

// Items
router.post(
  "/items", 
  withAuthentication, 
  withTenantIsolation, 
  withRole(["tenant_admin", "store_manager"]), 
  createMenuItem
);

router.get(
  "/items/category/:categoryId", 
  withAuthentication, 
  withTenantIsolation, 
  withRole(["tenant_admin", "store_manager"]), 
  getMenuItemsByCategory
);

router.put(
  "/items/:itemId", 
  withAuthentication, 
  withTenantIsolation, 
  withRole(["tenant_admin", "store_manager"]), 
  updateMenuItem
);

router.delete(
  "/items/:itemId", 
  withAuthentication, 
  withTenantIsolation, 
  withRole(["tenant_admin", "store_manager"]), 
  deleteMenuItem
);

// Options
router.post(
  "/options", 
  withAuthentication, 
  withTenantIsolation, 
  withRole(["tenant_admin", "store_manager"]), 
  createMenuOption
);

router.get(
  "/options/item/:itemId", 
  withAuthentication, 
  withTenantIsolation, 
  withRole(["tenant_admin", "store_manager"]), 
  getMenuOptionsByItem
);

router.put(
  "/options/:optionId", 
  withAuthentication, 
  withTenantIsolation, 
  withRole(["tenant_admin", "store_manager"]), 
  updateMenuOption
);

router.delete(
  "/options/:optionId", 
  withAuthentication, 
  withTenantIsolation, 
  withRole(["tenant_admin", "store_manager"]), 
  deleteMenuOption
);

// 修復菜單的接口
router.get('/fix-menu', async (req, res) => {
  try {
    // 返回修復菜單的腳本或執行修復操作
    console.log('修復菜單 API 被調用');
    // 在這裡進行菜單修復邏輯
    res.status(200).json({ 
      success: true, 
      message: '菜單修復成功',
      script: `console.log('菜單修復腳本已執行');
      // 修復選單點擊問題
      document.querySelectorAll('.MuiListItemButton-root').forEach(btn => {
        btn.addEventListener('click', (e) => {
          console.log('菜單項目被點擊:', e.currentTarget);
          const path = e.currentTarget.getAttribute('data-path') || e.currentTarget.querySelector('.MuiListItemText-root').textContent.trim();
          if (path) {
            console.log('嘗試導航到:', path);
            window.location.href = '/menu';
          }
        });
      });`
    });
  } catch (error) {
    console.error('修復菜單失敗:', error);
    res.status(500).json({ success: false, error: '修復菜單失敗' });
  }
});

module.exports = router;
