/**
 * 通用資料驗證工具
 * 使用 zod 實現強大的資料驗證和類型安全
 */

import * as functions from 'firebase-functions';
import { z } from 'zod';

/**
 * 驗證請求資料是否符合指定的 schema
 * 
 * @param data 要驗證的資料
 * @param schema zod schema
 * @returns 驗證並轉換後的資料
 * @throws Functions HTTPS Error 如果驗證失敗
 */
export function validateData<T extends z.ZodType>(
  data: unknown,
  schema: T
): z.infer<T> {
  try {
    // 使用 zod 驗證並轉換資料
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // 處理 zod 驗證錯誤，提供更友好的錯誤訊息
      const errorMessages = error.errors.map(err => {
        const path = err.path.join('.');
        return `${path ? `${path}: ` : ''}${err.message}`;
      });
      
      throw new functions.https.HttpsError(
        'invalid-argument',
        `請求資料驗證失敗: ${errorMessages.join('; ')}`
      );
    }
    
    // 處理其他例外
    throw new functions.https.HttpsError(
      'internal',
      '資料驗證過程中發生未知錯誤'
    );
  }
}

/**
 * 建立部分驗證器，允許傳入的資料比 schema 定義的少
 * 適用於更新操作
 * 
 * @param schema 原始的 zod schema
 * @returns 部分驗證的 schema
 */
export function createPartialSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial();
}

/**
 * 建立擴展 schema，包含額外的字段
 * 
 * @param baseSchema 基礎 schema
 * @param extension 擴展的 schema shape
 * @returns 擴展後的 schema
 */
export function extendSchema<T extends z.ZodRawShape, E extends z.ZodRawShape>(
  baseSchema: z.ZodObject<T>,
  extension: E
) {
  return baseSchema.extend(extension);
}

/**
 * 安全轉換日期字串為 Date 對象
 */
export const safeDate = z.preprocess((arg) => {
  if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
  return arg;
}, z.date().refine((date) => !isNaN(date.getTime()), {
  message: "無效的日期格式"
}));

/**
 * 安全地將任何值轉換為整數
 */
export const safeInteger = z.preprocess((arg) => {
  return typeof arg === 'string' ? parseInt(arg, 10) : arg;
}, z.number().int().refine((n) => !isNaN(n), {
  message: "必須是有效的整數"
}));

/**
 * 安全地將任何值轉換為浮點數
 */
export const safeFloat = z.preprocess((arg) => {
  return typeof arg === 'string' ? parseFloat(arg) : arg;
}, z.number().refine((n) => !isNaN(n), {
  message: "必須是有效的數字"
}));

/**
 * 驗證 UUID 格式
 */
export const uuidSchema = z.string().uuid({
  message: "必須是有效的UUID格式"
});

/**
 * 驗證 ISO 日期格式
 */
export const isoDateString = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/,
  { message: "必須是有效的ISO日期格式" }
);

/**
 * 驗證 YYYY-MM-DD 日期格式
 */
export const dateOnlyString = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  { message: "必須是有效的日期格式 (YYYY-MM-DD)" }
);

/**
 * 驗證電子郵件
 */
export const emailSchema = z.string().email({
  message: "必須是有效的電子郵件地址"
});

/**
 * 驗證台灣手機號碼
 */
export const taiwanPhoneSchema = z.string().regex(
  /^09\d{8}$/,
  { message: "必須是有效的台灣手機號碼 (格式: 09XXXXXXXX)" }
);

/**
 * 驗證台灣身分證字號
 */
export const taiwanIdSchema = z.string().regex(
  /^[A-Z][12]\d{8}$/,
  { message: "必須是有效的台灣身分證字號格式" }
);

/**
 * 常用的分頁查詢參數 schema
 */
export const paginationSchema = z.object({
  page: safeInteger.optional().default(1),
  pageSize: safeInteger.optional().default(20),
  sortField: z.string().optional().default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).optional().default('desc')
});

/**
 * 常用的日期範圍查詢參數 schema
 */
export const dateRangeSchema = z.object({
  startDate: dateOnlyString.optional(),
  endDate: dateOnlyString.optional()
});

/**
 * 常用的店鋪參數 schema
 */
export const storeParamsSchema = z.object({
  storeId: z.string().min(1, "店鋪ID不能為空")
});

/**
 * 常用的租戶參數 schema
 */
export const tenantParamsSchema = z.object({
  tenantId: z.string().min(1, "租戶ID不能為空")
}); 