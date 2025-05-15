import { z } from 'zod';

// 通用 API 錯誤響應結構
export interface ApiErrorResponse {
  message: string;
  errors?: Array<{ field?: string; message: string }>;
}

// LINE Pay Request API
export const LinePayRequestBodySchema = z.object({
  originalSystemOrderId: z.string().min(1, "originalSystemOrderId is required"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.enum(['TWD']), // 根據實際支援情況調整
  items: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    imageUrl: z.string().url().optional(),
  })).min(1, "At least one item is required"),
  // customerId: z.string().optional(), // 從認證中獲取，不由客戶端傳遞
});
export type LinePayRequestBody = z.infer<typeof LinePayRequestBodySchema>;

export interface LinePayRequestApiResponse {
  paymentUrl: string;
  linePayTransactionId: string; // LINE Pay 產生的交易 ID
  paymentSpecificOrderId: string; // 我方系統用於此次支付的唯一 ID (可能與 originalSystemOrderId 不同，用於防重試)
}

// LINE Pay Confirm Callback from PWA
export const LinePayConfirmCallbackBodySchema = z.object({
  linePayTransactionId: z.string().min(1, "linePayTransactionId is required"),
  // originalSystemOrderId: z.string().min(1, "originalSystemOrderId is required"), // 可選，看前端是否方便傳遞
});
export type LinePayConfirmCallbackBody = z.infer<typeof LinePayConfirmCallbackBodySchema>;

export interface LinePayConfirmApiResponse {
  status: 'paid' | 'payment_failed' | 'pending' | 'already_processed';
  message: string;
  originalSystemOrderId?: string;
}

// Firestore linePayTransactions 集合文檔結構
export interface LinePayTransactionDoc {
  originalSystemOrderId: string;
  paymentSpecificOrderId: string; // 用於 LINE Pay Request API 的 orderId
  customerId: string;
  amount: number;
  currency: string;
  status: 'pending_payment_redirect' | 'user_cancelled_at_line' | 'pending_confirm_api' | 'confirmed_paid' | 'confirmed_failed' | 'confirm_api_error';
  linePayOriginalTransactionId: string; // LINE Pay Request API 回傳的 transactionId
  linePayConfirmTransactionId?: string; // LINE Pay Confirm API 回傳的 transactionId (通常與 request 的相同)
  requestPayload: LinePayRequestBody; // 完整請求體備查
  requestApiResponse?: any; // LINE Pay Request API 的原始響應
  confirmApiResponse?: any; // LINE Pay Confirm API 的原始響應
  errorMessage?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// 內部 Service 使用的錯誤物件
export class PaymentServiceError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: any;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
} 