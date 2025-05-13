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
  RECEIPT = 'receipt',        // 入庫
  ISSUE = 'issue',            // 領用
  TRANSFER = 'transfer',      // 移撥
  STOCK_COUNT = 'stockCount', // 盤點調整
  WASTAGE = 'wastage',        // 耗損
  RETURN = 'return'           // 退貨
}

/**
 * 庫存調整記錄 - 記錄非銷售導致的庫存變動
 */
export interface StockAdjustment {
  adjustmentId: string;        // 調整記錄ID
  itemId: string;              // 品項ID
  storeId: string;             // 分店ID
  tenantId: string;            // 租戶ID
  adjustmentType: StockAdjustmentType; // 調整類型
  quantityAdjusted: number;    // 調整數量 (正數表示增加，負數表示減少)
  reason?: string;             // 調整原因
  adjustmentDate: Date;        // 調整日期
  operatorId: string;          // 操作者ID
  beforeQuantity: number;      // 調整前數量
  afterQuantity: number;       // 調整後數量
  transferToStoreId?: string;  // 移撥目標分店 (僅移撥類型)
}

/**
 * 創建庫存品項請求
 */
export interface CreateInventoryItemRequest {
  name: string;
  description?: string;
  category: string;
  unit: string;
  supplierInfo?: {
    name: string;
    contactInfo?: string;
    code?: string;
  };
  lowStockThreshold?: number;
  images?: string[];
  barcode?: string;
  sku?: string;
  isActive?: boolean;
  costPerUnit?: number;
}

/**
 * 更新庫存品項請求
 */
export interface UpdateInventoryItemRequest extends Partial<CreateInventoryItemRequest> {}

/**
 * 創建/更新庫存水平請求
 */
export interface UpsertStockLevelRequest {
  quantity: number;
  lowStockThreshold?: number;
}

/**
 * 創建庫存調整請求
 */
export interface CreateStockAdjustmentRequest {
  itemId: string;
  storeId: string;
  adjustmentType: StockAdjustmentType;
  quantityAdjusted: number;
  reason?: string;
  adjustmentDate?: string; // ISO格式日期字符串
  transferToStoreId?: string;
}

/**
 * 查詢庫存品項過濾條件
 */
export interface InventoryItemsFilter {
  category?: string;
  name?: string;
  lowStock?: boolean;
  isActive?: boolean;
  storeId?: string;
}

/**
 * 查詢庫存水平過濾條件
 */
export interface StockLevelsFilter {
  itemId?: string;
  category?: string;
  name?: string;
  lowStock?: boolean;
}

/**
 * 查詢庫存調整記錄過濾條件
 */
export interface StockAdjustmentsFilter {
  itemId?: string;
  storeId?: string;
  adjustmentType?: StockAdjustmentType;
  startDate?: Date;
  endDate?: Date;
  operatorId?: string;
}

/**
 * 庫存警報類型
 */
export enum InventoryAlertType {
  LOW_STOCK = 'low_stock',    // 低庫存
  EXPIRED = 'expired',        // 過期
  OVERSTOCK = 'overstock'     // 庫存過多
}

/**
 * 庫存警報
 */
export interface InventoryAlert {
  alertId: string;            // 警報ID
  itemId: string;             // 品項ID
  storeId: string;            // 分店ID
  tenantId: string;           // 租戶ID
  alertType: InventoryAlertType; // 警報類型
  severity: 'high' | 'medium' | 'low'; // 嚴重程度
  message: string;            // 警報訊息
  currentValue: number;       // 目前值
  thresholdValue: number;     // 閾值
  isActive: boolean;          // 是否仍然活動中
  createdAt: Date;            // 創建時間
  resolvedAt?: Date;          // 解決時間 (選填)
  resolvedBy?: string;        // 解決者ID (選填)
}

/**
 * 批量更新庫存水平請求
 */
export interface BatchUpdateStockLevelsRequest {
  items: {
    itemId: string;
    storeId: string;
    quantity: number;
    lowStockThreshold?: number;
  }[];
  reason?: string;
}

/**
 * 批量庫存調整請求
 */
export interface BatchStockAdjustmentRequest {
  adjustments: {
    itemId: string;
    storeId: string;
    adjustmentType: StockAdjustmentType;
    quantityAdjusted: number;
    reason?: string;
    transferToStoreId?: string;
  }[];
  adjustmentDate?: string; // ISO格式日期字符串
}

/**
 * 批量操作回應
 */
export interface BatchOperationResponse {
  success: boolean;
  results: {
    itemId: string;
    storeId: string;
    success: boolean;
    error?: string;
    data?: any;
  }[];
  failureCount: number;
  successCount: number;
} 