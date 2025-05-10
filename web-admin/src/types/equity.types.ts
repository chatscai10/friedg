/**
 * 動態股權系統 (Dynamic Equity Framework) 前端類型定義
 * 
 * 此文件定義了前端需要的動態股權系統相關TypeScript介面。
 */

/**
 * 股權類型枚舉
 */
export enum EquityType {
  PHANTOM = 'phantom',   // 虛擬股（僅享有分紅權，無決策投票權）
  REAL = 'real'          // 實股（Class B 無表決權股）
}

/**
 * 股份價格日誌 - 記錄歷史股價及計算依據
 */
export interface SharePriceLog {
  valuationId: string;           // 估值ID
  storeId: string;               // 店鋪ID
  tenantId: string;              // 租戶ID
  effectiveDate: string;         // 生效日期 (ISO格式)
  sharePrice: number;            // 每股價格
  priorSharePrice?: number;      // 上一次股價
  priceChangePercentage: number; // 價格變化百分比
  averageNetProfit: number;      // 計算所用的平均稅後淨利
  monthsInCalculation: number;   // 計算使用的月數 (通常是12個月，新店可能是3個月)
  multiplier: number;            // 使用的乘數 (標準為4，新店可能為8)
  valuationNotes?: string;       // 估值備註
  totalCompanyValue: number;     // 總公司估值 (股價 × 100)
  approvedBy?: string;           // 批准人 (管理員ID)
  createdAt: string;             // 創建時間 (ISO格式)
  updatedAt: string;             // 更新時間 (ISO格式)
}

/**
 * 店鋪股權池 - 管理每家店鋪的員工股權池
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
  lastValuationDate: string;     // 最後估值日期 (ISO格式)
  equityType: EquityType;        // 股權類型
  purchaseWindowOpen: boolean;   // 購股窗口是否開放
  maxEmployeePercentage: number; // 員工持股上限百分比 (預設10%)
  maxTotalEmployeePercentage: number; // 全體員工持股上限 (預設49%)
  buybackReserveBalance: number; // 回購儲備餘額
  createdAt: string;             // 創建時間 (ISO格式)
  updatedAt: string;             // 更新時間 (ISO格式)
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
 */
export interface EmployeeEquityHolding {
  holdingId: string;              // 持有ID
  employeeId: string;             // 員工ID
  storeId: string;                // 店鋪ID
  tenantId: string;               // 租戶ID
  equityType: EquityType;         // 股權類型 (虛擬股/實股)
  shares: number;                 // 股份數量
  acquiredDate: string;           // 獲取日期 (ISO格式)
  sourceType: EquitySourceType;   // 獲取來源 (績效/認購)
  purchasePrice?: number;         // 認購價格 (若適用)
  totalInvestment?: number;       // 總投資金額 (若適用)
  vestingStartDate: string;       // 鎖定期開始日期 (ISO格式)
  vestingEndDate: string;         // 鎖定期結束日期 (ISO格式)
  vestingPercentage: number;      // 已歸屬百分比
  installmentPlanId?: string;     // 分期付款計劃ID (若適用)
  status: EquityHoldingStatus;    // 狀態
  currentValue: number;           // 當前市值
  lastValuationDate: string;      // 最後估值日期 (ISO格式)
  createdAt: string;              // 創建時間 (ISO格式)
  updatedAt: string;              // 更新時間 (ISO格式)
  // 前端顯示額外數據
  employeeName?: string;          // 員工姓名
  storeName?: string;             // 店鋪名稱
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
 */
export interface DividendCycle {
  cycleId: string;                // 週期ID (格式：store_{storeId}_Q{1-4}_{year})
  storeId: string;                // 店鋪ID
  tenantId: string;               // 租戶ID
  year: number;                   // 年份
  quarter: number;                // 季度 (1-4)
  startDate: string;              // 開始日期 (ISO格式)
  endDate: string;                // 結束日期 (ISO格式)
  totalNetProfit: number;         // 該週期總淨利潤
  previousDeficit: number;        // 需彌補虧損
  distributableProfit: number;    // 可分配利潤總額
  dividendPerShare: number;       // 每股分紅金額
  totalDividendAmount: number;    // 總分紅金額
  status: DividendCycleStatus;    // 狀態
  calculationDate?: string;       // 計算日期 (ISO格式)
  approvalDate?: string;          // 審批日期 (ISO格式)
  approvedBy?: string;            // 審批人
  distributionDate?: string;      // 分配日期 (ISO格式)
  notes?: string;                 // 備註
  createdAt: string;              // 創建時間 (ISO格式)
  updatedAt: string;              // 更新時間 (ISO格式)
  // 前端顯示額外數據
  storeName?: string;             // 店鋪名稱
}

/**
 * 交易窗口狀態枚舉
 */
export enum TradeWindowStatus {
  SCHEDULED = 'scheduled',        // 已排程
  OPEN = 'open',                  // 開放中
  CLOSED = 'closed',              // 已關閉
  CANCELLED = 'cancelled'         // 已取消
}

/**
 * 內部交易窗口
 */
export interface InternalTradeWindow {
  windowId: string;               // 窗口ID (自動生成)
  storeId: string;                // 店鋪ID
  tenantId: string;               // 租戶ID
  year: number;                   // 年份
  quarter: number;                // 季度
  openDate: string;               // 開放日期 (ISO格式)
  closeDate: string;              // 關閉日期 (ISO格式)
  referenceSharePrice: number;    // 參考股價 (基於最新估值)
  minPrice: number;               // 最低允許交易價格 (-10%)
  maxPrice: number;               // 最高允許交易價格 (+10%)
  platformFeePercentage: number;  // 平台服務費百分比 (預設1%)
  status: TradeWindowStatus;      // 狀態
  totalVolumeTraded?: number;     // 總成交量
  totalValueTraded?: number;      // 總成交金額
  createdAt: string;              // 創建時間 (ISO格式)
  updatedAt: string;              // 更新時間 (ISO格式)
  // 前端顯示額外數據
  storeName?: string;             // 店鋪名稱
}

/**
 * 法律配置
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
  createdAt: string;              // 創建時間 (ISO格式)
  updatedAt: string;              // 更新時間 (ISO格式)
  // 前端顯示額外數據
  storeName?: string;             // 店鋪名稱
}

// 各種API響應接口
export interface ValuationResponse {
  valuation: SharePriceLog;
}

export interface ValuationsResponse {
  valuations: SharePriceLog[];
  totalCount: number;
  nextCursor?: string;
}

export interface PoolResponse {
  pool: StoreEquityPool;
}

export interface HoldingResponse {
  holding: EmployeeEquityHolding;
}

export interface HoldingsResponse {
  holdings: EmployeeEquityHolding[];
  totalCount: number;
  nextCursor?: string;
}

export interface DividendCycleResponse {
  cycle: DividendCycle;
}

export interface DividendCyclesResponse {
  cycles: DividendCycle[];
  totalCount: number;
  nextCursor?: string;
}

export interface TradeWindowResponse {
  window: InternalTradeWindow;
}

export interface TradeWindowsResponse {
  windows: InternalTradeWindow[];
  totalCount: number;
  nextCursor?: string;
}

export interface LegalConfigResponse {
  config: LegalConfig;
}

// API 請求參數接口
export interface ValuationFilters {
  storeId: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: string;
}

export interface HoldingFilters {
  storeId?: string;
  employeeId?: string;
  status?: EquityHoldingStatus;
  limit?: number;
  cursor?: string;
}

export interface DividendCycleFilters {
  storeId?: string;
  year?: number;
  quarter?: number;
  status?: DividendCycleStatus;
  limit?: number;
  cursor?: string;
}

export interface TradeWindowFilters {
  storeId?: string;
  year?: number;
  quarter?: number;
  status?: TradeWindowStatus;
  limit?: number;
  cursor?: string;
}

// 更新請求接口
export interface UpdateLegalConfigRequest {
  equityType?: EquityType;
  performanceVestingMonths?: number;
  purchaseVestingMonths?: number;
  maxInstallments?: number;
  goodLeaverRepurchasePercentage?: number;
  badLeaverRepurchasePercentage?: number;
  buybackReservePercentage?: number;
  platformFeePercentage?: number;
  tradingWindowDays?: number;
  maxPriceVariationPercentage?: number;
  dividendTaxRate?: number;
  legalDocumentUrls?: {
    equityAgreement?: string;
    vestingSchedule?: string;
    taxInformation?: string;
  };
}

export interface UpdatePoolRequest {
  poolShares?: number;
  maxEmployeePercentage?: number;
  maxTotalEmployeePercentage?: number;
  purchaseWindowOpen?: boolean;
}

export interface UpdateHoldingStatusRequest {
  status: EquityHoldingStatus;
  notes?: string;
} 