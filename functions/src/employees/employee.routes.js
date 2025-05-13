const express = require("express");
const {
  createEmployee,
  getEmployeeById,
  listEmployeesByStore,
  updateEmployee,
  deleteEmployee,
} = require("./employee.handlers");

// 導入現有的 RBAC 和認證中間件
const { withAuthentication } = require("../middleware/auth.middleware");
const { withTenantIsolation, withRole } = require("../middleware/tenant.middleware");

// eslint-disable-next-line new-cap
const router = express.Router();

// 創建轉換層，將雲函數類型的處理函數與Express結合
const convertCloudFunctionToExpressHandler = (cloudFunction) => {
  return async (req, res) => {
    try {
      // 使用req.body作為數據，req.user作為用戶信息調用雲函數處理器
      const result = await cloudFunction(req.body, { auth: req.user }, req.user);
      // 返回成功響應
      return res.status(201).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      console.error(`處理請求時發生錯誤: ${error.message}`);
      return res.status(400).json({
        status: "error",
        message: error.message || "處理請求時發生錯誤",
      });
    }
  };
};

// --- 員工路由 (使用已測試的 RBAC 中間件) ---

// POST /api/employees (建立員工) - 需要 tenant_admin 或 store_manager 角色
router.post("/",
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  convertCloudFunctionToExpressHandler(createEmployee),
);

// GET /api/employees/{employeeId} (獲取單個員工)
router.get("/:employeeId",
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  (req, res) => {
    getEmployeeById(req, res);
  },
);

// GET /api/employees/?storeId={storeId} (列出商店員工 - 含分頁)
router.get("/",
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  (req, res) => {
    listEmployeesByStore(req, res);
  },
);

// PUT /api/employees/{employeeId} (更新員工)
router.put("/:employeeId",
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  (req, res) => {
    updateEmployee(req, res);
  },
);

// DELETE /api/employees/{employeeId} (刪除/禁用員工)
router.delete("/:employeeId",
  withAuthentication,
  withTenantIsolation,
  withRole(["tenant_admin", "store_manager"]),
  (req, res) => {
    deleteEmployee(req, res);
  },
);

module.exports = router;
