import { z } from 'zod';

// 基本的聯絡資訊驗證模式
export const ContactInfoSchema = z.object({
  email: z.string().email('無效的電子郵件格式').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
}).optional();

// 排班偏好驗證模式
export const ScheduleSchema = z.object({
  preferredShifts: z.array(
    z.enum(['morning', 'afternoon', 'evening', 'night'])
  ).optional(),
  maxHoursPerWeek: z.number().positive().optional(),
  daysUnavailable: z.array(
    z.number().min(0).max(6)
  ).optional(),
}).optional();

// 薪資資訊驗證模式
export const PayInfoSchema = z.object({
  hourlyRate: z.number().nonnegative().optional(),
  baseSalary: z.number().nonnegative().optional(),
  salaryType: z.enum(['hourly', 'monthly', 'annual']).optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  accountName: z.string().optional(),
}).optional();

// 勿擾時段設定驗證模式
export const QuietHoursSchema = z.object({
  enabled: z.boolean(),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, '時間格式必須為 HH:MM'),
  endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, '時間格式必須為 HH:MM'),
}).optional();

// 僱用資訊驗證模式
export const EmploymentInfoSchema = z.object({
  roleId: z.string().optional(),
  roleName: z.string().optional(),
  roleLevel: z.number().int().min(1).max(10),
}).optional();

// 創建員工請求體驗證模式
export const CreateEmployeeSchema = z.object({
  userId: z.string().optional(),
  tenantId: z.string().min(1, '租戶ID不能為空'),
  storeId: z.string().min(1, '店鋪ID不能為空'),
  additionalStoreIds: z.array(z.string()).optional(),
  employeeCode: z.string().optional(),
  firstName: z.string().min(1, '名字不能為空'),
  lastName: z.string().min(1, '姓氏不能為空'),
  position: z.string().min(1, '職位不能為空'),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern', 'temporary']),
  status: z.enum(['active', 'inactive', 'on_leave', 'terminated']).default('active'),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必須為 YYYY-MM-DD').optional(),
  terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必須為 YYYY-MM-DD').optional(),
  contactInfo: ContactInfoSchema,
  photoURL: z.string().url('無效的 URL 格式').optional(),
  schedule: ScheduleSchema,
  employmentInfo: EmploymentInfoSchema,
  payInfo: PayInfoSchema,
  quietHours: QuietHoursSchema,
});

// 更新員工請求體驗證模式 (所有欄位均為可選)
export const UpdateEmployeeSchema = z.object({
  firstName: z.string().min(1, '名字不能為空').optional(),
  lastName: z.string().min(1, '姓氏不能為空').optional(),
  storeId: z.string().optional(),
  additionalStoreIds: z.array(z.string()).optional(),
  position: z.string().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern', 'temporary']).optional(),
  status: z.enum(['active', 'inactive', 'on_leave', 'terminated']).optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必須為 YYYY-MM-DD').optional(),
  terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必須為 YYYY-MM-DD').optional(),
  contactInfo: ContactInfoSchema,
  photoURL: z.string().url('無效的 URL 格式').optional(),
  schedule: ScheduleSchema,
  employmentInfo: z.object({
    roleId: z.string().optional(),
    roleName: z.string().optional(),
    roleLevel: z.number().int().min(1).max(10).optional(),
  }).optional(),
  payInfo: PayInfoSchema,
  quietHours: QuietHoursSchema,
});

// 查詢員工參數驗證模式
export const GetEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['createdAt', 'firstName', 'lastName', 'position', 'status', 'hireDate']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['active', 'inactive', 'on_leave', 'terminated']).optional(),
  storeId: z.string().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern', 'temporary']).optional(),
  position: z.string().optional(),
  query: z.string().optional(),
});

// 路徑參數驗證模式 (employeeId)
export const EmployeeIdParamsSchema = z.object({
  employeeId: z.string().min(1, '員工ID不能為空'),
}); 