/**
 * 庫存管理模組的資料驗證工具
 */
import { ValidationError } from './errors';
import { StockAdjustmentType } from '../inventory.types';

/**
 * 驗證庫存品項資料
 */
export function validateInventoryItem(item: any) {
  const errors: string[] = [];
  
  if (!item.name) errors.push('name');
  if (!item.category) errors.push('category');
  if (!item.unit) errors.push('unit');
  if (!item.tenantId) errors.push('tenantId');
  
  if (item.lowStockThreshold !== undefined && 
      (typeof item.lowStockThreshold !== 'number' || item.lowStockThreshold < 0)) {
    errors.push('lowStockThreshold');
  }
  
  if (errors.length > 0) {
    throw new ValidationError('庫存品項缺少或有無效的必要欄位', errors);
  }
}

/**
 * 驗證庫存調整資料
 */
export function validateStockAdjustment(adjustment: any) {
  const errors: string[] = [];
  
  if (!adjustment.itemId) errors.push('itemId');
  if (!adjustment.storeId) errors.push('storeId');
  if (!adjustment.tenantId) errors.push('tenantId');
  
  if (!adjustment.adjustmentType) {
    errors.push('adjustmentType');
  } else if (!Object.values(StockAdjustmentType).includes(adjustment.adjustmentType)) {
    errors.push('adjustmentType');
  }
  
  if (adjustment.quantityAdjusted === undefined) {
    errors.push('quantityAdjusted');
  } else if (typeof adjustment.quantityAdjusted !== 'number' || adjustment.quantityAdjusted === 0) {
    errors.push('quantityAdjusted');
  }
  
  if (adjustment.adjustmentType === StockAdjustmentType.TRANSFER && !adjustment.transferToStoreId) {
    errors.push('transferToStoreId');
  }
  
  if (errors.length > 0) {
    throw new ValidationError('庫存調整有無效或缺少的欄位', errors);
  }
}

/**
 * 驗證庫存水平資料
 */
export function validateStockLevel(stockLevel: any) {
  const errors: string[] = [];
  
  if (!stockLevel.itemId) errors.push('itemId');
  if (!stockLevel.storeId) errors.push('storeId');
  if (!stockLevel.tenantId) errors.push('tenantId');
  
  if (stockLevel.quantity === undefined) {
    errors.push('quantity');
  } else if (typeof stockLevel.quantity !== 'number' || stockLevel.quantity < 0) {
    errors.push('quantity');
  }
  
  if (stockLevel.lowStockThreshold !== undefined && 
      (typeof stockLevel.lowStockThreshold !== 'number' || stockLevel.lowStockThreshold < 0)) {
    errors.push('lowStockThreshold');
  }
  
  if (errors.length > 0) {
    throw new ValidationError('庫存水平有無效或缺少的欄位', errors);
  }
} 