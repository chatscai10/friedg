import apiClient from './api';

/**
 * 薪資單類型定義
 */
export interface Payslip {
  id: string;
  payslipNumber: string;
  tenantId: string;
  storeId: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  salaryType: 'hourly' | 'monthly' | 'commission';
  employeeName: string;
  position: string;
  currency: string;
  earnings: {
    baseSalary: number;
    regularHours?: number;
    regularPay?: number;
    overtimeHours?: {
      rate1?: number;
      rate2?: number;
    };
    overtimePay?: {
      rate1?: number;
      rate2?: number;
    };
    holidayHours?: number;
    holidayPay?: number;
    salesAmount?: number;
    commission?: number;
    bonuses?: Array<{
      bonusId: string;
      name: string;
      amount: number;
      description?: string;
    }>;
    otherEarnings?: Array<{
      name: string;
      amount: number;
      description?: string;
    }>;
    totalEarnings: number;
  };
  deductions: {
    laborInsurance?: number;
    healthInsurance?: number;
    taxWithholding?: number;
    laborPension?: number;
    welfareFee?: number;
    otherDeductions?: Array<{
      name: string;
      amount: number;
      description?: string;
    }>;
    totalDeductions: number;
  };
  netPay: number;
  notes?: string;
  status: 'pending' | 'processing' | 'paid' | 'rejected' | 'cancelled';
  statusHistory?: Array<{
    status: string;
    timestamp: string;
    updatedBy: string;
    reason?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  isConfirmed: boolean;
  confirmedAt?: string;
  confirmationComments?: string;
}

/**
 * 分頁回應類型
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * 薪資計算請求類型
 */
export interface PayrollCalculationRequest {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  storeId?: string;
  generatePayslip?: boolean;
  saveDraft?: boolean;
}

/**
 * 工資計算結果類型
 */
export interface GrossSalaryResult {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  salaryType: 'hourly' | 'monthly' | 'commission';
  regularHours?: number;
  regularPay?: number;
  overtimeHours?: {
    rate1?: number;
    rate2?: number;
  };
  overtimePay?: {
    rate1?: number;
    rate2?: number;
  };
  holidayHours?: number;
  holidayPay?: number;
  baseSalary?: number;
  workingDays?: number;
  totalWorkDays?: number;
  proRatedSalary?: number;
  commissionBaseSalary?: number;
  salesAmount?: number;
  commissionAmount?: number;
  totalGrossSalary: number;
}

/**
 * 獎金計算結果類型
 */
export interface BonusResult {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  bonusItems: Array<{
    bonusId: string;
    bonusType: string;
    name: string;
    amount: number;
    description?: string;
    calculationType: string;
    condition?: string;
  }>;
  totalBonusAmount: number;
}

/**
 * 扣除計算結果類型
 */
export interface DeductionResult {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  deductionItems: Array<{
    deductionType: 'laborInsurance' | 'healthInsurance' | 'taxWithholding' | 'laborPension' | 'welfareFee' | 'other';
    name: string;
    amount: number;
    description?: string;
    calculationBase?: number;
    rate?: number;
  }>;
  totalDeductionAmount: number;
}

/**
 * 薪資計算回應類型
 */
export interface PayrollCalculationResponse {
  success: boolean;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  salaryType: 'hourly' | 'monthly' | 'commission';
  grossSalary: GrossSalaryResult;
  bonuses: BonusResult;
  deductions: DeductionResult;
  netPay: number;
  currency: string;
  payslip?: Payslip;
}

/**
 * 觸發指定員工和週期的薪資計算
 * @param employeeId 員工ID
 * @param periodStart 計薪週期開始日期 (YYYY-MM-DD)
 * @param periodEnd 計薪週期結束日期 (YYYY-MM-DD)
 * @param storeId 店鋪ID (可選)
 * @param generatePayslip 是否生成薪資單 (預設 true)
 * @param saveDraft 是否保存為草稿 (預設 false)
 * @returns 計算結果，包含薪資信息
 */
export const triggerPayrollCalculation = async (
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  storeId?: string,
  generatePayslip: boolean = true,
  saveDraft: boolean = false
): Promise<PayrollCalculationResponse> => {
  try {
    const response = await apiClient.post('/payroll/calculate', {
      employeeId,
      periodStart,
      periodEnd,
      storeId,
      generatePayslip,
      saveDraft
    });
    return response.data;
  } catch (error) {
    console.error('薪資計算請求失敗:', error);
    throw error;
  }
};

/**
 * 獲取指定員工的薪資單列表
 * @param employeeId 員工ID
 * @param params 查詢參數 (開始日期、結束日期、頁碼、每頁數量等)
 * @returns 分頁的薪資單列表
 */
export const listEmployeePayslips = async (
  employeeId: string,
  params?: {
    startDate?: string;
    endDate?: string;
    status?: 'pending' | 'processing' | 'paid' | 'rejected' | 'cancelled';
    page?: number;
    limit?: number;
  }
): Promise<PaginatedResponse<Payslip>> => {
  try {
    const response = await apiClient.get(`/employees/${employeeId}/payslips`, {
      params
    });
    return response.data;
  } catch (error) {
    console.error('獲取薪資單列表失敗:', error);
    throw error;
  }
}; 