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
const { checkAuth, checkRole } = require("../middleware/auth.middleware"); // Uncommented middleware import

// eslint-disable-next-line new-cap
const router = express.Router();

// --- Public Routes ---
// GET /api/menus/store/{storeId} - Get menu for a specific store (for customer PWA)
router.get("/store/:storeId", getMenuForStore);

// --- Admin Routes (Require Authentication & Authorization) ---

// Categories
router.get("/categories", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), getAllMenuCategories);
router.post("/categories", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), createMenuCategory); // Enabled route
router.get("/categories/store/:storeId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), getMenuCategoriesByStore);
router.put("/categories/:categoryId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), updateMenuCategory);
router.delete("/categories/:categoryId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), deleteMenuCategory);

// Items
router.post("/items", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), createMenuItem); // Enabled route
router.get("/items/category/:categoryId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), getMenuItemsByCategory); // New route
// router.get("/items", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), getMenuItems);
router.put("/items/:itemId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), updateMenuItem); // New route
router.delete("/items/:itemId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), deleteMenuItem); // New route

// Options
router.post("/options", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), createMenuOption); // New route
router.get("/options/item/:itemId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), getMenuOptionsByItem); // New route
router.put("/options/:optionId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), updateMenuOption); // New route
router.delete("/options/:optionId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), deleteMenuOption); // New route

module.exports = router;
