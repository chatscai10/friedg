/**
 * LINE Pay 支付請求
 */
export interface LinePayRequestDto {
  /**
   * 系統內的訂單 ID
   */
  orderId: string;

  /**
   * 支付頁面語言，預設中文
   */
  language?: string;
}

/**
 * LINE Pay 支付請求回應
 */
export interface LinePayRequestResponse {
  /**
   * 請求是否成功
   */
  success: boolean;

  /**
   * 支付URL (如果成功)
   */
  paymentUrl?: string;

  /**
   * 交易ID (如果成功)
   */
  transactionId?: string;

  /**
   * 錯誤訊息 (如果失敗)
   */
  error?: string;
}

/**
 * LINE Pay 支付確認請求參數
 */
export interface LinePayConfirmDto {
  /**
   * LINE Pay 交易 ID
   */
  transactionId: string;

  /**
   * 系統訂單 ID
   */
  orderId: string;
}

/**
 * LINE Pay 支付確認回應
 */
export interface LinePayConfirmResponse {
  /**
   * 確認是否成功
   */
  success: boolean;

  /**
   * 付款狀態
   */
  paymentStatus?: string;

  /**
   * 交易ID
   */
  transactionId?: string;

  /**
   * 訂單ID
   */
  orderId?: string;

  /**
   * 錯誤訊息 (如果失敗)
   */
  error?: string;
}

/**
 * 支付狀態枚舉
 */
export enum PaymentStatus {
  PENDING = 'pending',         // 待處理
  PROCESSING = 'processing',   // 處理中
  COMPLETED = 'completed',     // 已完成
  FAILED = 'failed',           // 失敗
  CANCELLED = 'cancelled',     // 已取消
  REFUNDED = 'refunded'        // 已退款
}

/**
 * 支付方式枚舉
 */
export enum PaymentMethod {
  LINE_PAY = 'linepay',        // LINE Pay
  CREDIT_CARD = 'creditcard',  // 信用卡
  CASH = 'cash'                // 現金
}

/**
 * 支付記錄
 */
export interface PaymentRecord {
  /**
   * 支付ID
   */
  id: string;

  /**
   * 訂單ID
   */
  orderId: string;

  /**
   * 支付金額
   */
  amount: number;

  /**
   * 支付貨幣
   */
  currency: string;

  /**
   * 支付方式
   */
  method: PaymentMethod;

  /**
   * 支付狀態
   */
  status: PaymentStatus;

  /**
   * 支付時間
   */
  paymentTime?: Date;

  /**
   * 外部交易ID (例如 LINE Pay transactionId)
   */
  externalTransactionId?: string;

  /**
   * 支付描述
   */
  description?: string;

  /**
   * 失敗原因
   */
  failureReason?: string;

  /**
   * 使用者ID
   */
  userId?: string;

  /**
   * 租戶ID
   */
  tenantId?: string;

  /**
   * 商店ID
   */
  storeId?: string;

  /**
   * 創建時間
   */
  createdAt: Date;

  /**
   * 更新時間
   */
  updatedAt: Date;
} 