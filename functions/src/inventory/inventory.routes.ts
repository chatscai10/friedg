/**
 * 庫存管理模組的路由配置
 */

import { Router } from 'express';
import { withPermissionCheck } from '../middleware/auth.middleware';
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

const router = Router();

// 庫存品項路由
router.post('/items', withPermissionCheck('inventory:create'), createInventoryItem);
router.get('/items', withPermissionCheck('inventory:read'), listInventoryItems);
router.get('/items/:itemId', withPermissionCheck('inventory:read'), getInventoryItem);
router.put('/items/:itemId', withPermissionCheck('inventory:update'), updateInventoryItem);
router.delete('/items/:itemId', withPermissionCheck('inventory:delete'), deleteInventoryItem);

// 庫存水平路由
router.put('/items/:itemId/stock-levels/:storeId', withPermissionCheck('inventory:update'), upsertStockLevel);
router.get('/stock-levels/:storeId', withPermissionCheck('inventory:read'), getStoreStockLevels);

// 庫存調整路由
router.post('/adjustments', withPermissionCheck('inventory:create'), createStockAdjustment);
router.get('/adjustments', withPermissionCheck('inventory:read'), listStockAdjustments);
router.get('/adjustments/:adjustmentId', withPermissionCheck('inventory:read'), getStockAdjustment);

export default router; 