/**
 * 排班角色類型
 */
export type ScheduleRole = 'cashier' | 'server' | 'chef' | 'manager' | 'cleaner' | string;

/**
 * 排班狀態
 */
export type ScheduleStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled';

/**
 * 排班詳情類型
 */
export interface Schedule {
  scheduleId: string;
  employeeId: string;
  employeeName?: string; // 便於前端顯示
  storeId: string;
  storeName?: string; // 便於前端顯示
  startTime: string; // ISO 格式日期時間
  endTime: string; // ISO 格式日期時間
  role: ScheduleRole;
  status: ScheduleStatus;
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * 建立排班請求類型
 */
export interface CreateScheduleRequest {
  employeeId: string;
  storeId: string;
  startTime: string; // ISO 格式日期時間
  endTime: string; // ISO 格式日期時間
  role: ScheduleRole;
  note?: string;
}

/**
 * 更新排班請求類型
 */
export interface UpdateScheduleRequest {
  employeeId?: string;
  storeId?: string;
  startTime?: string; // ISO 格式日期時間
  endTime?: string; // ISO 格式日期時間
  role?: ScheduleRole;
  status?: ScheduleStatus;
  note?: string;
}

/**
 * 排班API響應格式
 */
export interface SchedulesResponse {
  schedules: Schedule[];
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

/**
 * 單個排班API響應格式
 */
export interface ScheduleResponse {
  schedule: Schedule;
}

/**
 * 排班角色列表響應
 */
export interface ScheduleRolesResponse {
  roles: {
    id: string;
    name: string;
    description?: string;
  }[];
} 