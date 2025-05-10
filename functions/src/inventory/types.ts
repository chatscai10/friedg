/**
 * 庫存管理系統資料模型
 * 包含庫存項目、盤點記錄、內部叫貨單等核心資料結構
 */

/**
 * 庫存項目基本資料結構
 */
export interface InventoryItem {
  id: string;
  tenantId: string;      // 租戶ID，用於資料隔離
  storeId: string;       // 分店ID
  name: string;          // 品項名稱
  unit: string;          // 計量單位（如：包、桶、箱等）
  description?: string;  // 品項描述（選填）
  category?: string;     // 分類（選填）
  minStockLevel?: number; // 最低庫存量（選填）
  isActive: boolean;     // 是否啟用
  createdAt: Date;       // 建立時間
  updatedAt: Date;       // 最後更新時間
  // 注意：不直接儲存 currentQuantity，而是通過盤點記錄推算
}

/**
 * 庫存地點資料結構
 */
export interface StockLocation {
  id: string;
  tenantId: string;      // 租戶ID
  name: string;          // 地點名稱（如：中央廚房、倉庫、特定分店）
  type: 'store' | 'warehouse' | 'central_kitchen'; // 地點類型
  address?: string;      // 地址（選填）
  isActive: boolean;     // 是否啟用
  createdAt: Date;       // 建立時間
  updatedAt: Date;       // 最後更新時間
}

/**
 * 盤點記錄資料結構
 */
export interface StockCount {
  id: string;
  tenantId: string;      // 租戶ID
  locationId: string;    // 地點ID（StockLocation.id）
  countDate: Date;       // 盤點日期
  status: 'draft' | 'submitted' | 'approved' | 'rejected'; // 盤點狀態
  countedBy: string;     // 盤點人員ID
  approvedBy?: string;   // 審核人員ID（選填）
  notes?: string;        // 備註（選填）
  items: StockCountItem[]; // 盤點項目清單
  createdAt: Date;       // 建立時間
  updatedAt: Date;       // 最後更新時間
}

/**
 * 盤點項目詳細資料
 */
export interface StockCountItem {
  inventoryItemId: string; // 庫存項目ID
  countedQuantity: number; // 盤點數量
  previousQuantity?: number; // 前次盤點數量（若有）
  difference?: number;     // 差異數量（系統計算）
  notes?: string;          // 備註（選填）
}

/**
 * 內部叫貨單資料結構
 */
export interface InternalRequisition {
  id: string;
  tenantId: string;      // 租戶ID
  requestNumber: string; // 叫貨單號
  fromLocationId: string; // 申請方地點ID
  toLocationId: string;  // 供應方地點ID
  requestedBy: string;   // 申請人ID
  approvedBy?: string;   // 核准人ID（選填）
  status: 'draft' | 'submitted' | 'approved' | 'partially_fulfilled' | 'fulfilled' | 'rejected' | 'cancelled'; // 叫貨單狀態
  requestDate: Date;     // 申請日期
  requiredDate?: Date;   // 需求日期（選填）
  fulfillmentDate?: Date; // 實際供應日期（選填）
  notes?: string;        // 備註（選填）
  items: RequisitionItem[]; // 叫貨項目清單
  createdAt: Date;       // 建立時間
  updatedAt: Date;       // 最後更新時間
}

/**
 * 叫貨項目詳細資料
 */
export interface RequisitionItem {
  inventoryItemId: string; // 庫存項目ID
  requestedQuantity: number; // 需求數量
  approvedQuantity?: number; // 核准數量
  fulfilledQuantity?: number; // 實際供應數量
  notes?: string;          // 備註（選填）
}

/**
 * 庫存異動記錄（用於追蹤庫存變化）
 */
export interface InventoryTransaction {
  id: string;
  tenantId: string;      // 租戶ID
  locationId: string;    // 地點ID
  inventoryItemId: string; // 庫存項目ID
  transactionType: 'stock_count' | 'requisition_in' | 'requisition_out' | 'adjustment' | 'other'; // 異動類型
  referenceId?: string;  // 關聯文件ID（如盤點ID或叫貨單ID）
  quantity: number;      // 異動數量（正數為增加，負數為減少）
  notes?: string;        // 備註（選填）
  performedBy: string;   // 操作人員ID
  transactionDate: Date; // 異動日期
  createdAt: Date;       // 建立時間
} 