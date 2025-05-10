/**
 * 動態股權系統 (Dynamic Equity Framework) 核心數據模型定義
 * 
 * 此文件定義了實現動態股權系統所需的所有TypeScript介面，
 * 對應Firestore集合的數據結構。
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/**
 * 股權類型枚舉
 */
export enum EquityType {
  PHANTOM = 'phantom',   // 虛擬股（僅享有分紅權，無決策投票權）
  REAL = 'real'          // 實股（Class B 無表決權股）
}

/**
 * 股份價格日誌 - 記錄歷史股價及計算依據
 * 集合：share_price_logs/{valuationId}
 */
export interface SharePriceLog {
  valuationId: string;           // 估值ID (自動生成)
  storeId: string;               // 店鋪ID
  tenantId: string;              // 租戶ID
  effectiveDate: Timestamp;      // 生效日期
  sharePrice: number;            // 每股價格
  priorSharePrice?: number;      // 上一次股價
  priceChangePercentage: number; // 價格變化百分比
  averageNetProfit: number;      // 計算所用的平均稅後淨利
  monthsInCalculation: number;   // 計算使用的月數 (通常是12個月，新店可能是3個月)
  multiplier: number;            // 使用的乘數 (標準為4，新店可能為8)
  valuationNotes?: string;       // 估值備註
  totalCompanyValue: number;     // 總公司估值 (股價 × 100)
  approvedBy?: string;           // 批准人 (管理員ID)
  createdAt: Timestamp;          // 創建時間
  updatedAt: Timestamp;          // 更新時間
}

/**
 * 店鋪股權池 - 管理每家店鋪的員工股權池
 * 集合：stores/{storeId}/equity_pool
 */
export interface StoreEquityPool {
  storeId: string;               // 店鋪ID
  tenantId: string;              // 租戶ID
  totalShares: number;           // 總股數 (預設100)
  poolShares: number;            // 總預留股份 (10-20)
  remainingPoolShares: number;   // 池中剩餘可分配股份數
  allocatedShares: number;       // 已分配股份數
  currentSharePrice: number;     // 當前每股價格
  currentValuation: number;      // 當前店鋪估值
  lastValuationId: string;       // 最後估值ID (參考SharePriceLog)
  lastValuationDate: Timestamp;  // 最後估值日期
  equityType: EquityType;        // 股權類型
  purchaseWindowOpen: boolean;   // 購股窗口是否開放
  maxEmployeePercentage: number; // 員工持股上限百分比 (預設10%)
  maxTotalEmployeePercentage: number; // 全體員工持股上限 (預設49%)
  buybackReserveBalance: number; // 回購儲備餘額
  createdAt: Timestamp;          // 創建時間
  updatedAt: Timestamp;          // 更新時間
}

/**
 * 股權獲取來源枚舉
 */
export enum EquitySourceType {
  PERFORMANCE = 'performance',   // 績效獎勵
  PURCHASE = 'purchase'          // 現金認購
}

/**
 * 股權狀態枚舉
 */
export enum EquityHoldingStatus {
  VESTING = 'vesting',           // 歸屬期內
  ACTIVE = 'active',             // 已歸屬，活躍
  FROZEN = 'frozen',             // 凍結 (可能因紀律問題)
  SELLING = 'selling',           // 正在出售中
  TERMINATED = 'terminated'      // 已終止
}

/**
 * 員工股權持有記錄 - 記錄員工持有的股權詳情
 * 集合：employee_equity/{holdingId}
 */
export interface EmployeeEquityHolding {
  holdingId: string;              // 持有ID (自動生成或 {employeeId}_{storeId})
  employeeId: string;             // 員工ID
  storeId: string;                // 店鋪ID
  tenantId: string;               // 租戶ID
  equityType: EquityType;         // 股權類型 (虛擬股/實股)
  shares: number;                 // 股份數量
  acquiredDate: Timestamp;        // 獲取日期
  sourceType: EquitySourceType;   // 獲取來源 (績效/認購)
  purchasePrice?: number;         // 認購價格 (若適用)
  totalInvestment?: number;       // 總投資金額 (若適用)
  vestingStartDate: Timestamp;    // 鎖定期開始日期
  vestingEndDate: Timestamp;      // 鎖定期結束日期
  vestingPercentage: number;      // 已歸屬百分比
  installmentPlanId?: string;     // 分期付款計劃ID (若適用)
  status: EquityHoldingStatus;    // 狀態
  currentValue: number;           // 當前市值
  lastValuationDate: Timestamp;   // 最後估值日期
  createdAt: Timestamp;           // 創建時間
  updatedAt: Timestamp;           // 更新時間
}

/**
 * 分期付款狀態枚舉
 */
export enum InstallmentStatus {
  ACTIVE = 'active',            // 進行中
  COMPLETED = 'completed',      // 已完成
  DEFAULTED = 'defaulted',      // 已違約
  CANCELLED = 'cancelled'       // 已取消
}

/**
 * 股權分期付款計劃 - 記錄分期購股的付款計劃
 * 集合：equity_installment_plans/{planId}
 */
export interface EquityInstallmentPlan {
  planId: string;                 // 計劃ID (自動生成)
  holdingId: string;              // 對應的EmployeeEquityHolding ID
  employeeId: string;             // 員工ID
  storeId: string;                // 店鋪ID
  tenantId: string;               // 租戶ID
  totalAmount: number;            // 總金額
  installments: number;           // 總期數 (1-6)
  installmentAmount: number;      // 每期金額
  paidInstallments: number;       // 已付期數
  remainingAmount: number;        // 剩餘應付金額
  nextPaymentDate: Timestamp;     // 下次付款日期
  startDate: Timestamp;           // 計劃開始日期
  expectedEndDate: Timestamp;     // 預計結束日期
  status: InstallmentStatus;      // 計劃狀態
  createdAt: Timestamp;           // 創建時間
  updatedAt: Timestamp;           // 更新時間
}

/**
 * 股權交易類型枚舉
 */
export enum EquityTransactionType {
  PERFORMANCE_GRANT = 'performance_grant',   // 績效授予
  PURCHASE = 'purchase',                     // 現金認購
  DIVIDEND = 'dividend',                     // 季度分紅
  INTERNAL_BUY = 'internal_buy',             // 內部轉讓-買入
  INTERNAL_SELL = 'internal_sell',           // 內部轉讓-賣出
  COMPANY_BUYBACK = 'company_buyback',       // 公司回購
  INSTALLMENT_PAYMENT = 'installment_payment',// 分期付款
  ADJUSTMENT = 'adjustment'                  // 調整 (管理員操作)
}

/**
 * 股權交易記錄 - 記錄所有股權的變動歷史
 * 集合：equity_transactions/{transactionId}
 */
export interface EquityTransaction {
  transactionId: string;          // 交易ID (自動生成)
  employeeId: string;             // 員工ID
  storeId: string;                // 店鋪ID
  tenantId: string;               // 租戶ID
  transactionDate: Timestamp;     // 交易日期
  transactionType: EquityTransactionType; // 交易類型
  shares: number;                 // 涉及股份數量
  sharePrice: number;             // 交易時股價
  totalAmount: number;            // 交易總金額
  holdingId?: string;             // 相關的持股記錄ID
  counterpartyId?: string;        // 關聯方 (如內部轉讓的對家員工ID)
  relatedTransactionId?: string;  // 關聯交易ID (例如轉讓的另一方)
  relatedDividendCycleId?: string;// 相關分紅週期ID
  installmentPlanId?: string;     // 相關分期付款計劃ID
  paymentMethod?: string;         // 支付方式
  notes?: string;                 // 備註
  approvedBy?: string;            // 批准人 (若需要審批)
  createdAt: Timestamp;           // 創建時間
  updatedAt: Timestamp;           // 更新時間
}

/**
 * 分紅週期狀態枚舉
 */
export enum DividendCycleStatus {
  DRAFT = 'draft',                // 草稿
  CALCULATING = 'calculating',    // 計算中
  PENDING_APPROVAL = 'pending_approval', // 待審批
  APPROVED = 'approved',          // 已審批
  DISTRIBUTING = 'distributing',  // 分配中
  COMPLETED = 'completed',        // 已完成
  CANCELLED = 'cancelled'         // 已取消
}

/**
 * 分紅週期記錄 - 管理每個季度的分紅計算與分配過程
 * 集合：dividend_cycles/{cycleId}
 */
export interface DividendCycle {
  cycleId: string;                // 週期ID (格式：store_{storeId}_Q{1-4}_{year})
  storeId: string;                // 店鋪ID
  tenantId: string;               // 租戶ID
  year: number;                   // 年份
  quarter: number;                // 季度 (1-4)
  startDate: Timestamp;           // 開始日期
  endDate: Timestamp;             // 結束日期
  totalNetProfit: number;         // 該週期總淨利潤
  previousDeficit: number;        // 需彌補虧損
  distributableProfit: number;    // 可分配利潤總額
  dividendPerShare: number;       // 每股分紅金額
  totalDividendAmount: number;    // 總分紅金額
  status: DividendCycleStatus;    // 狀態
  calculationDate?: Timestamp;    // 計算日期
  approvalDate?: Timestamp;       // 審批日期
  approvedBy?: string;            // 審批人
  distributionDate?: Timestamp;   // 分配日期
  notes?: string;                 // 備註
  createdAt: Timestamp;           // 創建時間
  updatedAt: Timestamp;           // 更新時間
}

/**
 * 分紅支付狀態枚舉
 */
export enum DividendPayoutStatus {
  PENDING = 'pending',            // 待支付
  PROCESSING = 'processing',      // 處理中
  PAID = 'paid',                  // 已支付
  FAILED = 'failed',              // 支付失敗
  CANCELLED = 'cancelled'         // 已取消
}

/**
 * 員工分紅記錄 - 記錄每個員工在特定分紅週期的分紅情況
 * 集合：dividend_payouts/{payoutId}
 */
export interface DividendPayout {
  payoutId: string;               // 分紅記錄ID (自動生成)
  cycleId: string;                // 對應的DividendCycle ID
  employeeId: string;             // 員工ID
  storeId: string;                // 店鋪ID
  tenantId: string;               // 租戶ID
  holdingId: string;              // 對應的持股記錄ID
  shareCount: number;             // 持股數量
  dividendPerShare: number;       // 每股分紅
  dividendAmount: number;         // 獲得分紅總金額
  tax?: number;                   // 稅金 (若需扣除)
  netPayoutAmount: number;        // 淨支付金額
  status: DividendPayoutStatus;   // 支付狀態
  paymentDate?: Timestamp;        // 支付日期
  paymentMethod?: string;         // 支付方式 (例如：LINE Pay)
  paymentReference?: string;      // 支付參考號
  notes?: string;                 // 備註
  transactionId?: string;         // 關聯的EquityTransaction ID
  createdAt: Timestamp;           // 創建時間
  updatedAt: Timestamp;           // 更新時間
}

/**
 * 內部交易窗口狀態枚舉
 */
export enum TradeWindowStatus {
  SCHEDULED = 'scheduled',        // 已排程
  OPEN = 'open',                  // 開放中
  CLOSED = 'closed',              // 已關閉
  CANCELLED = 'cancelled'         // 已取消
}

/**
 * 內部交易窗口 - 管理季度交易窗口設定
 * 集合：internal_trade_windows/{windowId}
 */
export interface InternalTradeWindow {
  windowId: string;               // 窗口ID (自動生成)
  storeId: string;                // 店鋪ID
  tenantId: string;               // 租戶ID
  year: number;                   // 年份
  quarter: number;                // 季度
  openDate: Timestamp;            // 開放日期
  closeDate: Timestamp;           // 關閉日期
  referenceSharePrice: number;    // 參考股價 (基於最新估值)
  minPrice: number;               // 最低允許交易價格 (-10%)
  maxPrice: number;               // 最高允許交易價格 (+10%)
  platformFeePercentage: number;  // 平台服務費百分比 (預設1%)
  status: TradeWindowStatus;      // 狀態
  totalVolumeTraded?: number;     // 總成交量
  totalValueTraded?: number;      // 總成交金額
  createdAt: Timestamp;           // 創建時間
  updatedAt: Timestamp;           // 更新時間
}

/**
 * 內部交易訂單類型枚舉
 */
export enum TradeOrderType {
  BUY = 'buy',                   // 買入
  SELL = 'sell'                  // 賣出
}

/**
 * 內部交易訂單狀態枚舉
 */
export enum TradeOrderStatus {
  OPEN = 'open',                 // 開放中
  PARTIALLY_FILLED = 'partially_filled', // 部分成交
  FILLED = 'filled',             // 已成交
  CANCELLED = 'cancelled',       // 已取消
  EXPIRED = 'expired'            // 已過期
}

/**
 * 內部交易訂單 - 記錄員工的內部交易買賣訂單
 * 集合：internal_trade_orders/{orderId}
 */
export interface InternalTradeOrder {
  orderId: string;                // 訂單ID (自動生成)
  windowId: string;               // 交易窗口ID
  employeeId: string;             // 員工ID
  storeId: string;                // 店鋪ID
  tenantId: string;               // 租戶ID
  orderType: TradeOrderType;      // 訂單類型 (買入/賣出)
  shareCount: number;             // 股份數量
  sharePrice: number;             // 期望價格
  totalOrderValue: number;        // 訂單總價值
  filledShareCount: number;       // 已成交股數
  remainingShareCount: number;    // 剩餘未成交股數
  holdingId?: string;             // 關聯的持股ID (僅賣單)
  status: TradeOrderStatus;       // 狀態
  matchedOrderIds: string[];      // 匹配的訂單ID列表
  platformFee?: number;           // 平台服務費
  expiryDate: Timestamp;          // 過期日期
  cancelledAt?: Timestamp;        // 取消時間
  createdAt: Timestamp;           // 創建時間
  updatedAt: Timestamp;           // 更新時間
}

/**
 * 離職類型枚舉
 */
export enum LeaveType {
  GOOD_LEAVER = 'good_leaver',    // 良性離職
  BAD_LEAVER = 'bad_leaver',      // 非良性離職
  DEATH = 'death'                 // 死亡
}

/**
 * 離職股權處理記錄 - 記錄員工離職時的股權處理
 * 集合：equity_exit/{exitId}
 */
export interface EquityExit {
  exitId: string;                 // 退出ID (自動生成)
  employeeId: string;             // 員工ID
  storeId: string;                // 店鋪ID
  tenantId: string;               // 租戶ID
  exitDate: Timestamp;            // 離職日期
  leaveType: LeaveType;           // 離職類型
  totalShares: number;            // 總股份數
  repurchasePrice: number;        // 回購價格
  repurchaseTotal: number;        // 回購總額
  originalValuation: number;      // 原始估值
  valuationDiscount: number;      // 估值折扣百分比
  status: string;                 // 處理狀態
  completionDate?: Timestamp;     // 完成日期
  transactionIds: string[];       // 相關交易ID
  notes?: string;                 // 備註
  processedBy: string;            // 處理人
  createdAt: Timestamp;           // 創建時間
  updatedAt: Timestamp;           // 更新時間
}

/**
 * 法律配置 - 記錄每家店鋪的股權相關法律配置
 * 集合：legal_config/{storeId}
 */
export interface LegalConfig {
  storeId: string;                // 店鋪ID
  tenantId: string;               // 租戶ID
  equityType: EquityType;         // 股權類型
  performanceVestingMonths: number; // 績效配股鎖定期 (月)
  purchaseVestingMonths: number;  // 認購鎖定期 (月)
  maxInstallments: number;        // 最大分期數
  goodLeaverRepurchasePercentage: number; // 良性離職回購百分比
  badLeaverRepurchasePercentage: number;  // 非良性離職回購百分比
  buybackReservePercentage: number; // 每季提撥的回購儲備百分比
  platformFeePercentage: number;  // 平台服務費百分比
  tradingWindowDays: number;      // 交易窗口開放天數
  maxPriceVariationPercentage: number; // 最大價格浮動百分比
  dividendTaxRate?: number;       // 分紅稅率 (若適用)
  legalDocumentUrls: {            // 法律文件URL
    equityAgreement?: string;
    vestingSchedule?: string;
    taxInformation?: string;
  };
  updatedBy: string;              // 更新人
  createdAt: Timestamp;           // 創建時間
  updatedAt: Timestamp;           // 更新時間
} 