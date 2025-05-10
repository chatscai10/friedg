import { z } from 'zod';
import { OrderType, PaymentMethod } from './types';

/**
 * 顧客訂單項目選項輸入 schema
 */
export const CustomerOrderItemOptionInputSchema = z.object({
  optionId: z.string().min(1, '選項ID不能為空'),
  value: z.string().min(1, '選項值不能為空'),
  additionalPrice: z.number().min(0, '附加價格不能為負數').optional().default(0)
}).strict();

/**
 * 顧客訂單項目輸入 schema
 */
export const CustomerOrderItemInputSchema = z.object({
  menuItemId: z.string().min(1, '菜單項目ID不能為空'),
  quantity: z.number().int().min(1, '數量必須為正整數'),
  specialInstructions: z.string().max(200, '特殊要求不能超過200個字符').optional(),
  options: z.array(CustomerOrderItemOptionInputSchema).optional()
}).strict();

/**
 * 顧客配送資訊 schema
 */
export const DeliveryInfoSchema = z.object({
  address: z.string().min(1, '送貨地址不能為空'),
  contactPhone: z.string().min(1, '聯繫電話不能為空'),
  notes: z.string().max(200, '備註不能超過200個字符').optional()
}).strict();

/**
 * 顧客創建訂單輸入 schema
 * 簡化版本，專為顧客使用
 */
export const CustomerOrderSchema = z.object({
  storeId: z.string().min(1, '店鋪ID不能為空'),
  customerName: z.string().max(50, '顧客姓名不能超過50個字符').optional(),
  customerPhone: z.string().max(20, '顧客電話不能超過20個字符'),
  customerEmail: z.string().email('電子郵件格式不正確').optional(),
  orderType: z.nativeEnum(OrderType, {
    errorMap: () => ({ message: '訂單類型必須為指定選項：堂食、外帶或外送' })
  }).default(OrderType.TAKEOUT),
  tableNumber: z.string().max(10, '桌號不能超過10個字符').optional(),
  estimatedPickupTime: z.string().datetime('預計取餐時間格式不正確').optional(),
  specialInstructions: z.string().max(500, '特殊要求不能超過500個字符').optional(),
  items: z.array(CustomerOrderItemInputSchema).min(1, '訂單必須包含至少一個項目'),
  discountCode: z.string().max(20, '折扣碼不能超過20個字符').optional(),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: '支付方式必須為指定選項' })
  }).default(PaymentMethod.CASH),
  deliveryInfo: DeliveryInfoSchema.optional()
    .superRefine((data, ctx) => {
      // 如果訂單類型是外送，則配送資訊必填
      if (ctx.path[0] === 'orderType' && ctx.path[1] === OrderType.DELIVERY && !data) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '外送訂單必須提供配送資訊'
        });
      }
    })
}).strict()
.refine(
  data => !(data.orderType === OrderType.DELIVERY && !data.deliveryInfo),
  {
    message: '外送訂單必須提供配送資訊',
    path: ['deliveryInfo']
  }
)
.refine(
  data => !(data.orderType === OrderType.DINEIN && !data.tableNumber),
  {
    message: '堂食訂單必須提供桌號',
    path: ['tableNumber']
  }
);

// 定義返回類型
export type CustomerOrderInput = z.infer<typeof CustomerOrderSchema>;
export type CustomerOrderItemInput = z.infer<typeof CustomerOrderItemInputSchema>;
export type CustomerOrderItemOptionInput = z.infer<typeof CustomerOrderItemOptionInputSchema>;

/**
 * 顧客訂單查詢參數 schema
 * 用於根據訂單號和電話查詢訂單（匿名用戶）
 */
export const CustomerOrderQuerySchema = z.object({
  orderNumber: z.string().min(1, '訂單號不能為空'),
  phone: z.string().min(1, '電話號碼不能為空')
}).strict();

// 定義返回類型
export type CustomerOrderQuery = z.infer<typeof CustomerOrderQuerySchema>; 