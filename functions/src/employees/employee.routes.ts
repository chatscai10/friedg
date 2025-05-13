import express from 'express';
import { 
  createEmployee, 
  getEmployeeById, 
  listEmployees, 
  updateEmployee, 
  deleteEmployee,
  addEmployeeHandler
} from './employee.handlers';

// 導入驗證中間件
import { validateRequest } from '../middleware/validation.middleware';
import { 
  CreateEmployeeSchema, 
  UpdateEmployeeSchema, 
  GetEmployeesQuerySchema, 
  EmployeeIdParamsSchema 
} from './employee.validators';

// 導入 RBAC 和認證中間件
import { withAuthentication } from '../middleware/auth.middleware';
import { withTenantIsolation, withRole } from '../middleware/tenant.middleware';

const router = express.Router();

// POST /employees - 創建員工
// 需要 tenant_admin 或 store_manager 角色權限
router.post('/',
  withAuthentication,
  withTenantIsolation,
  withRole(['tenant_admin', 'store_manager']),
  validateRequest({ body: CreateEmployeeSchema }),
  createEmployee
);

// GET /employees/{employeeId} - 獲取單個員工
// 需要 tenant_admin 或 store_manager 角色權限
router.get('/:employeeId',
  withAuthentication,
  withTenantIsolation,
  withRole(['tenant_admin', 'store_manager']),
  validateRequest({ params: EmployeeIdParamsSchema }),
  getEmployeeById
);

// GET /employees - 獲取員工列表
// 需要 tenant_admin 或 store_manager 角色權限
router.get('/',
  withAuthentication,
  withTenantIsolation,
  withRole(['tenant_admin', 'store_manager']),
  validateRequest({ query: GetEmployeesQuerySchema }),
  listEmployees
);

// PUT /employees/{employeeId} - 更新員工
// 需要 tenant_admin 或 store_manager 角色權限
router.put('/:employeeId',
  withAuthentication,
  withTenantIsolation,
  withRole(['tenant_admin', 'store_manager']),
  validateRequest({ 
    params: EmployeeIdParamsSchema,
    body: UpdateEmployeeSchema 
  }),
  updateEmployee
);

// DELETE /employees/{employeeId} - 刪除員工
// 修改：允許 tenant_admin 或 store_manager 執行邏輯刪除
router.delete('/:employeeId',
  withAuthentication,
  withTenantIsolation,
  withRole(['tenant_admin', 'store_manager']),
  validateRequest({ params: EmployeeIdParamsSchema }),
  deleteEmployee
);

// POST /api/employees - 新增員工 (簡化版)
router.post('/',
  withAuthentication,
  withTenantIsolation,
  withRole(['tenant_admin', 'store_manager']),
  addEmployeeHandler
);

export default router; 