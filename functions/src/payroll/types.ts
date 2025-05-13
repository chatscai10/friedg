/**
 * 薪資與獎金系統 - 資料類型定義
 * 依據整合專案報告設計規範實作
 */

import { Timestamp } from 'firebase-admin/firestore';

/**
 * 薪資類型枚舉
 */
export enum SalaryType {
  HOURLY = 'hourly',     // 時薪制
  MONTHLY = 'monthly',   // 月薪制
  COMMISSION = 'commission', // 提成制
}

/**
 * 獎金類型枚舉
 */
export enum BonusType {
  PERFORMANCE = 'performance',  // 績效獎金
  ATTENDANCE = 'attendance',    // 全勤獎金
  SALES = 'sales',              // 銷售獎金
  REFERRAL = 'referral',        // 推薦獎金
  YEAR_END = 'yearEnd',         // 年終獎金
  SPECIAL = 'special',          // 特殊獎金（如：專案完成獎金）
}

/**
 * 支付狀態枚舉
 */
export enum PaymentStatus {
  PENDING = 'pending',     // 待處理
  PROCESSING = 'processing', // 處理中
  PAID = 'paid',           // 已支付
  REJECTED = 'rejected',   // 已拒絕
  CANCELLED = 'cancelled'  // 已取消
}

/**
 * 員工薪資設定 (employeeSalaryConfigs)
 */
export interface EmployeeSalaryConfig {
  id: string;               // 文檔ID
  tenantId: string;         // 租戶ID
  storeId: string;          // 店鋪ID
  employeeId: string;       // 員工ID
  salaryType: SalaryType;   // 薪資類型
  
  // 基本薪資/時薪率/底薪 (視薪資類型而定)
  baseSalary: number;       // 月薪制的月薪或時薪制的基本時薪
  
  // 時薪制特有欄位
  hourlyRates?: {
    regular: number;        // 一般時薪
    overtime1: number;      // 加班費倍率1 (例如首2小時 1.33倍)
    overtime2: number;      // 加班費倍率2 (例如超過2小時 1.66倍)
    holiday: number;        // 假日時薪倍率
  };
  
  // 月薪制特有欄位
  monthlySettings?: {
    workingDaysPerMonth: number;  // 每月工作天數
    workingHoursPerDay: number;   // 每日工作時數
    overtimeHourlyRate: number;   // 加班時薪計算基礎
  };
  
  // 提成制特有欄位
  commissionSettings?: {
    baseSalary: number;      // 底薪
    commissionRate: number;  // 提成比率 (百分比，例如 5 表示5%)
    commissionThreshold: number; // 提成門檻金額
    commissionCap?: number;  // 提成上限 (可選)
  };
  
  // 通用設定
  payFrequency: 'weekly' | 'biweekly' | 'monthly'; // 發薪週期
  payDay: number;            // 發薪日 (例如每月15日，則填15)
  laborInsurance: boolean;   // 是否提供勞保
  healthInsurance: boolean;  // 是否提供健保
  taxWithholding: boolean;   // 是否預扣所得稅
  bankAccountInfo?: {        // 銀行帳戶資訊 (可選)
    bankName: string;        // 銀行名稱
    branchName: string;      // 分行名稱
    accountName: string;     // 戶名
    accountNumber: string;   // 帳號
  };
  
  // 審計欄位
  effectiveFrom: Timestamp;  // 生效日期
  effectiveTo?: Timestamp;   // 失效日期 (可選，未設置表示目前有效)
  createdAt: Timestamp;      // 創建時間
  updatedAt: Timestamp;      // 更新時間
  createdBy: string;         // 創建人ID
  updatedBy: string;         // 更新人ID
  
  // 勞工退休金設定
  laborPension?: {
    voluntaryContribution: boolean;  // 是否自願提繳
    voluntaryRate: number;           // 自願提繳比例 (0-6%)
  };
  
  // 職工福利金設定
  welfareFee?: {
    enabled: boolean;               // 是否啟用職工福利金
    rate: number;                   // 提撥比例 (通常為0.5%)
  };
  
  // 其他設定
  allowances?: Array<{   // 津貼設定
    name: string;        // 津貼名稱
    amount: number;      // 金額
    taxable: boolean;    // 是否課稅
  }>;
}

/**
 * 獎金規則 (bonusRules)
 */
export interface BonusRule {
  id: string;               // 文檔ID
  tenantId: string;         // 租戶ID
  storeId?: string;         // 店鋪ID (可選，如果是全租戶通用)
  
  name: string;             // 獎金規則名稱
  description: string;      // 獎金規則描述
  bonusType: BonusType;     // 獎金類型
  
  // 獎金計算設定
  calculationType: 'fixed' | 'percentage' | 'formula'; // 計算類型：固定金額、百分比、公式
  
  // 根據計算類型，填寫以下欄位之一
  fixedAmount?: number;     // 固定金額 (calculationType = 'fixed')
  
  percentageSettings?: {    // 百分比設定 (calculationType = 'percentage')
    baseField: string;      // 基礎欄位 (如 'baseSalary', 'monthlyPay')
    percentage: number;     // 百分比值 (例如 10 表示10%)
  };
  
  formulaSettings?: {       // 公式設定 (calculationType = 'formula')
    formula: string;        // 計算公式 (JavaScript表達式)
    parameters: Record<string, string>; // 公式參數說明
  };
  
  // 觸發條件
  conditionType: 'always' | 'sales_target' | 'attendance' | 'performance'; // 條件類型
  
  // 根據條件類型，填寫以下欄位之一
  salesTargetCondition?: {  // 銷售目標條件 (conditionType = 'sales_target')
    targetAmount: number;   // 目標金額
    period: 'daily' | 'weekly' | 'monthly'; // 計算週期
    minimumPercentage?: number; // 最低達成百分比，達到才能獲得獎金
  };
  
  attendanceCondition?: {   // 出勤條件 (conditionType = 'attendance')
    fullAttendance: boolean; // 是否需要全勤
    maxLateTimes?: number;  // 最多允許遲到次數
    maxEarlyLeaveTimes?: number; // 最多允許早退次數
    period: 'weekly' | 'monthly'; // 計算週期
  };
  
  performanceCondition?: {  // 績效條件 (conditionType = 'performance')
    minimumRating: number;  // 最低績效評分
    period: 'monthly' | 'quarterly' | 'yearly'; // 計算週期
  };
  
  // 適用對象
  applicableToAll: boolean;           // 是否適用於所有員工
  applicablePositions?: string[];     // 適用的職位 (如果不適用於所有員工)
  applicableEmployeeIds?: string[];   // 適用的特定員工ID (如果有)
  
  // 審計欄位
  isActive: boolean;        // 是否啟用
  effectiveFrom: Timestamp; // 生效日期
  effectiveTo?: Timestamp;  // 失效日期 (可選)
  createdAt: Timestamp;     // 創建時間
  updatedAt: Timestamp;     // 更新時間
  createdBy: string;        // 創建人ID
  updatedBy: string;        // 更新人ID
}

/**
 * 薪資單 (payslips)
 */
export interface Payslip {
  id: string;               // 文檔ID
  payslipNumber: string;    // 薪資單編號 (格式可能為 YYYYMM-EMPID)
  tenantId: string;         // 租戶ID
  storeId: string;          // 店鋪ID
  employeeId: string;       // 員工ID
  
  // 薪資期間
  periodStart: Timestamp;   // 計薪週期開始日期
  periodEnd: Timestamp;     // 計薪週期結束日期
  payDate: Timestamp;       // 發薪日期
  
  // 基本資訊
  salaryType: SalaryType;   // 薪資類型
  employeeName: string;     // 員工姓名 (冗餘儲存)
  position: string;         // 職位 (冗餘儲存)
  
  // 薪資金額
  currency: string;         // 貨幣 (預設 TWD)
  
  // 收入項目
  earnings: {
    baseSalary: number;     // 基本薪資/底薪
    
    // 時薪制特有
    regularHours?: number;  // 一般工時
    regularPay?: number;    // 一般工時薪資
    overtimeHours?: {       // 加班時數
      rate1: number;        // 加班時數 (倍率1)
      rate2: number;        // 加班時數 (倍率2)
    };
    overtimePay?: {         // 加班費
      rate1: number;        // 加班費 (倍率1)
      rate2: number;        // 加班費 (倍率2)
    };
    holidayHours?: number;  // 假日工時
    holidayPay?: number;    // 假日薪資
    
    // 提成制特有
    salesAmount?: number;   // 銷售金額
    commission?: number;    // 提成金額
    
    // 獎金項目
    bonuses: Array<{
      bonusId: string;      // 獎金規則ID
      name: string;         // 獎金名稱
      amount: number;       // 獎金金額
      description: string;  // 說明
    }>;
    
    // 其他收入
    otherEarnings: Array<{
      name: string;         // 名稱
      amount: number;       // 金額
      description: string;  // 說明
    }>;
    
    totalEarnings: number;  // 總收入
  };
  
  // 扣除項目
  deductions: {
    laborInsurance?: number;     // 勞保費
    healthInsurance?: number;    // 健保費
    taxWithholding?: number;     // 預扣稅額
    
    // 其他扣除項目
    otherDeductions: Array<{
      name: string;         // 名稱 
      amount: number;       // 金額
      description: string;  // 說明
    }>;
    
    totalDeductions: number; // 總扣除金額
  };
  
  // 最終金額
  netPay: number;           // 實發金額
  
  // 備註
  notes?: string;           // 備註說明
  
  // 狀態追蹤
  status: PaymentStatus;    // 支付狀態
  statusHistory: Array<{
    status: PaymentStatus;  // 狀態
    timestamp: Timestamp;   // 時間戳
    updatedBy: string;      // 更新人ID
    reason?: string;        // 原因 (可選)
  }>;
  
  // 關聯記錄
  relatedAttendanceRecordIds?: string[]; // 關聯的出勤記錄ID (時薪制適用)
  relatedScheduleIds?: string[];         // 關聯的排班記錄ID (可能用於核對)
  relatedSalesRecordIds?: string[];      // 關聯的銷售記錄ID (提成制適用)
  
  // 審計欄位
  createdAt: Timestamp;     // 創建時間
  updatedAt: Timestamp;     // 更新時間
  createdBy: string;        // 創建人ID
  updatedBy: string;        // 更新人ID
  
  // 員工確認
  isConfirmed: boolean;           // 員工是否已確認
  confirmedAt?: Timestamp;        // 確認時間
  confirmationComments?: string;  // 確認意見
}

/**
 * 薪資計算請求類型 (用於API請求，非資料庫結構)
 */
export interface PayrollCalculationRequest {
  tenantId: string;         // 租戶ID
  storeId: string;          // 店鋪ID
  employeeId?: string;      // 員工ID (可選，不填則計算所有員工)
  periodStart: string;      // 計薪週期開始日期 (YYYY-MM-DD)
  periodEnd: string;        // 計薪週期結束日期 (YYYY-MM-DD)
  generatePayslip: boolean; // 是否生成薪資單
  saveDraft: boolean;       // 是否保存為草稿
}

/**
 * 員工薪資統計報表 (非資料庫結構)
 */
export interface PayrollSummary {
  tenantId: string;                // 租戶ID
  storeId: string;                 // 店鋪ID
  periodStart: string;             // 統計週期開始
  periodEnd: string;               // 統計週期結束
  totalEmployees: number;          // 員工總數
  totalGrossPay: number;           // 總支出薪資
  departments?: Record<string, {   // 各部門統計
    employeeCount: number;         // 員工數
    totalPay: number;              // 總支出
  }>;
  employeeTypes?: Record<string, { // 各類型員工統計 (全職/兼職)
    employeeCount: number;         // 員工數
    totalPay: number;              // 總支出
  }>;
  salaryTypes?: Record<string, {   // 各薪資類型統計
    employeeCount: number;         // 員工數
    totalPay: number;              // 總支出
  }>;
} 