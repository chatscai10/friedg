/**
 * 庫存服務模組索引
 */
import { InventoryItemService } from './inventory-item.service';
import { InventoryItemRepository } from '../repositories/inventory-item.repository';
import { StockLevelService } from './stock-level.service';
import { StockLevelRepository } from '../repositories/stock-level.repository';
import { StockAdjustmentService } from './stock-adjustment.service';
import { StockAdjustmentRepository } from '../repositories/stock-adjustment.repository';
import { StockTransferService } from './stock-transfer.service';
import { StockOperationService } from './stock-operation.service';
import { MemoryCache } from '../../../utils/memory-cache';
import { InventoryItem, StockLevel } from '../inventory.types';

// 創建儲存庫實例
const inventoryItemRepository = new InventoryItemRepository();
const stockLevelRepository = new StockLevelRepository();
const adjustmentRepository = new StockAdjustmentRepository();

// 創建共享緩存實例
const itemCache = new MemoryCache<InventoryItem>(600); // 10 分鐘
const stockLevelCache = new MemoryCache<StockLevel>(300); // 5 分鐘
const listCache = new MemoryCache<any>(60); // 1 分鐘

// 創建服務實例 - 注意實例化順序以滿足依賴關係
// Standalone services (no other service dependencies, or only repo/cache dependencies)
const stockOperationService = new StockOperationService();
const stockTransferService = new StockTransferService();

const inventoryItemService = new InventoryItemService(
  inventoryItemRepository,
  itemCache, 
  listCache
);

// StockAdjustmentService depends on repos and InventoryItemService, StockOperationService, StockTransferService
const stockAdjustmentService = new StockAdjustmentService(
  adjustmentRepository, 
  stockLevelRepository, 
  inventoryItemService,
  stockOperationService,
  stockTransferService
);

// StockLevelService depends on its repo, InventoryItemService, StockAdjustmentService, and caches
const stockLevelService = new StockLevelService(
  stockLevelRepository, 
  inventoryItemService,
  stockAdjustmentService, 
  stockLevelCache, 
  listCache
);

// 導出服務實例 (只導出頂層或最常用的服務，或根據需要全部導出)
export {
  inventoryItemService,
  stockLevelService,
  stockAdjustmentService,
  stockOperationService, // Might be useful for handlers if they need direct access
  stockTransferService,  // Might be useful for handlers if they need direct access
  itemCache,
  listCache,
  stockLevelCache
};

// 導出服務類 (通常用於類型註釋或特定情況下的實例化)
export * from './inventory-item.service';
export * from './stock-level.service';
export * from './stock-adjustment.service';
export * from './stock-transfer.service';
export * from './stock-operation.service'; 