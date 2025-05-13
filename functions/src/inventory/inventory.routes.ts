/**
 * 庫存管理模組的路由配置
 */

import { Router } from 'express';
import { withPermissionCheck } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { 
  createInventoryItem, 
  getInventoryItem, 
  updateInventoryItem, 
  deleteInventoryItem, 
  listInventoryItems,
  upsertStockLevel,
  getStoreStockLevels,
  createStockAdjustment,
  getStockAdjustment,
  listStockAdjustments
} from './inventory.handlers';

import {
  CreateInventoryItemSchema,
  UpdateInventoryItemSchema,
  UpsertStockLevelSchema,
  CreateStockAdjustmentSchema,
  InventoryItemParamsSchema,
  StockLevelParamsSchema,
  StockAdjustmentParamsSchema,
  ListInventoryItemsSchema,
  ListStockLevelsSchema,
  ListStockAdjustmentsSchema
} from './schemas/inventory.schema';

const router = Router();

// 庫存品項路由
router.post('/items', 
  withPermissionCheck('inventory:create'), 
  validateRequest({ body: CreateInventoryItemSchema }),
  createInventoryItem
);

router.get('/items', 
  withPermissionCheck('inventory:read'), 
  validateRequest({ query: ListInventoryItemsSchema }),
  listInventoryItems
);

router.get('/items/:itemId', 
  withPermissionCheck('inventory:read'), 
  validateRequest({ params: InventoryItemParamsSchema }),
  getInventoryItem
);

router.put('/items/:itemId', 
  withPermissionCheck('inventory:update'), 
  validateRequest({ params: InventoryItemParamsSchema, body: UpdateInventoryItemSchema }),
  updateInventoryItem
);

router.delete('/items/:itemId', 
  withPermissionCheck('inventory:delete'), 
  validateRequest({ params: InventoryItemParamsSchema }),
  deleteInventoryItem
);

// 庫存水平路由
router.put('/items/:itemId/stock-levels/:storeId', 
  withPermissionCheck('inventory:update'), 
  validateRequest({ params: StockLevelParamsSchema, body: UpsertStockLevelSchema }),
  upsertStockLevel
);

router.get('/stock-levels/:storeId', 
  withPermissionCheck('inventory:read'), 
  validateRequest({ params: { storeId: StockLevelParamsSchema.shape.storeId }, query: ListStockLevelsSchema.omit({ storeId: true }) }),
  getStoreStockLevels
);

// 庫存調整路由
router.post('/adjustments', 
  withPermissionCheck('inventory:create'), 
  validateRequest({ body: CreateStockAdjustmentSchema }),
  createStockAdjustment
);

router.get('/adjustments', 
  withPermissionCheck('inventory:read'), 
  validateRequest({ query: ListStockAdjustmentsSchema }),
  listStockAdjustments
);

router.get('/adjustments/:adjustmentId', 
  withPermissionCheck('inventory:read'), 
  validateRequest({ params: StockAdjustmentParamsSchema }),
  getStockAdjustment
);

export default router; 