/**
 * 薪資系統路由定義
 */
import { Router } from 'express';
import { withAuthentication, withTenantIsolation, withRole, withStoreIsolation } from '../middleware/auth.middleware';
import { triggerPayrollCalculation, listEmployeePayslips } from './payroll.handlers';

const payrollRouter = Router();

// POST /payroll/calculate - 觸發薪資計算
payrollRouter.post(
  '/calculate',
  withAuthentication,
  withTenantIsolation,
  withRole('tenant_admin'), // 需要租戶管理員或更高權限
  triggerPayrollCalculation
);

// GET /employees/{employeeId}/payslips - 獲取員工薪資單列表
payrollRouter.get(
  '/employees/:employeeId/payslips',
  withAuthentication,
  withTenantIsolation,
  withStoreIsolation,
  withRole('store_manager'), // 需要店鋪管理員或更高權限
  listEmployeePayslips
);

export default payrollRouter; 