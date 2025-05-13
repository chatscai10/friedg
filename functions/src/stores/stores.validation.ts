import { z } from 'zod';

// 地址子結構驗證 Schema
const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
}).optional();

// 地理位置子結構驗證 Schema
const locationSchema = z.object({
  latitude: z.number().min(-90).max(90).describe("緯度值，範圍從 -90 (南極) 到 90 (北極)"),
  longitude: z.number().min(-180).max(180).describe("經度值，範圍從 -180 (西) 到 180 (東)"),
}).optional();

// 聯絡資訊子結構驗證 Schema
const contactInfoSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  managerId: z.string().optional().describe("店長用戶ID"),
}).optional();

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
}).optional();

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
const businessHoursSchema = z.record(z.array(timeRangeSchema)).optional();

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
  tenantId: z.string().min(1),
  name: z.string().min(1).max(100),
  storeCode: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'temporary_closed', 'permanently_closed']),
  address: addressSchema,
  location: locationSchema,
  contactInfo: contactInfoSchema,
  operatingHours: businessHoursSchema,
  gpsFence: gpsFenceSchema,
  printerSettings: printerConfigSchema.optional(),
  attendanceSettings: updateStoreAttendanceSettingsSchema.optional(),
  settings: z.record(z.any()).optional()
});

// 更新分店請求驗證 Schema
export const updateStoreSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  storeCode: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'temporary_closed', 'permanently_closed']).optional(),
  address: addressSchema,
  location: locationSchema,
  contactInfo: contactInfoSchema,
  operatingHours: businessHoursSchema,
  gpsFence: gpsFenceSchema,
  printerSettings: printerConfigSchema.optional(),
  attendanceSettings: updateStoreAttendanceSettingsSchema.optional(),
  settings: z.record(z.any()).optional()
});

// 獲取店鋪列表請求驗證 Schema
export const listStoresQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  sort: z.enum(['createdAt', 'name', 'status']).default('createdAt').optional(),
  order: z.enum(['asc', 'desc']).default('desc').optional(),
  status: z.enum(['active', 'inactive', 'temporary_closed', 'permanently_closed']).optional(),
  tenantId: z.string().optional(),
  query: z.string().optional(),
}).optional();

// 獲取單個店鋪請求參數驗證 Schema
export const getStoreByIdParamsSchema = z.object({
  storeId: z.string().min(1),
});

// 更新店鋪請求參數驗證 Schema
export const updateStoreParamsSchema = z.object({
  storeId: z.string().min(1),
});

// 刪除店鋪請求參數驗證 Schema
export const deleteStoreParamsSchema = z.object({
  storeId: z.string().min(1),
});

// 刪除店鋪請求查詢參數驗證 Schema
export const deleteStoreQuerySchema = z.object({
  hardDelete: z.coerce.boolean().default(false).optional(),
}).optional();

// 更新店鋪狀態請求參數驗證 Schema
export const updateStoreStatusParamsSchema = z.object({
  storeId: z.string().min(1),
});

// 更新店鋪狀態請求體驗證 Schema
export const updateStoreStatusBodySchema = z.object({
  status: z.enum(['active', 'inactive', 'temporary_closed', 'permanently_closed']),
  reason: z.string().optional(),
});

// 更新店鋪 GPS 圍欄請求參數驗證 Schema
export const updateStoreGPSFenceParamsSchema = z.object({
  storeId: z.string().min(1),
});

// 更新店鋪 GPS 圍欄請求體驗證 Schema
export const updateStoreGPSFenceBodySchema = z.object({ 
  enabled: z.boolean(),
  radius: z.number().min(0),
  center: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }),
  allowedDeviation: z.number().min(0).optional()
});

// 更新店鋪印表機設定請求參數驗證 Schema
export const updateStorePrinterSettingsParamsSchema = z.object({
  storeId: z.string().min(1),
});

// 更新店鋪印表機設定請求體驗證 Schema
export const updateStorePrinterSettingsBodySchema = z.object({
  enabled: z.boolean(),
  apiUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  printerType: z.enum(['thermal', 'label', 'normal']).optional(),
  templates: z.object({
    receipt: z.string().optional(),
    kitchen: z.string().optional(),
    takeout: z.string().optional(),
  }).optional(),
});

// 更新店鋪營業時間請求參數驗證 Schema
export const updateStoreBusinessHoursParamsSchema = z.object({
  storeId: z.string().min(1),
});

// 更新店鋪營業時間請求體驗證 Schema
export const updateStoreBusinessHoursBodySchema = z.record(z.array(timeRangeSchema)).refine(data => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const day of days) {
    if (data[day] !== undefined && !Array.isArray(data[day])) {
      return false;
    }
  }
  return true;
}, { message: '營業時間格式無效' });

// 更新店鋪考勤設定請求參數驗證 Schema
export const updateStoreAttendanceSettingsParamsSchema = z.object({
  storeId: z.string().min(1),
});

// 更新店鋪考勤設定請求體驗證 Schema
export const updateStoreAttendanceSettingsBodySchema = z.object({
  lateThresholdMinutes: z.number().int().min(0).max(180),  
  earlyThresholdMinutes: z.number().int().min(0).max(180), 
  flexTimeMinutes: z.number().int().min(0).max(120),       
  requireApprovalForCorrection: z.boolean(),               
  autoClockOutEnabled: z.boolean(),                        
  autoClockOutTime: z.string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-5]$/)
    .optional()
    .nullable()
}).refine(data => {
  return !data.autoClockOutEnabled || 
        (data.autoClockOutEnabled && !!data.autoClockOutTime);
}, { message: '啟用自動下班打卡時必須提供自動下班時間' });

// 由於 updateStoreLocationSchema 在 types 中沒有對應接口且 API 規格中沒有此獨立 API，暫時註釋或刪除
// export const updateStoreLocationSchema = z.object({ ... });

// 移除舊的未使用的 schema
// const geoLocationSchema = z.object({...})

// 更新分店狀態請求驗證 Schema
export const updateStoreStatusSchema = z.object({
  isActive: z.boolean()
}); 