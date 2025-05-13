/**
 * 員工動態股權制度類型定義文件
 * 定義了股權池、員工股權、交易記錄等相關數據結構
 */

/**
 * 股權池設定，存放於 stores/{storeId}/equity_pool
 */
export interface EquityPool {
  totalShares: number;         // 總股數
  shareValue: number;          // 當前每股價值
  remainingCap: number;        // 剩餘可分配比例（百分比）
  lastValuationDate: Date;     // 最後估值日期
  purchaseWindowOpen: boolean; // 購股窗口是否開放
  type: EquityType;            // 股權類型
  createdAt: Date;             // 建立時間
  updatedAt: Date;             // 更新時間
}

/**
 * 股權類型
 */
export type EquityType = 'phantom' | 'real';

/**
 * 員工股權記錄，存放於 employee_equity/{userId}_{storeId}
 */
export interface EmployeeEquity {
  employeeId: string;          // 員工ID
  storeId: string;             // 店鋪ID
  tenantId: string;            // 租戶ID
  equityEligible: boolean;     // 是否符合認購資格
  equityEligibleDate?: Date;   // 資格取得日期
  shares: number;              // 持有股數
  purchasedValue: number;      // 購買時的總價值
  currentValue: number;        // 目前的總價值（會隨估值更新）
  status: EquityStatus;        // 狀態
  vestingStartDate?: Date;     // 歸屬期開始日期
  vestingEndDate?: Date;       // 歸屬期結束日期
  vestingPercentage: number;   // 已歸屬百分比
  // 歷史紀錄
  transactions: EquityTransaction[]; // 交易記錄
  createdAt: Date;             // 建立時間
  updatedAt: Date;             // 更新時間
}

/**
 * 股權狀態
 */
export type EquityStatus = 'none' | 'eligible' | 'pending_purchase' | 'active' | 'frozen' | 'terminated';

/**
 * 股權交易記錄
 */
export interface EquityTransaction {
  transactionId: string;       // 交易ID
  type: TransactionType;       // 交易類型
  shares: number;              // 股數
  pricePerShare: number;       // 每股價格
  totalAmount: number;         // 總金額
  date: Date;                  // 交易日期
  notes?: string;              // 備註
}

/**
 * 交易類型
 */
export type TransactionType = 'purchase' | 'additional_purchase' | 'company_buyback' | 'dividend' | 'internal_transfer';

/**
 * 內部交易訂單，存放於 internal_match_orders/{orderId}
 */
export interface InternalMatchOrder {
  orderId: string;             // 訂單ID
  employeeId: string;          // 員工ID
  storeId: string;             // 店鋪ID
  type: 'buy' | 'sell';        // 訂單類型：買入/賣出
  shares: number;              // 股數
  pricePerShare: number;       // 每股出價/售價
  status: OrderStatus;         // 訂單狀態
  matchedOrderId?: string;     // 匹配的訂單ID
  createdAt: Date;             // 建立時間
  updatedAt: Date;             // 更新時間
}

/**
 * 訂單狀態
 */
export type OrderStatus = 'open' | 'matched' | 'cancelled' | 'expired' | 'completed';

/**
 * 法律配置，存放於 legal_config/{storeId}
 */
export interface LegalConfig {
  storeId: string;             // 店鋪ID
  equityType: EquityType;      // 股權類型
  vestingPeriodMonths: number; // 歸屬期（月）
  goodLeaverPct: number;       // 好的離職者回購百分比
  badLeaverPct: number;        // 壞的離職者回購百分比
  buybackReserve: number;      // 回購儲備金額
  createdAt: Date;             // 建立時間
  updatedAt: Date;             // 更新時間
}

/**
 * 離職類型
 */
export type LeaveType = 'good_leaver' | 'bad_leaver' | 'death'; 