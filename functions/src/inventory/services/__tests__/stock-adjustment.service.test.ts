/**
 * 庫存調整服務單元測試
 */
import * as admin from 'firebase-admin';
import { StockAdjustmentService } from '../adjustment/stock-adjustment.service';
import { StockAdjustmentRepository } from '../../repositories/stock-adjustment.repository';
import { StockLevelRepository } from '../../repositories/stock-level.repository';
import { InventoryItemService } from '../inventory-item.service';
import { StockAdjustmentType } from '../../inventory.types';
import { NegativeStockError, ItemNotFoundError, TransactionTooLargeError } from '../../utils/errors';
import { firestoreProvider } from '../../db/database.provider';
import { cacheManager } from '../../cache/cache-manager';

// 模擬依賴
jest.mock('../../repositories/stock-adjustment.repository');
jest.mock('../../repositories/stock-level.repository');
jest.mock('../inventory-item.service');
jest.mock('../../db/database.provider');
jest.mock('../../cache/cache-manager');

describe('StockAdjustmentService', () => {
  let service: StockAdjustmentService;
  let mockAdjustmentRepo: jest.Mocked<StockAdjustmentRepository>;
  let mockStockLevelRepo: jest.Mocked<StockLevelRepository>;
  let mockItemService: jest.Mocked<InventoryItemService>;
  let mockTransaction: jest.Mocked<admin.firestore.Transaction>;
  
  // 測試數據
  const tenantId = 'test-tenant';
  const itemId = 'test-item-1';
  const storeId = 'test-store-1';
  const userId = 'test-user-1';
  
  beforeEach(() => {
    // 清除所有模擬
    jest.clearAllMocks();
    
    // 創建模擬
    mockAdjustmentRepo = new StockAdjustmentRepository() as jest.Mocked<StockAdjustmentRepository>;
    mockStockLevelRepo = new StockLevelRepository() as jest.Mocked<StockLevelRepository>;
    mockItemService = new InventoryItemService() as jest.Mocked<InventoryItemService>;
    mockTransaction = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as unknown as jest.Mocked<admin.firestore.Transaction>;
    
    // 模擬 firestoreProvider.runTransaction
    (firestoreProvider.runTransaction as jest.Mock).mockImplementation(async (callback) => {
      return await callback(mockTransaction);
    });
    
    // 模擬 inventoryItemService.getItem
    mockItemService.getItem.mockResolvedValue({
      itemId,
      name: 'Test Item',
      sku: 'TST-001',
      lowStockThreshold: 5
    });
    
    // 創建服務實例
    service = new StockAdjustmentService(
      mockAdjustmentRepo,
      mockStockLevelRepo,
      mockItemService
    );
  });
  
  describe('createAdjustment', () => {
    // 測試創建一般調整
    it('should create a regular adjustment successfully', async () => {
      // 準備模擬數據
      const quantityAdjusted = 10;
      const adjustmentType = StockAdjustmentType.RECEIVED;
      
      // 模擬 transaction.get 返回的文檔
      const mockDocSnapshot = {
        exists: true,
        data: () => ({
          itemId,
          storeId,
          quantity: 20,
          lowStockThreshold: 5
        }),
        id: 'sl-1'
      };
      mockTransaction.get.mockResolvedValue(mockDocSnapshot);
      
      // 模擬 stockOperationService 方法 (透過 runTransaction 注入)
      (firestoreProvider.runTransaction as jest.Mock).mockImplementation(async (callback) => {
        // 使用模擬的事務對象調用回調
        const result = await callback({
          get: jest.fn().mockResolvedValue(mockDocSnapshot),
          update: jest.fn(),
          set: jest.fn(),
          delete: jest.fn()
        });
        
        // 模擬調整記錄返回
        return {
          adjustmentId: 'adj-1',
          itemId,
          storeId,
          tenantId,
          adjustmentType,
          quantityAdjusted,
          beforeQuantity: 20,
          afterQuantity: 30,
          operatorId: userId,
          adjustmentDate: new Date()
        };
      });
      
      // 執行測試
      const result = await service.createAdjustment(
        tenantId,
        itemId,
        storeId,
        adjustmentType,
        quantityAdjusted,
        userId
      );
      
      // 驗證結果
      expect(result).toBeDefined();
      expect(result.adjustmentId).toBe('adj-1');
      expect(result.quantityAdjusted).toBe(quantityAdjusted);
      expect(result.adjustmentType).toBe(adjustmentType);
      
      // 驗證 InventoryItemService.getItem 被調用
      expect(mockItemService.getItem).toHaveBeenCalledWith(itemId, tenantId);
      
      // 驗證 firestoreProvider.runTransaction 被調用
      expect(firestoreProvider.runTransaction).toHaveBeenCalled();
      
      // 驗證緩存被清除
      expect(cacheManager.invalidateByPrefix).toHaveBeenCalled();
    });
    
    // 測試創建調整時的品項不存在錯誤
    it('should throw ItemNotFoundError when item does not exist', async () => {
      // 模擬品項不存在
      mockItemService.getItem.mockResolvedValue(null);
      
      // 執行測試並期望拋出錯誤
      await expect(service.createAdjustment(
        tenantId,
        itemId,
        storeId,
        StockAdjustmentType.RECEIVED,
        10,
        userId
      )).rejects.toThrow(ItemNotFoundError);
    });
    
    // 測試負庫存錯誤
    it('should throw NegativeStockError when adjustment results in negative stock', async () => {
      // 準備模擬數據：當前庫存 10，嘗試調整 -15
      const currentQuantity = 10;
      const quantityAdjusted = -15;
      const adjustmentType = StockAdjustmentType.ADJUSTMENT;
      
      // 模擬 transaction.get 返回的文檔
      const mockDocSnapshot = {
        exists: true,
        data: () => ({
          itemId,
          storeId,
          quantity: currentQuantity,
          lowStockThreshold: 5
        }),
        id: 'sl-1'
      };
      
      // 模擬 stockOperationService 的行為
      (firestoreProvider.runTransaction as jest.Mock).mockImplementation(async (callback) => {
        // 使用模擬的事務對象調用回調
        return await callback({
          get: jest.fn().mockResolvedValue(mockDocSnapshot),
          update: jest.fn(),
          set: jest.fn(),
          delete: jest.fn()
        });
      });
      
      // 覆蓋正常的實現，讓其拋出 NegativeStockError
      (firestoreProvider.runTransaction as jest.Mock).mockRejectedValue(
        new NegativeStockError(itemId, storeId)
      );
      
      // 執行測試並期望拋出錯誤
      await expect(service.createAdjustment(
        tenantId,
        itemId,
        storeId,
        adjustmentType,
        quantityAdjusted,
        userId
      )).rejects.toThrow(NegativeStockError);
    });
  });
  
  describe('batchCreateAdjustments', () => {
    // 測試批量創建調整
    it('should create multiple adjustments in batch', async () => {
      // 準備模擬數據
      const adjustments = [
        {
          itemId: 'item-1',
          storeId: 'store-1',
          adjustmentType: StockAdjustmentType.RECEIVED,
          quantityAdjusted: 10
        },
        {
          itemId: 'item-2',
          storeId: 'store-1',
          adjustmentType: StockAdjustmentType.ADJUSTMENT,
          quantityAdjusted: -5
        }
      ];
      
      // 模擬 batchGetItems 返回的數據
      mockItemService.batchGetItems.mockResolvedValue({
        'item-1': {
          itemId: 'item-1',
          name: 'Item 1',
          lowStockThreshold: 5
        },
        'item-2': {
          itemId: 'item-2',
          name: 'Item 2',
          lowStockThreshold: 3
        }
      });
      
      // 模擬 processBatchAdjustments 的行為
      (firestoreProvider.runTransaction as jest.Mock).mockImplementation(async (callback) => {
        // 返回批量處理結果
        return {
          success: true,
          results: [
            { 
              itemId: 'item-1', 
              storeId: 'store-1', 
              success: true, 
              data: { adjustmentId: 'adj-1' } 
            },
            { 
              itemId: 'item-2', 
              storeId: 'store-1', 
              success: true, 
              data: { adjustmentId: 'adj-2' } 
            }
          ],
          successCount: 2,
          failureCount: 0,
          adjustments: [
            {
              adjustmentId: 'adj-1',
              itemId: 'item-1',
              storeId: 'store-1',
              tenantId,
              adjustmentType: StockAdjustmentType.RECEIVED,
              quantityAdjusted: 10
            },
            {
              adjustmentId: 'adj-2',
              itemId: 'item-2',
              storeId: 'store-1',
              tenantId,
              adjustmentType: StockAdjustmentType.ADJUSTMENT,
              quantityAdjusted: -5
            }
          ]
        };
      });
      
      // 執行測試
      const result = await service.batchCreateAdjustments(
        tenantId,
        adjustments,
        userId
      );
      
      // 驗證結果
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.adjustments).toHaveLength(2);
      
      // 驗證 batchGetItems 被調用
      expect(mockItemService.batchGetItems).toHaveBeenCalledWith(
        ['item-1', 'item-2'],
        tenantId
      );
      
      // 驗證 firestoreProvider.runTransaction 被調用
      expect(firestoreProvider.runTransaction).toHaveBeenCalled();
      
      // 驗證緩存被清除
      expect(cacheManager.invalidateByPrefix).toHaveBeenCalled();
    });
    
    // 測試批量創建超出上限
    it('should throw TransactionTooLargeError when batch size exceeds limit', async () => {
      // 創建超過限制的調整數組
      const adjustments = Array(101).fill(null).map((_, i) => ({
        itemId: `item-${i}`,
        storeId: 'store-1',
        adjustmentType: StockAdjustmentType.RECEIVED,
        quantityAdjusted: 1
      }));
      
      // 執行測試並期望拋出錯誤
      await expect(service.batchCreateAdjustments(
        tenantId,
        adjustments,
        userId
      )).rejects.toThrow(TransactionTooLargeError);
    });
  });
  
  describe('listAdjustments', () => {
    it('should return list of adjustments with caching', async () => {
      // 準備模擬數據
      const mockAdjustments = {
        items: [
          {
            adjustmentId: 'adj-1',
            itemId,
            storeId,
            adjustmentType: StockAdjustmentType.RECEIVED,
            quantityAdjusted: 10
          }
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        hasMore: false
      };
      
      // 模擬 cacheManager.get 返回 null (緩存未命中)
      (cacheManager.get as jest.Mock).mockReturnValue(null);
      
      // 模擬 repository.listAdjustments 返回
      mockAdjustmentRepo.listAdjustments.mockResolvedValue(mockAdjustments);
      
      // 執行測試
      const result = await service.listAdjustments(tenantId);
      
      // 驗證結果
      expect(result).toBeDefined();
      expect(result).toBe(mockAdjustments);
      
      // 驗證 repository.listAdjustments 被調用
      expect(mockAdjustmentRepo.listAdjustments).toHaveBeenCalledWith(
        tenantId,
        {},
        1,
        20
      );
      
      // 驗證緩存被設置
      expect(cacheManager.set).toHaveBeenCalled();
    });
    
    it('should return cached adjustments when available', async () => {
      // 準備模擬數據
      const mockCachedAdjustments = {
        items: [
          {
            adjustmentId: 'adj-1',
            itemId,
            storeId,
            adjustmentType: StockAdjustmentType.RECEIVED,
            quantityAdjusted: 10
          }
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        hasMore: false
      };
      
      // 模擬 cacheManager.get 返回緩存結果
      (cacheManager.get as jest.Mock).mockReturnValue(mockCachedAdjustments);
      
      // 執行測試
      const result = await service.listAdjustments(tenantId);
      
      // 驗證結果
      expect(result).toBeDefined();
      expect(result).toBe(mockCachedAdjustments);
      
      // 驗證 repository.listAdjustments 未被調用
      expect(mockAdjustmentRepo.listAdjustments).not.toHaveBeenCalled();
    });
  });
}); 