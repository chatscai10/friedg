const express = require("express");
const {
  createEmployee,
  getEmployeeById,
  listEmployeesByStore,
  updateEmployee,
  deleteEmployee,
} = require("./employee.handlers");
const { checkAuth, checkRole } = require("../middleware/auth.middleware"); // Placeholder middleware

// eslint-disable-next-line new-cap
const router = express.Router();

// --- Admin Routes (Require Authentication and Authorization) ---
// Apply middleware: checkAuth ensures user is logged in, checkRole checks specific permissions

// POST /api/admin/employees/ (Create Employee)
router.post("/", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), createEmployee);

// GET /api/admin/employees/{employeeId} (Get Single Employee)
router.get("/:employeeId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), getEmployeeById);

// GET /api/admin/employees/?storeId={storeId} (List Employees by Store - with pagination)
// Note: Query parameter handling is done in the handler
router.get("/", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), listEmployeesByStore);

// PUT /api/admin/employees/{employeeId} (Update Employee)
router.put("/:employeeId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), updateEmployee);

// DELETE /api/admin/employees/{employeeId} (Delete/Disable Employee)
router.delete("/:employeeId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), deleteEmployee);

module.exports = router;
