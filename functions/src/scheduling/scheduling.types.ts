/**
 * 排班與請假模組的核心介面定義
 */

/**
 * 班表資料結構
 */
export interface Schedule {
  scheduleId: string;
  employeeId: string;
  storeId: string;
  tenantId: string;
  startTime: Date | string; // ISO 格式字串 "YYYY-MM-DDTHH:MM:SS.sssZ"
  endTime: Date | string;   // ISO 格式字串 "YYYY-MM-DDTHH:MM:SS.sssZ"
  role: string;
  notes?: string;
  status: ScheduleStatus;
  confirmedAt?: Date | string;
  confirmedBy?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy: string;
}

/**
 * 班表狀態類型
 */
export type ScheduleStatus = 'draft' | 'published' | 'confirmed' | 'cancelled';

/**
 * 假期類別資料結構
 */
export interface LeaveType {
  leaveTypeId: string;
  name: string;
  description: string;
  requiresApproval: boolean;
  tenantId?: string; // 如果為全局設定，則為空
  affectsSalary: boolean; // 是否影響薪資計算
  salaryPercentage?: number; // 如果 affectsSalary 為 true，則表示薪資百分比 (0-100)
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * 請假申請資料結構
 */
export interface LeaveRequest {
  requestId: string;
  employeeId: string;
  storeId: string;
  tenantId: string;
  leaveTypeId: string;
  startTime: Date | string;
  endTime: Date | string;
  reason: string;
  status: LeaveRequestStatus;
  requestedAt: Date | string;
  approvedBy?: string;
  approvedAt?: Date | string;
  rejectionReason?: string;
  attachmentUrls?: string[]; // 請假附件 URL (如醫療證明)
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * 請假申請狀態類型
 */
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * 排班查詢參數
 */
export interface ScheduleQueryParams {
  employeeId?: string;
  storeId?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  status?: ScheduleStatus;
}

/**
 * 創建排班請求
 */
export interface CreateScheduleRequest {
  employeeId: string;
  storeId: string;
  startTime: string; // ISO 格式字串
  endTime: string;   // ISO 格式字串
  role: string;
  notes?: string;
}

/**
 * 更新排班請求
 */
export interface UpdateScheduleRequest {
  startTime?: string;
  endTime?: string;
  role?: string;
  notes?: string;
  status?: ScheduleStatus;
}

/**
 * 確認排班請求
 */
export interface ConfirmScheduleRequest {
  scheduleId: string;
}

/**
 * 排班回應
 */
export interface ScheduleResponse {
  schedule: Schedule;
}

/**
 * 排班列表回應
 */
export interface ScheduleListResponse {
  schedules: Schedule[];
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
} 