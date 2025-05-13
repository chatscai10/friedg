/**
 * 庫存系統資料驗證 Schema
 * 使用 zod 實現強型別驗證
 */

import { z } from 'zod';
import { 
  safeInteger, 
  safeFloat, 
  paginationSchema,
  dateRangeSchema
} from '../../libs/validation/schema';

/**
 * 庫存調整類型枚舉
 */
export const StockAdjustmentTypeEnum = z.enum([
  '入庫',     // RECEIPT - 收貨/進貨
  '出庫',     // ISSUE - 領料/出庫
  '盤點調整', // STOCK_COUNT - 盤點差異
  '損壞報廢', // DAMAGE - 損耗/報廢
  '移撥',     // TRANSFER - 移撥
  '其他'      // OTHER - 其他
]);

/**
 * 供應商資訊 Schema
 */
export const SupplierInfoSchema = z.object({
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  supplierContactInfo: z.string().optional(),
  defaultOrderQuantity: safeFloat.optional(),
  leadTime: safeInteger.optional()
});

/**
 * 庫存品項基本信息 Schema
 */
export const InventoryItemBaseSchema = z.object({
  name: z.string().min(1, "品項名稱不能為空"),
  description: z.string().optional(),
  category: z.string().min(1, "品項分類不能為空"),
  unit: z.string().min(1, "計量單位不能為空"),
  supplierInfo: SupplierInfoSchema.optional(),
  lowStockThreshold: safeInteger.optional(),
  images: z.array(z.string().url("圖片必須是有效的URL")).optional(),
  barcode: z.string().optional(),
  sku: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  costPerUnit: safeFloat.optional()
});

/**
 * 創建庫存品項請求 Schema
 */
export const CreateInventoryItemSchema = InventoryItemBaseSchema;

/**
 * 更新庫存品項請求 Schema
 */
export const UpdateInventoryItemSchema = InventoryItemBaseSchema.partial();

/**
 * 庫存品項 ID 參數 Schema
 */
export const InventoryItemParamsSchema = z.object({
  itemId: z.string().min(1, "品項ID不能為空")
});

/**
 * 庫存水平請求 Schema
 */
export const UpsertStockLevelSchema = z.object({
  quantity: safeFloat,
  lowStockThreshold: safeInteger.optional()
});

/**
 * 庫存水平ID參數 Schema
 */
export const StockLevelParamsSchema = z.object({
  itemId: z.string().min(1, "品項ID不能為空"),
  storeId: z.string().min(1, "分店ID不能為空")
});

/**
 * 庫存調整請求 Schema
 */
export const CreateStockAdjustmentSchema = z.object({
  itemId: z.string().min(1, "品項ID不能為空"),
  storeId: z.string().min(1, "分店ID不能為空"),
  adjustmentType: StockAdjustmentTypeEnum,
  quantityAdjusted: safeFloat.refine(n => n !== 0, "調整數量不能為零"),
  reason: z.string().optional(),
  adjustmentDate: z.preprocess(
    (arg) => arg instanceof Date ? arg : new Date(String(arg)),
    z.date().optional()
  ),
  transferToStoreId: z.string().optional()
}).refine(
  data => data.adjustmentType !== '移撥' || !!data.transferToStoreId, 
  { message: "移撥類型必須提供目標分店ID", path: ["transferToStoreId"] }
);

/**
 * 庫存調整ID參數 Schema
 */
export const StockAdjustmentParamsSchema = z.object({
  adjustmentId: z.string().min(1, "調整ID不能為空")
});

/**
 * 庫存品項查詢參數 Schema
 */
export const ListInventoryItemsSchema = z.object({
  category: z.string().optional(),
  name: z.string().optional(),
  lowStock: z.boolean().optional(),
  isActive: z.boolean().optional(),
  storeId: z.string().optional()
}).merge(paginationSchema);

/**
 * 庫存水平查詢參數 Schema
 */
export const ListStockLevelsSchema = z.object({
  storeId: z.string().min(1, "分店ID不能為空"),
  itemId: z.string().optional(),
  category: z.string().optional(),
  name: z.string().optional(),
  lowStock: z.boolean().optional()
}).merge(paginationSchema);

/**
 * 庫存調整查詢參數 Schema
 */
export const ListStockAdjustmentsSchema = z.object({
  itemId: z.string().optional(),
  storeId: z.string().optional(),
  adjustmentType: StockAdjustmentTypeEnum.optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  operatorId: z.string().optional()
}).merge(paginationSchema); 