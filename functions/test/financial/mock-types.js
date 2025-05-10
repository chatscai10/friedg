/**
 * 財務模組類型定義的模擬
 */

// 報告狀態
const ReportStatus = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  ARCHIVED: 'archived',
  REJECTED: 'rejected' // 被拒絕
};

// 調整類型
const AdjustmentType = {
  EXPENSE_CORRECTION: 'expense_correction',
  REVENUE_CORRECTION: 'revenue_correction',
  TAX_ADJUSTMENT: 'tax_adjustment',
  OTHER: 'other' // 其他
};

module.exports = {
  ReportStatus,
  AdjustmentType
}; 