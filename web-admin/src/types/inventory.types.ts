/**
 * 庫存管理模組的資料類型定義
 */

/**
 * 庫存品項主檔
 */
export interface InventoryItem {
  itemId: string;             // 品項ID
  name: string;               // 品項名稱
  description?: string;       // 品項描述 (選填)
  category: string;           // 品項分類 (e.g., 原料、包材、餐具)
  unit: string;               // 計量單位 (e.g., 個、公斤、公升)
  supplierInfo?: {            // 供應商資訊 (選填)
    supplierId?: string;      // 供應商ID
    supplierName?: string;    // 供應商名稱
    supplierContactInfo?: string; // 供應商聯絡資訊
    defaultOrderQuantity?: number; // 預設訂購數量
    leadTime?: number;        // 供貨前置時間 (天)
  };
  lowStockThreshold?: number; // 低庫存閾值 (選填)
  images?: string[];          // 品項圖片URL
  barcode?: string;           // 條碼 (選填)
  sku?: string;               // 庫存單位 (選填)
  isActive: boolean;          // 是否啟用
  costPerUnit?: number;       // 單位成本 (選填)
  tenantId: string;           // 租戶ID
  createdAt: Date;            // 創建時間
  updatedAt: Date;            // 更新時間
  createdBy: string;          // 創建者ID
  updatedBy: string;          // 更新者ID
}

/**
 * 庫存水平 - 追蹤每個品項在各分店的數量
 */
export interface StockLevel {
  stockLevelId: string;       // 庫存水平ID
  itemId: string;             // 品項ID
  storeId: string;            // 分店ID
  tenantId: string;           // 租戶ID
  quantity: number;           // 現有庫存量
  lowStockThreshold: number;  // 最低庫存警告水位
  lastUpdated: Date;          // 最後更新時間
  lastUpdatedBy: string;      // 最後更新者ID
}

/**
 * 庫存調整類型
 */
export enum StockAdjustmentType {
  RECEIPT = '入庫',           // 收貨/進貨
  ISSUE = '出庫',             // 領料/出庫
  STOCK_COUNT = '盤點調整',    // 盤點差異
  DAMAGE = '損壞報廢',         // 損耗/報廢
  TRANSFER = '移撥',          // 移撥
  OTHER = '其他'              // 其他
}

/**
 * 庫存調整記錄 - 記錄非銷售導致的庫存變動
 */
export interface StockAdjustment {
  adjustmentId: string;       // 調整ID
  itemId: string;             // 品項ID
  storeId: string;            // 分店ID
  tenantId: string;           // 租戶ID
  adjustmentType: StockAdjustmentType; // 調整類型
  quantityAdjusted: number;   // 數量變化 (正數為增加，負數為減少)
  reason?: string;            // 調整原因 (選填)
  adjustmentDate: Date;       // 調整日期
  operatorId: string;         // 操作者ID
  beforeQuantity?: number;    // 調整前數量 (選填)
  afterQuantity?: number;     // 調整後數量 (選填)
  transferToStoreId?: string; // 移撥目的地分店ID (僅移撥類型適用)
}

/**
 * 創建庫存品項請求
 */
export interface CreateInventoryItemRequest {
  name: string;               // 品項名稱
  description?: string;       // 品項描述
  category: string;           // 品項分類
  unit: string;               // 計量單位
  supplierInfo?: {            // 供應商資訊
    supplierId?: string;      // 供應商ID
    supplierName?: string;    // 供應商名稱
    supplierContactInfo?: string; // 供應商聯絡資訊
    defaultOrderQuantity?: number; // 預設訂購數量
    leadTime?: number;        // 供貨前置時間 (天)
  };
  lowStockThreshold?: number; // 低庫存閾值
  images?: string[];          // 品項圖片URL
  barcode?: string;           // 條碼
  sku?: string;               // 庫存單位
  isActive?: boolean;         // 是否啟用 (預設為true)
  costPerUnit?: number;       // 單位成本
}

/**
 * 更新庫存品項請求
 */
export interface UpdateInventoryItemRequest {
  name?: string;              // 品項名稱
  description?: string;       // 品項描述
  category?: string;          // 品項分類
  unit?: string;              // 計量單位
  supplierInfo?: {            // 供應商資訊
    supplierId?: string;      // 供應商ID
    supplierName?: string;    // 供應商名稱
    supplierContactInfo?: string; // 供應商聯絡資訊
    defaultOrderQuantity?: number; // 預設訂購數量
    leadTime?: number;        // 供貨前置時間 (天)
  };
  lowStockThreshold?: number; // 低庫存閾值
  images?: string[];          // 品項圖片URL
  barcode?: string;           // 條碼
  sku?: string;               // 庫存單位
  isActive?: boolean;         // 是否啟用
  costPerUnit?: number;       // 單位成本
}

/**
 * 創建/更新庫存水平請求
 */
export interface UpsertStockLevelRequest {
  quantity: number;           // 庫存數量
  lowStockThreshold?: number; // 低庫存閾值 (選填，未提供時會使用品項主檔的閾值)
}

/**
 * 查詢庫存品項過濾條件
 */
export interface InventoryItemsFilter {
  category?: string;          // 按分類過濾
  name?: string;              // 按名稱搜尋 (模糊匹配)
  lowStock?: boolean;         // 僅顯示低於閾值的品項
  isActive?: boolean;         // 按活動狀態過濾
  storeId?: string;           // 查詢特定分店庫存
  page?: number;              // 頁碼
  pageSize?: number;          // 每頁項目數
}

/**
 * 分頁回應介面
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * API回應結構
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 創建庫存調整記錄請求
 */
export interface CreateStockAdjustmentRequest {
  itemId: string;             // 品項ID
  storeId: string;            // 分店ID
  adjustmentType: StockAdjustmentType; // 調整類型
  quantityAdjusted: number;   // 調整數量 (正數為增加，負數為減少)
  reason?: string;            // 調整原因 (選填)
}

/**
 * 查詢庫存調整記錄過濾條件
 */
export interface StockAdjustmentsFilter {
  itemId?: string;            // 按品項ID過濾
  storeId?: string;           // 按分店ID過濾
  adjustmentType?: StockAdjustmentType; // 按調整類型過濾
  startDate?: string;         // 開始日期
  endDate?: string;           // 結束日期
  page?: number;              // 頁碼
  pageSize?: number;          // 每頁項目數
} 