import { z } from 'zod';

// 地理位置驗證 Schema
const geoLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional()
});

// GPS 圍欄驗證 Schema
export const gpsFenceSchema = z.object({
  enabled: z.boolean(),
  radius: z.number().min(0),
  center: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }),
  allowedDeviation: z.number().min(0).optional()
});

// 新增 - 店鋪位置更新驗證 Schema
export const updateStoreLocationSchema = z.object({
  coordinates: z.object({
    latitude: z.number().min(-90).max(90)
      .describe("緯度值，範圍從 -90 (南極) 到 90 (北極)"),
    longitude: z.number().min(-180).max(180)
      .describe("經度值，範圍從 -180 (西) 到 180 (東)")
  }).describe("店鋪的地理座標"),
  geofenceRadius: z.number().min(0)
    .describe("地理圍欄半徑，單位為公尺")
});

/**
 * 時間範圍驗證模式
 */
const timeRangeSchema = z.object({
  start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
}).refine(data => {
  // 驗證結束時間晚於開始時間
  const [startHour, startMinute] = data.start.split(':').map(Number);
  const [endHour, endMinute] = data.end.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  return endMinutes > startMinutes;
}, { message: '結束時間必須晚於開始時間' });

// 營業時間驗證 Schema
const businessHoursSchema = z.object({
  monday: z.array(timeRangeSchema).min(0),
  tuesday: z.array(timeRangeSchema).min(0),
  wednesday: z.array(timeRangeSchema).min(0),
  thursday: z.array(timeRangeSchema).min(0),
  friday: z.array(timeRangeSchema).min(0),
  saturday: z.array(timeRangeSchema).min(0),
  sunday: z.array(timeRangeSchema).min(0),
  holidays: z.array(timeRangeSchema).optional()
});

/**
 * 更新分店營業時間
 */
export const updateStoreBusinessHoursSchema = z.object({
  businessHours: z.object({
    monday: z.array(timeRangeSchema).min(0),
    tuesday: z.array(timeRangeSchema).min(0),
    wednesday: z.array(timeRangeSchema).min(0),
    thursday: z.array(timeRangeSchema).min(0),
    friday: z.array(timeRangeSchema).min(0),
    saturday: z.array(timeRangeSchema).min(0),
    sunday: z.array(timeRangeSchema).min(0),
    holidays: z.array(timeRangeSchema).optional()
  })
});

/**
 * 更新分店考勤設定
 */
export const updateStoreAttendanceSettingsSchema = z.object({
  attendanceSettings: z.object({
    lateThresholdMinutes: z.number().int().min(0).max(180),  // 最多允許3小時的遲到閾值
    earlyThresholdMinutes: z.number().int().min(0).max(180), // 最多允許3小時的早退閾值
    flexTimeMinutes: z.number().int().min(0).max(120),       // 最多允許2小時的彈性時間
    requireApprovalForCorrection: z.boolean(),               // 補打卡是否需要審批
    autoClockOutEnabled: z.boolean(),                        // 是否啟用自動下班打卡
    autoClockOutTime: z.string()
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)            // HH:MM格式
      .optional()
      .nullable()
  }).refine(data => {
    // 如果啟用了自動下班打卡，則必須提供自動下班時間
    return !data.autoClockOutEnabled || 
          (data.autoClockOutEnabled && !!data.autoClockOutTime);
  }, { message: '啟用自動下班打卡時必須提供自動下班時間' })
});

// 印表機配置驗證 Schema
export const printerConfigSchema = z.object({
  receiptPrinter: z.object({
    name: z.string().min(1),
    model: z.string().min(1),
    ipAddress: z.string().optional(),
    port: z.number().optional(),
    connectionType: z.enum(['usb', 'network', 'bluetooth']),
    enabled: z.boolean(),
    paperWidth: z.number().optional(),
    paperHeight: z.number().optional()
  }).optional(),
  kitchenPrinters: z.record(z.object({
    name: z.string().min(1),
    model: z.string().min(1),
    ipAddress: z.string().optional(),
    port: z.number().optional(),
    connectionType: z.enum(['usb', 'network', 'bluetooth']),
    enabled: z.boolean()
  })).optional(),
  settings: z.object({
    autoPrint: z.boolean(),
    printCustomerCopy: z.boolean(),
    printMerchantCopy: z.boolean(),
    printLogo: z.boolean(),
    printQRCode: z.boolean(),
    fontSize: z.number().optional(),
    customHeader: z.string().optional(),
    customFooter: z.string().optional()
  }).optional()
});

// 創建分店請求驗證 Schema
export const createStoreSchema = z.object({
  storeName: z.string().min(1).max(100),
  storeCode: z.string().min(1).max(50),
  address: z.string().min(1).max(200),
  phoneNumber: z.string().min(1).max(20),
  contactPerson: z.string().min(1).max(50),
  email: z.string().email(),
  tenantId: z.string().min(1),
  isActive: z.boolean().optional().default(true),
  geolocation: geoLocationSchema.optional(),
  gpsFence: gpsFenceSchema.optional(),
  businessHours: businessHoursSchema.optional(),
  printerConfig: printerConfigSchema.optional(),
  settings: z.record(z.any()).optional()
});

// 更新分店請求驗證 Schema
export const updateStoreSchema = z.object({
  storeName: z.string().min(1).max(100).optional(),
  storeCode: z.string().min(1).max(50).optional(),
  address: z.string().min(1).max(200).optional(),
  phoneNumber: z.string().min(1).max(20).optional(),
  contactPerson: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  geolocation: geoLocationSchema.optional(),
  gpsFence: gpsFenceSchema.optional(),
  businessHours: businessHoursSchema.optional(),
  printerConfig: printerConfigSchema.optional(),
  settings: z.record(z.any()).optional()
});

// 更新分店狀態請求驗證 Schema
export const updateStoreStatusSchema = z.object({
  isActive: z.boolean()
}); 