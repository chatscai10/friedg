const express = require("express");
const {
  createStore,
  // 以下是未來將實現的處理器函數
  getStoreById,
  listStores,
  updateStore,
  deleteStore,
} = require("./store.handlers");
const { checkAuth, checkRole } = require("../middleware/auth.middleware");

// eslint-disable-next-line new-cap
const router = express.Router();

// --- Store Routes (Require Authentication and Authorization) ---
// Apply middleware: checkAuth ensures user is logged in, checkRole checks specific permissions

// POST /api/stores (Create Store)
router.post("/", checkAuth, checkRole(["TenantAdmin"]), createStore);

// GET /api/stores/{storeId} (Get Single Store)
router.get("/:storeId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), getStoreById);

// GET /api/stores (List Stores - with optional filters and pagination)
router.get("/", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), listStores);

// PUT /api/stores/{storeId} (Update Store)
router.put("/:storeId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), updateStore);

// DELETE /api/stores/{storeId} (Soft Delete Store)
router.delete("/:storeId", checkAuth, checkRole(["TenantAdmin"]), deleteStore);

module.exports = router; 