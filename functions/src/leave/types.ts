/**
 * 請假系統的資料類型定義
 */

import { Timestamp } from 'firebase-admin/firestore';

/**
 * 請假申請資料結構
 */
export interface LeaveRequest {
  leaveId: string;         // 主鍵，請假ID
  tenantId: string;        // 租戶ID（隔離欄位）
  storeId: string;         // 分店ID
  employeeId: string;      // 申請員工ID
  employeeName?: string;   // 員工姓名
  leaveType: LeaveType;    // 請假類型
  startDate: string;       // 開始日期 (YYYY-MM-DD)
  endDate: string;         // 結束日期 (YYYY-MM-DD)
  startTime?: string;      // 開始時間 (HH:MM) - 用於時薪制的小時計算
  endTime?: string;        // 結束時間 (HH:MM) - 用於時薪制的小時計算
  totalDays: number;       // 請假總天數
  totalHours?: number;     // 請假總小時數 (用於時薪制)
  reason: string;          // 請假原因
  attachmentUrls?: string[]; // 證明文件URL列表
  status: LeaveStatus;     // 狀態
  approverNotes?: string;  // 審批者備註
  approverId?: string;     // 審批者ID
  approvedAt?: Timestamp;  // 審批時間
  reviewerId?: string;     // 審核者ID
  reviewerName?: string;   // 審核者姓名
  reviewedAt?: Timestamp;  // 審核時間
  reviewComment?: string;  // 審核意見
  createdAt: Timestamp;    // 創建時間
  updatedAt: Timestamp;    // 更新時間
  updatedBy?: string;      // 更新者ID
  affectedSchedules?: string[]; // 受影響的排班ID
  deductionDetail?: {      // 扣除明細
    regularDeduction: number;   // 正常扣除
    penaltyDeduction?: number;  // 罰則扣除 (如禁休日)
    totalDeduction: number;     // 總扣除
  };
}

/**
 * 請假類型枚舉
 */
export type LeaveType = 'annual' | 'sick' | 'personal' | 'maternity' | 'bereavement' | 'unpaid' | 'other';

/**
 * 請假狀態枚舉
 */
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';

/**
 * 請假餘額資料結構
 */
export interface LeaveBalance {
  balanceId: string;       // 主鍵
  tenantId: string;        // 租戶ID（隔離欄位）
  employeeId: string;      // 員工ID
  year: number;            // 年度
  balances: {              // 各類型假期餘額
    annual: number;        // 特休
    sick: number;          // 病假
    personal: number;      // 事假
    maternity: number;     // 產假
    bereavement: number;   // 喪假
    other: number;         // 其他
  };
  used: {                  // 已使用天數
    annual: number;        // 特休
    sick: number;          // 病假
    personal: number;      // 事假
    maternity: number;     // 產假
    bereavement: number;   // 喪假
    other: number;         // 其他
  };
  lastUpdated: Timestamp;  // 最後更新時間
  createdAt: Timestamp;    // 創建時間
}

/**
 * 禁休日期資料結構
 */
export interface RestrictedLeaveDate {
  restrictedDateId: string; // 主鍵
  tenantId: string;         // 租戶ID（隔離欄位）
  storeId: string;          // 分店ID
  startDate: string;        // 開始日期 (YYYY-MM-DD)
  endDate: string;          // 結束日期 (YYYY-MM-DD)
  reason: string;           // 原因
  penaltyMultiplier: number; // 扣除倍數
  applyToLeaveTypes: LeaveType[]; // 適用的請假類型
  createdBy: string;        // 創建者ID
  createdAt: Timestamp;     // 創建時間
  updatedAt: Timestamp;     // 更新時間
  isActive: boolean;        // 是否啟用
} 