/**
 * 財務模組類型定義
 */

import { Timestamp } from 'firebase-admin/firestore';

/**
 * 月度利潤報告
 */
export interface MonthlyProfitReport {
  id?: string;                 // 文檔ID (通常為 {storeId}_{yyyyMM})
  storeId: string;             // 店鋪ID
  tenantId: string;            // 租戶ID
  year: number;                // 年份
  month: number;               // 月份 (1-12)
  
  // 營收數據
  totalSales: number;          // 總銷售額
  
  // 成本數據
  costOfGoodsSold: number;     // 銷貨成本
  costCalculationMethod: 'actual' | 'estimated'; // 成本計算方法：實際或估算
  
  // 費用數據
  operatingExpenses: number;   // 營運費用
  
  // 稅前利潤
  profitBeforeTax: number;     // 稅前利潤
  
  // 稅金
  tax: number;                 // 稅金
  taxRate: number;             // 適用稅率
  
  // 稅後利潤
  netProfitAfterTax: number;   // 稅後淨利
  
  // 報告元數據
  reportDate: Timestamp;       // 報告日期 (通常是月末日期)
  calculatedAt: Timestamp;     // 計算時間
  status: ReportStatus;        // 報告狀態
  
  // 可選數據
  notes?: string;              // 備註
  adjustments?: ProfitAdjustment[]; // 調整項目
}

/**
 * 報告狀態
 */
export enum ReportStatus {
  DRAFT = 'draft',             // 草稿
  APPROVED = 'approved',       // 已審核
  ARCHIVED = 'archived',       // 已歸檔
  REJECTED = 'rejected'        // 被拒絕
}

/**
 * 利潤調整項目
 */
export interface ProfitAdjustment {
  type: AdjustmentType;        // 調整類型
  amount: number;              // 調整金額 (正數為增加利潤，負數為減少利潤)
  reason: string;              // 調整原因
  adjustedBy: string;          // 調整者
  adjustedAt: Timestamp;       // 調整時間
}

/**
 * 調整類型
 */
export enum AdjustmentType {
  EXPENSE_CORRECTION = 'expense_correction', // 費用更正
  REVENUE_CORRECTION = 'revenue_correction', // 收入更正
  TAX_ADJUSTMENT = 'tax_adjustment',        // 稅金調整
  OTHER = 'other'                            // 其他
}

/**
 * 季度財務報告
 */
export interface QuarterlyFinancialReport {
  id?: string;                 // 文檔ID (通常為 {storeId}_{yyyy}Q{q})
  storeId: string;             // 店鋪ID
  tenantId: string;            // 租戶ID
  year: number;                // 年份
  quarter: number;             // 季度 (1-4)
  
  // 彙總數據
  grossRevenue: number;        // 營業總收入
  totalExpenses: number;       // 總支出
  
  // 利潤數據
  netProfitBeforeTax: number;  // 稅前淨利
  tax: number;                 // 稅金
  netProfitAfterTax: number;   // 稅後淨利
  
  // 報告元數據
  reportDate: Timestamp;       // 報告日期 (通常是季末日期)
  calculatedAt: Timestamp;     // 計算時間
  status: ReportStatus;        // 報告狀態
  
  // 可選數據
  notes?: string;              // 備註
  monthlyBreakdown?: {         // 月度明細
    [month: number]: {
      revenue: number;
      expenses: number;
      profit: number;
    }
  };
} 