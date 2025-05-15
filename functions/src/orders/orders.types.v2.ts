import { z } from 'zod';

export const OrderStatusSchema = z.enum([
  'pending_payment', // 等待付款 (例如，用戶已下單，但尚未完成LINE Pay流程)
  'payment_failed',  // 付款失敗
  'pending_confirmation', // 已付款，等待商家確認 (LINE Pay已確認，等待商家接單)
  'confirmed',       // 商家已確認，準備中
  'ready_for_pickup',// 商品已準備好，等待取餐
  'completed',       // 訂單完成 (已取餐/已送達)
  'cancelled_by_user', // 用戶取消
  'cancelled_by_store',// 商家取消
  'refunded',        // 已退款
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderItemSchema = z.object({
  itemId: z.string().min(1, '商品ID不得為空'),
  name: z.string().min(1, '商品名稱不得為空'),
  quantity: z.number().int().positive('數量必須為正整數'),
  price: z.number().nonnegative('價格不得為負'), // 單價
  // totalPrice: z.number().nonnegative(), // quantity * price, 可考慮在服務端計算
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const CreateOrderPayloadSchema = z.object({
  customerId: z.string().min(1, '顧客ID不得為空'),
  storeId: z.string().min(1, '店家ID不得為空'),
  items: z.array(OrderItemSchema).min(1, '訂單至少需要一個商品'),
  // totalAmount: z.number().positive(), // 總金額，建議後端根據items計算以保證一致性
  notes: z.string().optional(), // 顧客備註
});
export type CreateOrderPayload = z.infer<typeof CreateOrderPayloadSchema>;

export const OrderStatusHistoryEntrySchema = z.object({
  status: OrderStatusSchema,
  updatedAt: z.date(), // Or Firestore Timestamp if stored directly
  updatedBy: z.string(), // User ID of who made the change
  // previousStatus: OrderStatusSchema.optional(), // Optional: if you need to track the previous state explicitly
  notes: z.string().optional(), // Optional notes for this specific status change
});
export type OrderStatusHistoryEntry = z.infer<typeof OrderStatusHistoryEntrySchema>;

export const OrderSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  storeId: z.string(),
  items: z.array(OrderItemSchema),
  totalAmount: z.number().positive('總金額必須為正數'),
  status: OrderStatusSchema,
  notes: z.string().optional(),
  createdAt: z.date(), // 或使用 Firestore Timestamp
  updatedAt: z.date(), // 或使用 Firestore Timestamp
  paymentTransactionId: z.string().optional(), // 例如 LINE Pay 交易 ID
  statusHistory: z.array(OrderStatusHistoryEntrySchema).optional(), // Array of status changes
});
export type Order = z.infer<typeof OrderSchema>;

export const UpdateOrderStatusPayloadSchema = z.object({
  status: OrderStatusSchema,
});
export type UpdateOrderStatusPayload = z.infer<typeof UpdateOrderStatusPayloadSchema>;

// 自定義錯誤，用於服務層
export class OrderServiceError extends Error {
  public readonly code?: string;
  constructor(message: string, public readonly details?: any, code?: string) {
    super(message);
    this.name = 'OrderServiceError';
    this.code = code;
  }
} 