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

// 時間範圍驗證 Schema
const timeRangeSchema = z.object({
  start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
});

// 營業時間驗證 Schema
const businessHoursSchema = z.object({
  monday: z.array(timeRangeSchema),
  tuesday: z.array(timeRangeSchema),
  wednesday: z.array(timeRangeSchema),
  thursday: z.array(timeRangeSchema),
  friday: z.array(timeRangeSchema),
  saturday: z.array(timeRangeSchema),
  sunday: z.array(timeRangeSchema),
  holidays: z.array(timeRangeSchema).optional()
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