const express = require("express");
const {
  createRole,
  // 以下是未來將實現的處理器函數
  getRoleById,
  listRoles,
  updateRole,
  deleteRole,
} = require("./roles.handlers");
const { checkAuth, checkRole } = require("../middleware/auth.middleware");

// eslint-disable-next-line new-cap
const router = express.Router();

// --- Role Routes (Require Authentication and Authorization) ---
// Apply middleware: checkAuth ensures user is logged in, checkRole checks specific permissions

// POST /api/roles (Create Role)
router.post("/", checkAuth, checkRole(["super_admin", "tenant_admin"]), createRole);

// GET /api/roles/{roleId} (Get Single Role)
router.get("/:roleId", checkAuth, checkRole(["super_admin", "tenant_admin", "store_manager"]), getRoleById);

// GET /api/roles (List Roles - with optional filters and pagination)
router.get("/", checkAuth, checkRole(["super_admin", "tenant_admin", "store_manager"]), listRoles);

// PUT /api/roles/{roleId} (Update Role - partial update)
router.put("/:roleId", checkAuth, checkRole(["super_admin", "tenant_admin"]), updateRole);

// DELETE /api/roles/{roleId} (Delete Role)
router.delete("/:roleId", checkAuth, checkRole(["super_admin", "tenant_admin"]), deleteRole);

module.exports = router; 