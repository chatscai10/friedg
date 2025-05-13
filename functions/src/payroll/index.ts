// export from service.ts
export {
  calculateGrossSalary,
  calculateBonuses,
  calculateDeductions,
  generatePayslip,
  scheduleOneTimeDeduction
} from './service';

// export from types.ts
export type {
  SalaryType,
  PaymentStatus,
  BonusType,
  EmployeeSalaryConfig,
  Payslip
} from './types';

// export from handlers.ts
export {
  generatePayslipHandler,
  previewPayrollCalculationHandler
} from './handlers';

// 這些處理函式已經集成了RBAC/Auth中間件:
// - generatePayslipHandler: 需要租戶管理員(tenant_admin)或更高權限，並應用租戶隔離
// - previewPayrollCalculationHandler: 需要店鋪管理員(store_manager)或更高權限，並應用租戶和店鋪隔離 