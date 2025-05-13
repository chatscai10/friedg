/**
 * 庫存服務單元測試
 */

import * as admin from 'firebase-admin';
import { InventoryItemService, StockLevelService, StockAdjustmentService } from '../service';
import { StockAdjustmentType } from '../inventory.types';

// 模擬 Firestore
jest.mock('firebase-admin', () => {
  const mockFirestore = {
    collection: jest.fn(),
    runTransaction: jest.fn((fn) => fn(mockTransaction))
  };
  
  const mockTransaction = {
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn()
  };
  
  const mockCollection = {
    add: jest.fn(),
    doc: jest.fn(),
    where: jest.fn(),
    limit: jest.fn()
  };
  
  const mockQuery = {
    where: jest.fn(),
    limit: jest.fn(),
    get: jest.fn()
  };
  
  const mockDocRef = {
    update: jest.fn(),
    get: jest.fn(),
    set: jest.fn()
  };
  
  const mockQuerySnap = {
    empty: false,
    docs: []
  };
  
  // 建立返回鏈
  mockFirestore.collection.mockReturnValue(mockCollection);
  mockCollection.where.mockReturnValue(mockQuery);
  mockCollection.doc.mockReturnValue(mockDocRef);
  mockQuery.where.mockReturnValue(mockQuery);
  mockQuery.limit.mockReturnValue(mockQuery);
  mockQuery.get.mockResolvedValue(mockQuerySnap);
  mockDocRef.get.mockResolvedValue({
    exists: true,
    data: () => ({})
  });
  
  return {
    firestore: {
      Timestamp: {
        now: () => ({
          toDate: () => new Date()
        })
      }
    },
    initializeApp: jest.fn(),
    firestore: () => mockFirestore
  };
});

describe('InventoryItemService', () => {
  let service: InventoryItemService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    service = new InventoryItemService();
  });
  
  describe('createItem', () => {
    it('應該創建一個新的庫存項目', async () => {
      const mockAddFn = admin.firestore().collection('').add;
      mockAddFn.mockResolvedValueOnce({
        id: 'test-item-id',
        update: jest.fn().mockResolvedValueOnce({})
      });
      
      const itemData = {
        name: '測試品項',
        description: '測試描述',
        category: '測試分類',
        unit: '個',
        tenantId: 'test-tenant',
        isActive: true,
        createdBy: 'test-user',
        updatedBy: 'test-user'
      };
      
      const result = await service.createItem(itemData);
      
      expect(mockAddFn).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('itemId', 'test-item-id');
      expect(result).toHaveProperty('name', '測試品項');
    });
  });
  
  describe('getItem', () => {
    it('應該獲取一個庫存項目', async () => {
      const mockGetFn = admin.firestore().collection('').where('').limit(0).get;
      mockGetFn.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => ({
              itemId: 'test-item-id',
              name: '測試品項',
              tenantId: 'test-tenant'
            })
          }
        ]
      });
      
      const result = await service.getItem('test-item-id', 'test-tenant');
      
      expect(result).toHaveProperty('itemId', 'test-item-id');
      expect(result).toHaveProperty('name', '測試品項');
    });
    
    it('當品項不存在時應該回傳 null', async () => {
      const mockGetFn = admin.firestore().collection('').where('').limit(0).get;
      mockGetFn.mockResolvedValueOnce({
        empty: true,
        docs: []
      });
      
      const result = await service.getItem('non-existent-id', 'test-tenant');
      
      expect(result).toBeNull();
    });
  });
});

describe('StockAdjustmentService', () => {
  let service: StockAdjustmentService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    service = new StockAdjustmentService();
  });
  
  describe('createAdjustment', () => {
    it('應該創建庫存調整', async () => {
      // 模擬物品存在
      const mockGetFn = admin.firestore().collection('').where('').limit(0).get;
      mockGetFn.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => ({
              itemId: 'test-item-id',
              name: '測試品項',
              lowStockThreshold: 10
            })
          }
        ]
      });
      
      // 模擬事務
      const mockRunTransaction = admin.firestore().runTransaction;
      mockRunTransaction.mockImplementationOnce(async (fn) => {
        // 模擬庫存水平查詢
        const mockTransactionGet = jest.fn();
        mockTransactionGet.mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              ref: {
                id: 'stock-level-id'
              },
              data: () => ({
                stockLevelId: 'stock-level-id',
                quantity: 100,
                lowStockThreshold: 20
              })
            }
          ]
        });
        
        const mockTransaction = {
          get: mockTransactionGet,
          set: jest.fn(),
          update: jest.fn()
        };
        
        return fn(mockTransaction);
      });
      
      const result = await service.createAdjustment(
        'test-tenant',
        'test-item-id',
        'test-store',
        StockAdjustmentType.RECEIPT,
        10,
        'test-user'
      );
      
      expect(result).toHaveProperty('adjustmentId');
      expect(result).toHaveProperty('itemId', 'test-item-id');
      expect(result).toHaveProperty('quantityAdjusted', 10);
    });
    
    it('處理移撥情況時應該創建兩個調整記錄', async () => {
      // 模擬物品存在
      const mockGetFn = admin.firestore().collection('').where('').limit(0).get;
      mockGetFn.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => ({
              itemId: 'test-item-id',
              name: '測試品項',
              lowStockThreshold: 10
            })
          }
        ]
      });
      
      // 模擬事務
      const mockRunTransaction = admin.firestore().runTransaction;
      let setCallCount = 0;
      mockRunTransaction.mockImplementationOnce(async (fn) => {
        // 模擬來源庫存水平查詢
        const mockTransactionGet = jest.fn();
        mockTransactionGet.mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              ref: {
                id: 'source-level-id'
              },
              data: () => ({
                stockLevelId: 'source-level-id',
                quantity: 100,
                lowStockThreshold: 20
              })
            }
          ]
        });
        
        // 模擬目標庫存水平查詢
        mockTransactionGet.mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              ref: {
                id: 'target-level-id'
              },
              data: () => ({
                stockLevelId: 'target-level-id',
                quantity: 50,
                lowStockThreshold: 15
              })
            }
          ]
        });
        
        const mockTransaction = {
          get: mockTransactionGet,
          set: jest.fn().mockImplementation(() => {
            setCallCount += 1;
            return {};
          }),
          update: jest.fn()
        };
        
        return fn(mockTransaction);
      });
      
      const result = await service.createAdjustment(
        'test-tenant',
        'test-item-id',
        'source-store',
        StockAdjustmentType.TRANSFER,
        -10, // 負數表示出庫
        'test-user',
        {
          transferToStoreId: 'target-store'
        }
      );
      
      expect(result).toHaveProperty('adjustmentId');
      expect(result).toHaveProperty('adjustmentType', StockAdjustmentType.TRANSFER);
      expect(result).toHaveProperty('transferToStoreId', 'target-store');
      expect(setCallCount).toBe(4); // 2個庫存水平 + 2個調整記錄
    });
  });
}); 