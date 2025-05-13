/**
 * 訂單管理模組類型定義
 */

// 訂單狀態枚舉
export enum OrderStatus {
  PENDING = 'pending',       // 待處理（初始狀態，顧客提交訂單後）
  CONFIRMED = 'confirmed',   // 已確認（店家確認接單）
  PREPARING = 'preparing',   // 準備中（開始製作食品）
  READY = 'ready',           // 準備完成（食品已完成製作，待取餐）
  DELIVERING = 'delivering', // 配送中（適用於外送訂單）
  COMPLETED = 'completed',   // 已完成（訂單已交付顧客）
  CANCELLED = 'cancelled',   // 已取消（訂單被取消）
  REJECTED = 'rejected'      // 已拒單（店家無法處理訂單）
}

// 支付狀態枚舉
export enum PaymentStatus {
  UNPAID = 'unpaid',           // 未支付
  PARTIALLY_PAID = 'partially_paid', // 部分支付
  PAID = 'paid',               // 已支付
  REFUNDED = 'refunded'        // 已退款
}

// 支付方式枚舉
export enum PaymentMethod {
  CASH = 'cash',           // 現金
  LINEPAY = 'linepay',     // LINE Pay
  CREDITCARD = 'creditcard' // 信用卡
}

// 訂單類型枚舉
export enum OrderType {
  DINEIN = 'dine-in',   // 堂食
  TAKEOUT = 'takeout',  // 外帶
  DELIVERY = 'delivery' // 外送
}

// 訂單選項輸入
export interface OrderItemOptionInput {
  optionId: string;       // 選項ID
  value: string;          // 選項值（如：中辣、特大杯等）
  additionalPrice?: number; // 額外費用
}

// 訂單項目選項
export interface OrderItemOption {
  optionId: string;      // 選項ID
  optionName: string;    // 選項名稱
  value: string;         // 選項值
  additionalPrice: number; // 額外費用
}

// 配送資訊
export interface DeliveryInfo {
  address: string;        // 送貨地址
  contactPhone: string;   // 聯系電話
  notes?: string;         // 備註
}

// 訂單項目輸入
export interface OrderItemInput {
  menuItemId: string;             // 菜單項ID
  quantity: number;               // 數量
  unitPrice: number;              // 單價
  specialInstructions?: string;   // 特殊要求
  options?: OrderItemOptionInput[]; // 選項列表
}

// 訂單輸入
export interface OrderInput {
  storeId: string;                // 店鋪ID
  customerId?: string;            // 顧客ID（非必填，非會員可為空）
  customerName?: string;          // 顧客姓名
  customerPhone?: string;         // 顧客電話
  customerEmail?: string;         // 顧客電子郵件
  customerTaxId?: string;         // 顧客統一編號（電子發票用）
  orderType?: OrderType | string; // 訂單類型
  tableNumber?: string;           // 桌號（堂食時適用）
  estimatedPickupTime?: string;   // 預計取餐時間
  specialInstructions?: string;   // 特殊要求
  items: OrderItemInput[];        // 訂單項目列表
  discountCode?: string;          // 折扣碼
  taxIncluded?: boolean;          // 是否已包含稅金
  deliveryInfo?: DeliveryInfo;    // 配送資訊（外送時適用）
}

// 訂單項目
export interface OrderItem {
  id: string;                   // 訂單項目ID
  menuItemId: string;           // 菜單項ID
  menuItemName: string;         // 菜單項名稱
  menuItemImage?: string;       // 菜單項圖片
  quantity: number;             // 數量
  unitPrice: number;            // 單價
  totalPrice: number;           // 總價
  specialInstructions?: string; // 特殊要求
  options?: OrderItemOption[];  // 選項列表
}

// 訂單支付記錄
export interface PaymentRecord {
  paymentMethod: PaymentMethod;       // 支付方式
  amount: number;                     // 支付金額
  transactionId?: string;             // 交易ID
  paymentStatus: PaymentStatus;       // 支付狀態
  notes?: string;                     // 支付備註
  recordedAt: Date;                   // 記錄時間
  recordedBy: string;                 // 記錄者ID
}

// 訂單狀態歷史記錄
export interface OrderStatusHistoryEntry {
  status: OrderStatus;          // 狀態
  timestamp: Date;              // 時間戳
  updatedBy: string;            // 操作者ID
  updatedByName?: string;       // 操作者姓名
  updatedByRole?: string;       // 操作者角色
  note?: string;                // 備註
}

// 完整訂單
export interface Order {
  id: string;                   // 訂單ID
  orderNumber: string;          // 訂單編號
  storeId: string;              // 店鋪ID
  storeName: string;            // 店鋪名稱
  tenantId: string;             // 租戶ID
  customerId: string | null;    // 顧客ID
  customerName: string;         // 顧客姓名
  customerPhone: string;        // 顧客電話
  customerEmail: string;        // 顧客電子郵件
  customerTaxId?: string;       // 顧客統一編號（電子發票用）
  
  status: OrderStatus;          // 訂單狀態
  orderType: OrderType | string; // 訂單類型
  tableNumber: string;          // 桌號
  estimatedPickupTime: Date | null; // 預計取餐時間
  actualPickupTime: Date | null;   // 實際取餐時間
  specialInstructions: string;  // 特殊要求
  
  // 狀態時間戳
  confirmedAt?: Date;           // 確認時間
  preparingAt?: Date;           // 準備開始時間
  readyAt?: Date;               // 準備完成時間
  deliveringAt?: Date;          // 配送開始時間
  completedAt?: Date;           // 完成時間
  cancelledAt?: Date;           // 取消時間
  rejectedAt?: Date;            // 拒絕時間
  
  // 狀態歷史記錄
  statusHistory?: OrderStatusHistoryEntry[]; // 狀態變更歷史記錄
  
  items: OrderItem[];           // 訂單項目
  subtotal: number;             // 小計金額
  taxAmount: number;            // 稅金
  taxIncluded: boolean;         // 價格是否已包含稅金
  discountAmount: number;       // 折扣金額
  discountCode: string;         // 使用的折扣碼
  tipAmount: number;            // 小費金額
  totalAmount: number;          // 總金額
  
  paymentStatus: PaymentStatus; // 支付狀態
  paymentMethod: PaymentMethod | null; // 支付方式
  paymentTransactionId: string | null; // 支付交易ID
  paymentDetails?: PaymentRecord; // 支付詳情
  
  deliveryInfo?: DeliveryInfo;  // 配送資訊（外送時適用）
  
  assignedStaffId: string | null;    // 處理訂單的員工ID
  assignedStaffName: string | null;  // 處理訂單的員工姓名
  cancelReason: string | null;       // 取消原因（如適用）
  rejectReason?: string;             // 拒絕原因（如適用）
  isDeleted: boolean;                // 是否已刪除（軟刪除）
  
  hasReceipt?: boolean;         // 是否已生成收據
  receiptId?: string;           // 收據ID
  
  createdAt: Date;              // 創建時間
  updatedAt: Date;              // 更新時間
}

// 訂單查詢參數
export interface OrderQueryParams {
  storeId?: string;      // 店鋪ID
  status?: OrderStatus;  // 訂單狀態
  from?: string;         // 起始日期
  to?: string;           // 結束日期
  customerId?: string;   // 顧客ID
  page?: number;         // 頁碼
  limit?: number;        // 每頁記錄數
}

// 訂單統計結果
export interface OrderStatsResult {
  totalOrders: number;          // 總訂單數
  totalSales: number;           // 總銷售額
  averageOrderValue: number;    // 平均訂單金額
  topSellingItems: Array<{      // 熱銷商品排行
    menuItemId: string;
    menuItemName: string;
    quantity: number;
    revenue: number;
  }>;
  ordersByStatus: Record<string, number>; // 按狀態統計
  ordersByType: Record<string, number>;   // 按類型統計
  salesByDay: Array<{           // 按日期統計
    date: string;
    orders: number;
    sales: number;
  }>;
}

// 收據
export interface Receipt {
  id: string;                // 收據ID
  orderId: string;           // 訂單ID
  receiptNumber: string;     // 收據編號
  storeId: string;           // 店鋪ID
  storeName: string;         // 店鋪名稱
  storeAddress: string;      // 店鋪地址
  storeTaxId: string;        // 店鋪稅務編號
  customerName: string;      // 顧客姓名
  customerTaxId?: string;    // 顧客稅務編號（電子發票用）
  items: Array<{             // 收據項目
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;          // 小計金額
  taxAmount: number;         // 稅金
  discountAmount: number;    // 折扣金額
  totalAmount: number;       // 總金額
  paymentMethod: PaymentMethod | null;    // 支付方式
  isElectronic: boolean;     // 是否為電子發票
  electronicReceiptUrl?: string; // 電子發票連結
  issuedAt: Date;            // 開立時間
} 