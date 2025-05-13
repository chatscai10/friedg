"use strict";
/**
 * 核心參數驗證 Schema
 *
 * 使用 zod 庫定義核心參數的驗證規則
 * 這些 schema 可用於前端表單驗證和後端 API 數據驗證
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyNeedSchema = exports.branchesListSchema = exports.branchSchema = exports.scheduleMonthSchema = exports.positionSchema = exports.coordinatesSchema = exports.dailyOperatingHoursSchema = exports.businessHoursSchema = exports.timeRangeSchema = void 0;
const zod_1 = require("zod");
/**
 * 時間範圍驗證 schema
 */
exports.timeRangeSchema = zod_1.z.object({
    start: zod_1.z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: '時間格式無效，應為 HH:MM (24小時制)'
    }),
    end: zod_1.z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
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
exports.businessHoursSchema = zod_1.z.object({
    monday: zod_1.z.array(exports.timeRangeSchema).default([]),
    tuesday: zod_1.z.array(exports.timeRangeSchema).default([]),
    wednesday: zod_1.z.array(exports.timeRangeSchema).default([]),
    thursday: zod_1.z.array(exports.timeRangeSchema).default([]),
    friday: zod_1.z.array(exports.timeRangeSchema).default([]),
    saturday: zod_1.z.array(exports.timeRangeSchema).default([]),
    sunday: zod_1.z.array(exports.timeRangeSchema).default([]),
    holidays: zod_1.z.array(exports.timeRangeSchema).optional()
});
/**
 * 單日營業時間驗證 schema
 */
exports.dailyOperatingHoursSchema = zod_1.z.object({
    day: zod_1.z.number().min(0).max(6),
    isOpen: zod_1.z.boolean(),
    openTime: zod_1.z.string()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: '時間格式無效，應為 HH:MM (24小時制)'
    })
        .optional()
        .nullable(),
    closeTime: zod_1.z.string()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: '時間格式無效，應為 HH:MM (24小時制)'
    })
        .optional()
        .nullable(),
    breakStart: zod_1.z.string()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: '時間格式無效，應為 HH:MM (24小時制)'
    })
        .optional()
        .nullable(),
    breakEnd: zod_1.z.string()
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
exports.coordinatesSchema = zod_1.z.object({
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
    radius: zod_1.z.number().min(0).optional()
});
/**
 * 職位驗證 schema
 */
exports.positionSchema = zod_1.z.object({
    id: zod_1.z.enum(['cashier', 'server', 'chef', 'manager', 'cleaner']),
    name: zod_1.z.string().min(1, { message: '職位名稱不能為空' })
});
/**
 * 排班月份驗證 schema
 */
exports.scheduleMonthSchema = zod_1.z.object({
    year: zod_1.z.number().min(2000).max(2100),
    month: zod_1.z.number().min(1).max(12),
    startDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: '日期格式無效，應為 YYYY-MM-DD'
    }),
    endDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
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
exports.branchSchema = zod_1.z.object({
    storeId: zod_1.z.string().min(1, { message: '分店ID不能為空' }),
    storeName: zod_1.z.string().min(1, { message: '分店名稱不能為空' }),
    storeCode: zod_1.z.string().min(1, { message: '分店代碼不能為空' }),
    address: zod_1.z.string().min(1, { message: '地址不能為空' }),
    phoneNumber: zod_1.z.string().min(1, { message: '電話號碼不能為空' }),
    contactPerson: zod_1.z.string().min(1, { message: '聯絡人不能為空' }),
    email: zod_1.z.string().email({ message: '電子郵件格式無效' }),
    tenantId: zod_1.z.string().min(1, { message: '租戶ID不能為空' }),
    isActive: zod_1.z.boolean(),
    geolocation: exports.coordinatesSchema,
    businessHours: exports.businessHoursSchema,
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    createdBy: zod_1.z.string(),
    updatedBy: zod_1.z.string()
});
/**
 * 分店清單驗證 schema
 */
exports.branchesListSchema = zod_1.z.array(exports.branchSchema);
/**
 * 每日人力需求驗證 schema
 */
exports.dailyNeedSchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: '日期格式無效，應為 YYYY-MM-DD'
    }),
    storeId: zod_1.z.string().min(1, { message: '分店ID不能為空' }),
    minStaffPerShift: zod_1.z.record(zod_1.z.enum(['cashier', 'server', 'chef', 'manager', 'cleaner']), zod_1.z.number().min(0)),
    notes: zod_1.z.string().optional()
});
//# sourceMappingURL=ValidationSchema.js.map