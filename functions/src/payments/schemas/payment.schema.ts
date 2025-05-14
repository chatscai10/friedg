/**
 * 支付系統資料驗證 Schema
 * 使用 zod 實現強型別驗證
 */

import { z } from 'zod';
import { 
  safeInteger, 
  safeFloat,
  emailSchema,
  uuidSchema,
  dateOnlyString, 
  isoDateString
} from '../../libs/validation/schema';

/**
 * 支付方式枚舉
 */
export const PaymentMethodEnum = z.enum([
  'CASH',
  'CREDIT_CARD',
  'LINE_PAY',
  'JKOPAY',
  'APPLE_PAY',
  'GOOGLE_PAY'
]);

/**
 * 支付狀態枚舉
 */
export const PaymentStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REFUNDED'
]);

/**
 * 貨幣類型枚舉
 */
export const CurrencyEnum = z.enum([
  'TWD',
  'USD',
  'JPY',
  'EUR'
]);

/**
 * LINE Pay 支付請求 Schema
 */
export const LinePayRequestSchema = z.object({
  orderId: z.string().min(1, "訂單ID不能為空"),
  language: z.string().optional().default('zh-TW')
});

/**
 * LINE Pay 確認支付 Schema
 */
export const LinePayConfirmSchema = z.object({
  transactionId: z.string().min(1, "交易ID不能為空"),
  orderId: z.string().min(1, "訂單ID不能為空")
});

/**
 * 支付狀態查詢 Schema
 */
export const PaymentStatusQuerySchema = z.object({
  orderId: z.string().optional(),
  paymentId: z.string().optional()
}).refine(
  data => data.orderId || data.paymentId, 
  { message: "必須提供 orderId 或 paymentId" }
);

/**
 * 取消支付請求 Schema
 */
export const CancelPaymentSchema = z.object({
  orderId: z.string().optional(),
  paymentId: z.string().optional(),
  reason: z.string().optional()
}).refine(
  data => data.orderId || data.paymentId, 
  { message: "必須提供 orderId 或 paymentId" }
);

/**
 * 退款請求 Schema
 */
export const RefundPaymentSchema = z.object({
  paymentId: z.string().min(1, "支付ID不能為空"),
  amount: safeFloat.optional(), // 如果省略，表示全額退款
  reason: z.string().optional(),
  refundMethod: z.string().optional() // 如果省略，默認使用原支付方式
});

/**
 * 支付方法配置 Schema
 */
export const PaymentMethodConfigSchema = z.object({
  storeId: z.string().min(1, "店鋪ID不能為空"),
  tenantId: z.string().min(1, "租戶ID不能為空"),
  method: PaymentMethodEnum,
  enabled: z.boolean().default(true),
  displayName: z.string().optional(),
  processingFee: z.preprocess(
    (arg) => (arg === undefined || arg === null ? undefined : (typeof arg === 'string' ? parseFloat(arg) : arg)),
    z.number().min(0, "處理費不能為負數").optional().refine((n) => n === undefined || !isNaN(n), { message: "處理費必須是有效的數字或為空" })
  ), // 處理費百分比
  fixedFee: z.preprocess(
    (arg) => (arg === undefined || arg === null ? undefined : (typeof arg === 'string' ? parseFloat(arg) : arg)),
    z.number().min(0, "固定處理費不能為負數").optional().refine((n) => n === undefined || !isNaN(n), { message: "固定處理費必須是有效的數字或為空" })
  ), // 固定處理費
  notes: z.string().optional(),
  position: safeInteger.optional(), // 顯示順序
  credentials: z.record(z.any()).optional() // 針對不同支付方式的配置
});

/**
 * 支付條款與條件 Schema
 */
export const PaymentTermsSchema = z.object({
  tenantId: z.string().min(1, "租戶ID不能為空"),
  version: z.string().min(1, "版本號不能為空"),
  content: z.string().min(1, "條款內容不能為空"),
  effectiveDate: z.string().datetime({ message: "必須是有效的日期時間格式" }),
  expirationDate: z.string().datetime({ message: "必須是有效的日期時間格式" }).optional(),
  isActive: z.boolean().default(true)
});

/**
 * 收據設定 Schema
 */
export const ReceiptSettingsSchema = z.object({
  storeId: z.string().min(1, "店鋪ID不能為空"),
  tenantId: z.string().min(1, "租戶ID不能為空"),
  companyName: z.string().min(1, "公司名稱不能為空"),
  taxId: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: emailSchema.optional(),
  logo: z.string().optional(), // 圖片網址
  footer: z.string().optional(), // 收據底部訊息
  includeTax: z.boolean().default(true), // 是否含稅
  taxRate: safeFloat.optional().default(0.05), // 稅率
  autoSend: z.boolean().default(false) // 是否自動發送電子收據
});

/**
 * 支付交易 Schema
 */
export const PaymentTransactionSchema = z.object({
  // ... other fields ...
  processingFee: z.preprocess(
    (arg) => (arg === undefined || arg === null ? undefined : (typeof arg === 'string' ? parseFloat(arg) : arg)),
    z.number().min(0, "處理費不能為負數").optional().refine((n) => n === undefined || !isNaN(n), { message: "處理費必須是有效的數字或為空" })
  ), // 處理費百分比
  fixedFee: z.preprocess(
    (arg) => (arg === undefined || arg === null ? undefined : (typeof arg === 'string' ? parseFloat(arg) : arg)),
    z.number().min(0, "固定處理費不能為負數").optional().refine((n) => n === undefined || !isNaN(n), { message: "固定處理費必須是有效的數字或為空" })
  ), // 固定處理費
  // ... other fields ...
}); 