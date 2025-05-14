/**
 * 訂單資料驗證 Schema
 * 使用 zod 實現強型別驗證
 */

import { z } from 'zod';
import { 
  safeInteger, 
  safeFloat, 
  dateOnlyString, 
  emailSchema, 
  taiwanPhoneSchema,
  paginationSchema,
  dateRangeSchema
} from '../../libs/validation/schema';

/**
 * 訂單狀態枚舉
 */
export const OrderStatusEnum = z.enum([
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled',
  'rejected',
  'refunded'
]);

/**
 * 訂單類型枚舉
 */
export const OrderTypeEnum = z.enum([
  'dine_in',
  'takeout',
  'delivery',
  'pickup'
]);

/**
 * 訂單項目 Schema
 */
export const OrderItemSchema = z.object({
  itemId: z.string().min(1, "商品ID不能為空"),
  name: z.string().min(1, "商品名稱不能為空"),
  price: z.preprocess(
    (arg) => (typeof arg === 'string' ? parseFloat(arg) : arg),
    z.number().min(0, "價格不能為負數").refine((n) => !isNaN(n), { message: "價格必須是有效的數字" })
  ),
  quantity: z.preprocess(
    (arg) => (typeof arg === 'string' ? parseInt(arg, 10) : arg),
    z.number().int().min(1, "數量必須大於0").refine((n) => !isNaN(n), { message: "數量必須是有效的整數" })
  ),
  options: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      price: z.preprocess(
        (arg) => (arg === undefined || arg === null ? undefined : (typeof arg === 'string' ? parseFloat(arg) : arg)),
        z.number().min(0, "選項價格不能為負數").optional().refine((n) => n === undefined || !isNaN(n), { message: "選項價格必須是有效的數字或為空" })
      )
    })
  ).optional(),
  notes: z.string().optional(),
  discount: z.preprocess(
    (arg) => (arg === undefined || arg === null ? undefined : (typeof arg === 'string' ? parseFloat(arg) : arg)),
    z.number().min(0, "折扣不能為負數").optional().refine((n) => n === undefined || !isNaN(n), { message: "折扣必須是有效的數字或為空" })
  ),
  subtotal: z.preprocess(
    (arg) => (arg === undefined || arg === null ? undefined : (typeof arg === 'string' ? parseFloat(arg) : arg)),
    z.number().min(0, "小計不能為負數").optional().refine((n) => n === undefined || !isNaN(n), { message: "小計必須是有效的數字或為空" })
  )
});

/**
 * 訂單基本資料 Schema
 */
export const OrderBaseSchema = z.object({
  storeId: z.string().min(1, "店鋪ID不能為空"),
  items: z.array(OrderItemSchema).nonempty("訂單項目不能為空"),
  orderType: OrderTypeEnum.optional().default('dine_in'),
  customerId: z.string().optional(), // 非會員訂單可為空
  customerName: z.string().optional(),
  customerPhone: taiwanPhoneSchema.optional(),
  customerEmail: emailSchema.optional(),
  customerTaxId: z.string().optional(),
  tableNumber: z.string().optional(),
  estimatedPickupTime: z.string().optional(),
  specialInstructions: z.string().optional(),
  discountCode: z.string().optional(),
  taxIncluded: z.boolean().optional().default(true),
});

/**
 * 建立新訂單請求 Schema
 */
export const CreateOrderSchema = OrderBaseSchema;

/**
 * 訂單狀態更新請求 Schema
 */
export const UpdateOrderStatusSchema = z.object({
  orderId: z.string().min(1, "訂單ID不能為空"),
  status: OrderStatusEnum,
  reason: z.string().optional()
});

/**
 * 訂單支付記錄請求 Schema
 */
export const RecordOrderPaymentSchema = z.object({
  orderId: z.string().min(1, "訂單ID不能為空"),
  paymentMethod: z.string().min(1, "支付方式不能為空"),
  amount: z.preprocess(
    (arg) => (typeof arg === 'string' ? parseFloat(arg) : arg),
    z.number().min(0, "支付金額必須大於0").refine((n) => !isNaN(n), { message: "支付金額必須是有效的數字" })
  ),
  transactionId: z.string().optional(),
  paymentDetails: z.record(z.any()).optional()
});

/**
 * 訂單收據生成請求 Schema
 */
export const GenerateReceiptSchema = z.object({
  orderId: z.string().min(1, "訂單ID不能為空"),
  format: z.enum(['html', 'pdf', 'json']).optional().default('html')
});

/**
 * 訂單列表查詢參數 Schema
 */
export const OrderQuerySchema = z.object({
  storeId: z.string().optional(),
  status: OrderStatusEnum.optional(),
  startDate: dateOnlyString.optional(),
  endDate: dateOnlyString.optional(),
  limit: safeInteger.optional().default(20),
  offset: safeInteger.optional().default(0),
  sortField: z.string().optional().default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).optional().default('desc')
}).merge(paginationSchema).merge(dateRangeSchema);

/**
 * 訂單詳情查詢參數 Schema
 */
export const OrderDetailsSchema = z.object({
  orderId: z.string().min(1, "訂單ID不能為空")
});

/**
 * 訂單統計查詢參數 Schema
 */
export const OrderStatisticsQuerySchema = z.object({
  storeId: z.string().optional(),
  tenantId: z.string().optional(),
  startDate: dateOnlyString,
  endDate: dateOnlyString,
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day')
}).merge(dateRangeSchema);

/**
 * 訂單歷史查詢參數 Schema
 */
export const OrderHistoryQuerySchema = z.object({
  userId: z.string().optional(),
  limit: safeInteger.optional().default(10),
  offset: safeInteger.optional().default(0)
}).merge(paginationSchema); 