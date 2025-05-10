import { z } from 'zod';
import { OrderStatus, OrderType, PaymentMethod, PaymentStatus } from './types';

/**
 * 訂單項目選項輸入 schema
 */
export const OrderItemOptionInputSchema = z.object({
  optionId: z.string().min(1, '選項ID不能為空'),
  value: z.string().min(1, '選項值不能為空'),
  additionalPrice: z.number().min(0, '附加價格不能為負數').optional().default(0)
}).strict();

/**
 * 訂單項目輸入 schema
 */
export const OrderItemInputSchema = z.object({
  menuItemId: z.string().min(1, '菜單項目ID不能為空'),
  quantity: z.number().int().min(1, '數量必須為正整數'),
  unitPrice: z.number().min(0, '單價不能為負數'),
  specialInstructions: z.string().max(200, '特殊要求不能超過200個字符').optional(),
  options: z.array(OrderItemOptionInputSchema).optional()
}).strict();

/**
 * 創建訂單輸入 schema
 */
export const CreateOrderSchema = z.object({
  storeId: z.string().min(1, '店鋪ID不能為空'),
  customerId: z.string().optional(),
  customerName: z.string().max(50, '顧客姓名不能超過50個字符').optional(),
  customerPhone: z.string().max(20, '顧客電話不能超過20個字符').optional(),
  customerEmail: z.string().email('電子郵件格式不正確').optional(),
  customerTaxId: z.string().max(20, '統一編號不能超過20個字符').optional(),
  orderType: z.nativeEnum(OrderType, {
    errorMap: () => ({ message: '訂單類型必須為指定選項：堂食、外帶或外送' })
  }).default(OrderType.TAKEOUT),
  tableNumber: z.string().max(10, '桌號不能超過10個字符').optional(),
  estimatedPickupTime: z.string().datetime('預計取餐時間格式不正確').optional(),
  specialInstructions: z.string().max(500, '特殊要求不能超過500個字符').optional(),
  items: z.array(OrderItemInputSchema).min(1, '訂單必須包含至少一個項目'),
  discountCode: z.string().max(20, '折扣碼不能超過20個字符').optional(),
  taxIncluded: z.boolean().default(true),
  deliveryInfo: z.object({
    address: z.string().min(1, '送貨地址不能為空'),
    contactPhone: z.string().min(1, '聯繫電話不能為空'),
    notes: z.string().optional()
  }).optional()
}).strict();

// 定義返回類型
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type OrderItemInput = z.infer<typeof OrderItemInputSchema>;
export type OrderItemOptionInput = z.infer<typeof OrderItemOptionInputSchema>;

/**
 * 更新訂單狀態 schema
 */
export const UpdateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus, {
    errorMap: () => ({ message: '訂單狀態必須為指定選項' })
  }),
  reason: z.string().max(200, '原因說明不能超過200個字符').optional(),
}).strict();

/**
 * 記錄訂單支付 schema
 */
export const RecordOrderPaymentSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: '支付方式必須為指定選項' })
  }),
  amount: z.number().min(0, '支付金額不能為負數'),
  transactionId: z.string().optional(),
  paymentStatus: z.nativeEnum(PaymentStatus, {
    errorMap: () => ({ message: '支付狀態必須為指定選項' })
  }).default(PaymentStatus.PAID),
  notes: z.string().max(200, '支付備註不能超過200個字符').optional()
}).strict();

/**
 * 訂單查詢參數 schema
 */
export const OrderQueryParamsSchema = z.object({
  storeId: z.string().optional(),
  status: z.nativeEnum(OrderStatus, {
    errorMap: () => ({ message: '訂單狀態必須為指定選項' })
  }).optional(),
  from: z.string().datetime('起始日期格式不正確').optional(),
  to: z.string().datetime('結束日期格式不正確').optional(),
  customerId: z.string().optional(),
  page: z.number().int().min(1, '頁碼必須為正整數').default(1),
  limit: z.number().int().min(1, '每頁記錄數必須為正整數').max(100, '每頁記錄數不能超過100').default(20)
}).strict();

/**
 * 訂單列表查詢參數 schema
 */
export const ListOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1, '每頁筆數必須為正整數').max(100, '每頁筆數不能超過100').default(10),
  status: z.nativeEnum(OrderStatus, {
    errorMap: () => ({ message: '訂單狀態必須為指定選項' })
  }).optional(),
  customerId: z.string().optional(),
  storeId: z.string().optional(),
  dateFrom: z.string().datetime('起始日期格式不正確').optional(),
  dateTo: z.string().datetime('結束日期格式不正確').optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
  startAfter: z.string().optional() // 上一頁最後一個文檔的ID
}).strict();

// 定義返回類型
export type ListOrdersQueryParams = z.infer<typeof ListOrdersQuerySchema>; 