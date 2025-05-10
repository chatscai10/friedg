/**
 * 雲端出單 (Cloud Printing) 模組 - 類型定義
 */
import * as admin from 'firebase-admin';

/**
 * 印表機類型枚舉
 */
export enum PrinterType {
  KITCHEN = 'kitchen',    // 廚房印表機
  RECEIPT = 'receipt',    // 收據印表機
  LABEL = 'label',        // 標籤印表機
  GENERAL = 'general'     // 一般印表機
}

/**
 * 列印任務狀態枚舉
 */
export enum PrintJobStatus {
  PENDING = 'pending',       // 等待列印
  PROCESSING = 'processing', // 處理中
  COMPLETED = 'completed',   // 已完成
  FAILED = 'failed'          // 失敗
}

/**
 * 列印任務資料結構
 */
export interface PrintJob {
  // 基本資訊
  jobId: string;                      // 任務ID (通常使用文檔ID)
  tenantId: string;                   // 租戶ID
  storeId: string;                    // 商店ID
  
  // 印表機資訊
  printerType: PrinterType;           // 印表機類型
  printerId?: string;                 // 特定印表機ID (可選)
  
  // 列印內容
  content: PrintContent;              // 列印內容 (結構化數據)
  rawCommands?: string;               // 原始印表機指令 (可選，如ESC/POS)
  
  // 狀態追蹤
  status: PrintJobStatus;             // 狀態
  statusMessage?: string;             // 狀態訊息 (可選，用於錯誤說明)
  retryCount: number;                 // 重試次數
  maxRetries: number;                 // 最大重試次數
  
  // 時間戳記
  createdAt: admin.firestore.Timestamp;  // 創建時間
  updatedAt: admin.firestore.Timestamp;  // 更新時間
  completedAt?: admin.firestore.Timestamp; // 完成時間 (可選)
  
  // 來源資訊
  createdBy: string;                  // 創建者ID
  source: 'user' | 'system' | 'auto'; // 來源 (用戶手動/系統/自動觸發)
  
  // 關聯資訊
  relatedOrderId?: string;            // 關聯訂單ID (可選)
  relatedEntityId?: string;           // 關聯實體ID (可選)
  relatedEntityType?: string;         // 關聯實體類型 (可選)
}

/**
 * 列印內容通用介面
 */
export interface PrintContent {
  type: 'order' | 'receipt' | 'label' | 'text' | 'custom'; // 內容類型
  data: OrderPrintData | ReceiptPrintData | LabelPrintData | TextPrintData | Record<string, any>; // 內容數據
  title?: string;                     // 標題 (可選)
  copies: number;                     // 列印份數
  printOptions?: PrintOptions;        // 列印選項 (可選)
}

/**
 * 列印選項
 */
export interface PrintOptions {
  paperSize?: string;                // 紙張尺寸 (例如："80mm", "A4")
  orientation?: 'portrait' | 'landscape'; // 方向
  fontStyle?: 'normal' | 'bold';     // 字體樣式
  fontSize?: number;                 // 字體大小
  density?: number;                  // 列印密度 (0-100)
  cutPaper?: boolean;                // 是否裁紙
  openCashDrawer?: boolean;          // 是否開啟錢箱
  encoding?: string;                 // 字符編碼 (預設 UTF-8)
  [key: string]: any;                // 其他自定義選項
}

/**
 * 訂單列印數據
 */
export interface OrderPrintData {
  orderId: string;                   // 訂單ID
  orderNumber: string;               // 訂單編號
  orderTime: Date | string;          // 訂單時間
  tableNumber?: string;              // 桌號 (可選)
  customerName?: string;             // 顧客姓名 (可選)
  items: OrderItemForPrint[];        // 訂單項目
  notes?: string;                    // 備註 (可選)
  preparationPriority?: 'normal' | 'high' | 'urgent'; // 準備優先級 (可選)
}

/**
 * 訂單項目 (用於列印)
 */
export interface OrderItemForPrint {
  name: string;                      // 品項名稱
  quantity: number;                  // 數量
  unitPrice?: number;                // 單價 (可選)
  options?: string[];                // 選項 (可選)
  notes?: string;                    // 備註 (可選)
}

/**
 * 收據列印數據
 */
export interface ReceiptPrintData {
  orderId: string;                   // 訂單ID
  orderNumber: string;               // 訂單編號
  orderTime: Date | string;          // 訂單時間
  storeName: string;                 // 商店名稱
  storeAddress?: string;             // 商店地址 (可選)
  storePhone?: string;               // 商店電話 (可選)
  tableNumber?: string;              // 桌號 (可選)
  customerName?: string;             // 顧客姓名 (可選)
  items: ReceiptItemForPrint[];      // 收據項目
  subtotal: number;                  // 小計
  tax?: number;                      // 稅額 (可選)
  discount?: number;                 // 折扣 (可選)
  total: number;                     // 總計
  paymentMethod: string;             // 付款方式
  paymentStatus: string;             // 付款狀態
  notes?: string;                    // 備註 (可選)
  footer?: string;                   // 頁尾資訊 (可選)
}

/**
 * 收據項目 (用於列印)
 */
export interface ReceiptItemForPrint {
  name: string;                      // 品項名稱
  quantity: number;                  // 數量
  unitPrice: number;                 // 單價
  totalPrice: number;                // 總價
  options?: string[];                // 選項 (可選)
  notes?: string;                    // 備註 (可選)
}

/**
 * 標籤列印數據
 */
export interface LabelPrintData {
  id: string;                        // 標籤ID
  title?: string;                    // 標籤標題 (可選)
  content: string;                   // 標籤內容
  qrCode?: string;                   // QR碼內容 (可選)
  barcode?: string;                  // 條碼內容 (可選)
}

/**
 * 文字列印數據
 */
export interface TextPrintData {
  content: string;                   // 文字內容
}

/**
 * 創建列印任務的輸入參數
 */
export interface PrintJobInput {
  tenantId: string;                  // 租戶ID
  storeId: string;                   // 商店ID
  printerType: PrinterType;          // 印表機類型
  printerId?: string;                // 特定印表機ID (可選)
  content: PrintContent;             // 列印內容
  createdBy: string;                 // 創建者ID
  source: 'user' | 'system' | 'auto'; // 來源
  relatedOrderId?: string;           // 關聯訂單ID (可選)
  relatedEntityId?: string;          // 關聯實體ID (可選)
  relatedEntityType?: string;        // 關聯實體類型 (可選)
  maxRetries?: number;               // 最大重試次數 (可選，預設為3)
} 