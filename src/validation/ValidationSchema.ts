/**
 * 核心參數驗證 Schema
 * 
 * 使用 zod 庫定義核心參數的驗證規則
 * 這些 schema 可用於前端表單驗證和後端 API 數據驗證
 */

import { z } from 'zod';
import { ScheduleRole } from '../types/core-params';

/**
 * 時間範圍驗證 schema
 */
export const timeRangeSchema = z.object({
  start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: '時間格式無效，應為 HH:MM (24小時制)'
  }),
  end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: '時間格式無效，應為 HH:MM (24小時制)'
  })
}).refine(data => {
  // 驗證結束時間晚於開始時間
  const [startHour, startMinute] = data.start.split(':').map(Number);
  const [endHour, endMinute] = data.end.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  return endMinutes > startMinutes;
}, { message: '結束時間必須晚於開始時間' });

/**
 * 營業時間驗證 schema
 */
export const businessHoursSchema = z.object({
  monday: z.array(timeRangeSchema).default([]),
  tuesday: z.array(timeRangeSchema).default([]),
  wednesday: z.array(timeRangeSchema).default([]),
  thursday: z.array(timeRangeSchema).default([]),
  friday: z.array(timeRangeSchema).default([]),
  saturday: z.array(timeRangeSchema).default([]),
  sunday: z.array(timeRangeSchema).default([]),
  holidays: z.array(timeRangeSchema).optional()
});

/**
 * 單日營業時間驗證 schema
 */
export const dailyOperatingHoursSchema = z.object({
  day: z.number().min(0).max(6),
  isOpen: z.boolean(),
  openTime: z.string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
      message: '時間格式無效，應為 HH:MM (24小時制)'
    })
    .optional()
    .nullable(),
  closeTime: z.string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
      message: '時間格式無效，應為 HH:MM (24小時制)'
    })
    .optional()
    .nullable(),
  breakStart: z.string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
      message: '時間格式無效，應為 HH:MM (24小時制)'
    })
    .optional()
    .nullable(),
  breakEnd: z.string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
      message: '時間格式無效，應為 HH:MM (24小時制)'
    })
    .optional()
    .nullable()
}).refine(data => {
  // 如果有營業時間，則必須同時有開始和結束時間
  if (data.isOpen) {
    return !!data.openTime && !!data.closeTime;
  }
  return true;
}, { message: '營業時間必須同時設定開始和結束時間' })
.refine(data => {
  // 如果有休息時間，則必須同時有開始和結束時間
  if (data.breakStart || data.breakEnd) {
    return !!data.breakStart && !!data.breakEnd;
  }
  return true;
}, { message: '休息時間必須同時設定開始和結束時間' });

/**
 * 座標驗證 schema
 */
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(0).optional()
});

/**
 * 職位驗證 schema
 */
export const positionSchema = z.object({
  id: z.enum(['cashier', 'server', 'chef', 'manager', 'cleaner'] as [ScheduleRole, ...ScheduleRole[]]),
  name: z.string().min(1, { message: '職位名稱不能為空' })
});

/**
 * 排班月份驗證 schema
 */
export const scheduleMonthSchema = z.object({
  year: z.number().min(2000).max(2100),
  month: z.number().min(1).max(12),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: '日期格式無效，應為 YYYY-MM-DD'
  }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: '日期格式無效，應為 YYYY-MM-DD'
  })
}).refine(data => {
  // 驗證結束日期晚於開始日期
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  return endDate >= startDate;
}, { message: '結束日期必須晚於或等於開始日期' });

/**
 * 分店驗證 schema
 */
export const branchSchema = z.object({
  storeId: z.string().min(1, { message: '分店ID不能為空' }),
  storeName: z.string().min(1, { message: '分店名稱不能為空' }),
  storeCode: z.string().min(1, { message: '分店代碼不能為空' }),
  address: z.string().min(1, { message: '地址不能為空' }),
  phoneNumber: z.string().min(1, { message: '電話號碼不能為空' }),
  contactPerson: z.string().min(1, { message: '聯絡人不能為空' }),
  email: z.string().email({ message: '電子郵件格式無效' }),
  tenantId: z.string().min(1, { message: '租戶ID不能為空' }),
  isActive: z.boolean(),
  geolocation: coordinatesSchema,
  businessHours: businessHoursSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string()
});

/**
 * 分店清單驗證 schema
 */
export const branchesListSchema = z.array(branchSchema);

/**
 * 每日人力需求驗證 schema
 */
export const dailyNeedSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: '日期格式無效，應為 YYYY-MM-DD'
  }),
  storeId: z.string().min(1, { message: '分店ID不能為空' }),
  minStaffPerShift: z.record(z.enum(['cashier', 'server', 'chef', 'manager', 'cleaner'] as [ScheduleRole, ...ScheduleRole[]]), z.number().min(0)),
  notes: z.string().optional()
}); 