/**
 * 庫存服務模組索引
 */
import { InventoryItemService } from './inventory-item.service';
import { InventoryItemRepository } from '../repositories/inventory-item.repository';
import { StockLevelService } from './stock-level.service';
import { StockLevelRepository } from '../repositories/stock-level.repository';
import { StockAdjustmentService } from './adjustment/stock-adjustment.service';
import { StockAdjustmentRepository } from '../repositories/stock-adjustment.repository';
import { StockTransferService } from './stock-transfer.service';
import { ImportExportService } from './import-export.service';
import { StockOperationService } from './stock-operation.service';
import { BatchOperationService } from './batch-operation.service';
import { RestorationService } from './restoration.service';

// 創建儲存庫實例
const inventoryItemRepository = new InventoryItemRepository();
const stockLevelRepository = new StockLevelRepository();
const adjustmentRepository = new StockAdjustmentRepository();

// 創建服務實例
const inventoryItemService = new InventoryItemService(inventoryItemRepository);
const stockLevelService = new StockLevelService(stockLevelRepository, inventoryItemService);
const stockAdjustmentService = new StockAdjustmentService(
  adjustmentRepository, 
  stockLevelRepository, 
  inventoryItemService
);
const importExportService = new ImportExportService(
  inventoryItemService,
  stockLevelService
);
const stockOperationService = new StockOperationService();
const batchOperationService = new BatchOperationService();
const restorationService = new RestorationService();

// 導出服務
export {
  inventoryItemService,
  stockLevelService,
  stockAdjustmentService,
  importExportService,
  stockOperationService,
  batchOperationService,
  restorationService
};

// 導出服務類
export * from './inventory-item.service';
export * from './stock-level.service';
export * from './adjustment';
export * from './stock-transfer.service';
export * from './stock-operation.service';
export * from './batch-operation.service';
export * from './import-export.service';
export * from './restoration.service'; 