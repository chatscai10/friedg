import { z } from 'zod';
import { StoreStatus } from '../types/store';

/**
 * 創建店鋪表單驗證模式
 */
export const createStoreSchema = z.object({
  name: z.string()
    .min(2, { message: '店鋪名稱至少需要2個字符' })
    .max(50, { message: '店鋪名稱不能超過50個字符' }),
  
  storeCode: z.string()
    .max(20, { message: '店鋪代碼不能超過20個字符' })
    .optional(),
  
  description: z.string()
    .max(500, { message: '描述不能超過500個字符' })
    .optional(),
  
  status: z.enum(['active', 'inactive', 'temporary_closed', 'permanently_closed'] as const),
  
  address: z.object({
    street: z.string().max(100).optional(),
    city: z.string().max(50).optional(),
    state: z.string().max(50).optional(),
    postalCode: z.string().max(20).optional(),
    country: z.string().max(50).optional(),
    fullAddress: z.string().max(255).optional(),
  }).optional(),
  
  contactInfo: z.object({
    email: z.string().email({ message: '請輸入有效的電子郵件' }).optional(),
    phone: z.string().max(20).optional(),
    managerId: z.string().optional(),
    managerName: z.string().max(50).optional(),
  }).optional(),
});

/**
 * 創建店鋪表單值類型
 */
export type CreateStoreFormValues = z.infer<typeof createStoreSchema>;

/**
 * 更新店鋪表單驗證模式
 */
export const updateStoreSchema = createStoreSchema.partial();

/**
 * 更新店鋪表單值類型
 */
export type UpdateStoreFormValues = z.infer<typeof updateStoreSchema>;

/**
 * 店鋪地理位置表單驗證模式
 */
export const storeLocationSchema = z.object({
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  gpsFence: z.object({
    enabled: z.boolean(),
    radius: z.number().min(10).max(5000).optional(),
    center: z.object({
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    }).optional(),
  }).optional(),
});

/**
 * 店鋪營業時間表單驗證模式
 */
export const storeOperatingHoursSchema = z.object({
  operatingHours: z.array(
    z.object({
      day: z.number().min(0).max(6),
      isOpen: z.boolean(),
      openTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      closeTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    })
  )
});

/**
 * 店鋪考勤設定表單驗證模式
 */
export const updateStoreAttendanceSettingsSchema = z.object({
  attendanceSettings: z.object({
    lateThresholdMinutes: z.number().min(0).max(180), // 遲到閾值 0-180分鐘
    earlyThresholdMinutes: z.number().min(0).max(180), // 早退閾值 0-180分鐘
    flexTimeMinutes: z.number().min(0).max(120), // 彈性打卡時間 0-120分鐘
    requireApprovalForCorrection: z.boolean(), // 是否需要審批補卡
    autoClockOutEnabled: z.boolean(), // 是否啟用自動打下班卡
    autoClockOutTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional() // HH:MM 格式的時間
      .refine(
        (val, ctx) => {
          // 如果啟用了自動打下班卡，則必須有時間
          const autoClockOutEnabled = (ctx.path && ctx.path.length > 1) ? 
            // @ts-ignore - 這裡我們知道ctx.path的結構
            ctx.parent?.autoClockOutEnabled : false;
            
          if (autoClockOutEnabled && !val) {
            return false;
          }
          return true;
        },
        {
          message: "啟用自動打下班卡時必須設置時間",
          path: ["autoClockOutTime"],
        }
      ),
  }),
});

/**
 * 店鋪考勤設定表單值類型
 */
export type UpdateStoreAttendanceSettingsFormValues = z.infer<typeof updateStoreAttendanceSettingsSchema>; 