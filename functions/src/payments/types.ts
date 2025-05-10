import * as admin from 'firebase-admin';

/**
 * 支付狀態枚舉
 */
export enum PayoutStatus {
  PENDING = 'PENDING',         // 待處理
  PROCESSING = 'PROCESSING',   // 處理中
  COMPLETED = 'COMPLETED',     // 已完成
  FAILED = 'FAILED',           // 失敗
  CANCELLED = 'CANCELLED',     // 已取消
  REFUNDED = 'REFUNDED'        // 已退款
}

/**
 * 支付方式枚舉
 */
export enum PayoutMethod {
  LINE_PAY = 'LINE_PAY',       // LINE Pay
  BANK_TRANSFER = 'BANK_TRANSFER', // 銀行轉賬
}

/**
 * 支付請求介面
 */
export interface PayoutRequest {
  // 基本資訊
  amount: number;              // 支付金額 (NTD)
  description: string;         // 支付描述
  method: PayoutMethod;        // 支付方式
  targetIdentifier: string;    // 支付目標標識 (LINE Pay userId 或銀行帳號)
  
  // 關聯資訊
  employeeId: string;          // 員工 ID
  tenantId: string;            // 租戶 ID
  referenceId: string;         // 引用 ID (例如分紅記錄 ID)
  referenceType: string;       // 引用類型 (例如 'dividend')
  
  // 元資料
  metadata?: Record<string, any>; // 額外資料
}

/**
 * 支付記錄介面
 */
export interface PayoutRecord {
  // 基本資訊
  id: string;                  // 支付記錄 ID
  amount: number;              // 支付金額 (NTD)
  description: string;         // 支付描述
  method: PayoutMethod;        // 支付方式
  targetIdentifier: string;    // 支付目標標識 (LINE Pay userId 或銀行帳號)
  status: PayoutStatus;        // 當前狀態
  
  // 關聯資訊
  employeeId: string;          // 員工 ID
  tenantId: string;            // 租戶 ID
  referenceId: string;         // 引用 ID (例如分紅記錄 ID)
  referenceType: string;       // 引用類型 (例如 'dividend')
  batchId: string;             // 批次 ID
  
  // 處理資訊
  providerPayoutId?: string;    // 支付提供商返回的支付 ID
  providerResponse?: any;       // 支付提供商的原始回應
  processingTime?: Date;        // 開始處理時間
  completionTime?: Date;        // 完成時間
  failureReason?: string;       // 失敗原因

  // 狀態追蹤
  statusHistory: Array<{
    status: PayoutStatus;
    timestamp: Date;
    note?: string;
  }>;
  
  // 元資料
  metadata?: Record<string, any>; // 額外資料
  createdAt: Date;              // 創建時間
  updatedAt: Date;              // 更新時間
} 