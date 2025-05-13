import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ClockSource, ClockType } from './attendance.types';
import { validateBody } from '../middleware/validation.middleware';

/**
 * 設備資訊驗證結構
 */
const deviceInfoSchema = z.object({
  deviceId: z.string().optional(),
  platform: z.string().optional(),
  model: z.string().optional(), 
  osVersion: z.string().optional()
}).optional();

/**
 * 打卡請求的共通基本結構驗證
 */
export const clockRequestSchema = z.object({
  latitude: z.number({
    required_error: '緯度是必填欄位',
    invalid_type_error: '緯度必須是數字'
  })
    .min(-90, '緯度必須介於 -90 到 90 之間')
    .max(90, '緯度必須介於 -90 到 90 之間'),
  
  longitude: z.number({
    required_error: '經度是必填欄位',
    invalid_type_error: '經度必須是數字'
  })
    .min(-180, '經度必須介於 -180 到 180 之間')
    .max(180, '經度必須介於 -180 到 180 之間'),
  
  deviceInfo: deviceInfoSchema,
  
  notes: z.string().max(200, '備註不能超過 200 個字').optional()
});

/**
 * 上班打卡請求的驗證結構
 */
export const clockInRequestSchema = clockRequestSchema;

/**
 * 下班打卡請求的驗證結構
 */
export const clockOutRequestSchema = clockRequestSchema;

/**
 * 驗證上班打卡請求的中間件
 */
export const validateClockInRequest = validateBody(clockInRequestSchema);

/**
 * 驗證下班打卡請求的中間件
 */
export const validateClockOutRequest = validateBody(clockOutRequestSchema);

/**
 * 驗證特定權限的中間件
 * 確保只有員工或店長可以打卡
 */
export const validateEmployeeAccess = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      status: 'error',
      message: '未授權：缺少有效的用戶憑證'
    });
  }
  
  // 只允許員工相關角色打卡
  const allowedRoles = ['employee', 'store_manager', 'cashier', 'staff'];
  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({
      status: 'error',
      message: '未授權：您沒有進行打卡的權限'
    });
  }
  
  next();
};

/**
 * 手動打卡請求驗證 Schema (管理員用)
 */
export const manualPunchRequestSchema = z.object({
  employeeId: z.string().min(1, '員工 ID 不能為空'),
  storeId: z.string().min(1, '分店 ID 不能為空'),
  timestamp: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d+)?Z?$/, '時間格式必須為 ISO 格式'),
  type: z.enum(['punch-in', 'punch-out'], { 
    errorMap: () => ({ message: '打卡類型必須為 punch-in 或 punch-out' })
  }),
  latitude: z.number()
    .min(-90, '緯度必須在 -90 到 90 之間')
    .max(90, '緯度必須在 -90 到 90 之間')
    .optional(),
  longitude: z.number()
    .min(-180, '經度必須在 -180 到 180 之間')
    .max(180, '經度必須在 -180 到 180 之間')
    .optional(),
  notes: z.string().max(500, '備註不能超過 500 個字元').optional()
});

/**
 * 獲取考勤記錄列表請求驗證 Schema
 */
export const listAttendanceLogsSchema = z.object({
  employeeId: z.string().optional(),
  storeId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '開始日期格式必須為 YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '結束日期格式必須為 YYYY-MM-DD').optional(),
  type: z.enum(['punch-in', 'punch-out'], { 
    errorMap: () => ({ message: '打卡類型必須為 punch-in 或 punch-out' })
  }).optional(),
  isWithinFence: z.boolean().optional().or(
    z.enum(['true', 'false']).transform(val => val === 'true')
  ),
  source: z.enum(['mobile-app', 'web-admin-manual', 'kiosk']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number)
    .or(z.number())
    .refine(val => val >= 1 && val <= 100, '每頁記錄數必須在 1 到 100 之間')
    .optional()
    .default(10),
  page: z.string().regex(/^\d+$/).transform(Number)
    .or(z.number())
    .refine(val => val >= 1, '頁碼必須大於等於 1')
    .optional()
    .default(1),
  sortBy: z.enum(['timestamp', 'employeeId', 'storeId', 'type', 'createdAt']).optional().default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
}); 