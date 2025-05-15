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

const mockFirestoreInstance = admin.firestore(); // Get the mocked instance

// Helper to reset and configure transaction.get for a specific document path and data
const mockGetDocument = (docPath: string, data: any, exists: boolean = true) => {
  (mockFirestoreInstance.collection as jest.Mock).mockImplementation(collectionName => {
    return {
      doc: jest.fn().mockImplementation(documentId => {
        const fullPath = `${collectionName}/${documentId}`;
        if (fullPath === docPath || documentId === docPath) { // Allow matching full path or just docId if collection is implied
          return {
            get: jest.fn().mockResolvedValue({
              exists,
              data: () => data,
              id: documentId,
              ref: { path: fullPath, id: documentId } // Add ref with path for logging/debugging
            }),
            path: fullPath // for debugging
          };
        }
        // Fallback for other doc calls within the same collection if necessary
        return { 
          get: jest.fn().mockResolvedValue({ exists: false, id: documentId, ref: {path: `${collectionName}/${documentId}`, id: documentId} }),
          path: `${collectionName}/${documentId}`
         }; 
      })
    };
  });
};

// Helper to setup a sequence of transaction.get calls if needed
const mockGetSequence = (getsConfig: Array<{pathPattern: RegExp | string, data: any, exists: boolean}>) => {
    let callIndex = 0;
    const mockGetImplementation = jest.fn().mockImplementation(docRef => {
        const currentConfig = getsConfig[callIndex];
        callIndex++;
        if (currentConfig && (
            (typeof currentConfig.pathPattern === 'string' && docRef.path === currentConfig.pathPattern) ||
            (currentConfig.pathPattern instanceof RegExp && currentConfig.pathPattern.test(docRef.path))
        )) {
            return Promise.resolve({
                exists: currentConfig.exists,
                data: () => currentConfig.data,
                id: docRef.id, // Use the ID from the ref
                ref: docRef
            });
        }
        // Fallback if path doesn't match or sequence is exhausted
        return Promise.resolve({ exists: false, id: docRef.id, ref: docRef });
    });
    (mockFirestoreInstance.runTransaction as jest.Mock).mockImplementation(async (fn) => {
        callIndex = 0; // Reset for each transaction
        const mockTransaction = {
            get: mockGetImplementation,
            set: jest.fn().mockReturnThis(), // mockResolvedValue(undefined) or mockReturnThis()
            update: jest.fn().mockReturnThis(), // mockResolvedValue(undefined) or mockReturnThis()
        };
        return fn(mockTransaction);
    });
    return { mockTransactionGet: mockGetImplementation };
};

describe('StockLevelService', () => {
  let stockLevelServiceInstance: StockLevelService;
  let mockStockAdjustmentService: StockAdjustmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    stockLevelServiceInstance = new StockLevelService();
    // We need to mock the dependency if upsertStockLevel_REFACTORED calls stockAdjustmentService
    // For now, let's assume we can spy/mock its methods if needed, or pass a mock instance.
    // The refactored method in service.ts directly calls global stockAdjustmentService
    // so we need to mock its methods on the global instance or via jest.spyOn.
    jest.spyOn(StockAdjustmentService.prototype, 'createAdjustmentRecordInTransaction_REFACTORED')
        .mockResolvedValue({} as any); // Adjust return value as needed
  });

  describe('upsertStockLevel_REFACTORED', () => {
    const tenantId = 'tenant-test';
    const storeId = 'store-alpha';
    const itemId = 'item-xyz'; // This is doc ID in menuItems
    const userId = 'user-test';

    it('should update stock for an existing menuItem and log adjustment', async () => {
      const existingMenuItem = {
        storeId,
        tenantId,
        stock: { current: 10, manageStock: true, lowStockThreshold: 5 },
        name: 'Test Item',
      };
      // Configure mock for runTransaction and the get within it
      const { mockTransactionGet } = mockGetSequence([
        { pathPattern: `menuItems/${itemId}`, data: existingMenuItem, exists: true }
      ]);
      
      const result = await stockLevelServiceInstance.upsertStockLevel_REFACTORED(
        itemId, storeId, tenantId, 25, 7, userId, 'Manual Update'
      );

      expect(admin.firestore().runTransaction).toHaveBeenCalledTimes(1);
      const transactionCallback = (admin.firestore().runTransaction as jest.Mock).mock.calls[0][0];
      const mockTransaction = { 
        get: mockTransactionGet, // Use the sequenced get
        update: jest.fn().mockReturnThis(), 
        set: jest.fn().mockReturnThis() 
      };
      await transactionCallback(mockTransaction); // Execute the transaction callback with a properly instrumented mock

      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(), // Firestore DocumentReference mock
        expect.objectContaining({
          'stock.current': 25,
          'stock.lowStockThreshold': 7,
          'stock.manageStock': true,
          'updatedAt': expect.any(Date),
        })
      );
      expect(StockAdjustmentService.prototype.createAdjustmentRecordInTransaction_REFACTORED).toHaveBeenCalledWith(
        expect.anything(), // transaction object
        expect.objectContaining({
          itemId, storeId, tenantId,
          adjustmentType: StockAdjustmentType.STOCK_COUNT,
          quantityAdjusted: 15, // 25 - 10
          beforeQuantity: 10,
          afterQuantity: 25,
          operatorId: userId,
          reason: 'Manual Update',
        })
      );
      expect(result.quantity).toBe(25);
    });

    it('should throw error if menuItem not found', async () => {
      mockGetSequence([
        { pathPattern: `menuItems/${itemId}`, data: null, exists: false }
      ]);
      
      await expect(stockLevelServiceInstance.upsertStockLevel_REFACTORED(
        itemId, storeId, tenantId, 10, 5, userId
      )).rejects.toThrow(`[RefactoredUpsert] Menu item with ID ${itemId} not found.`);
    });

    it('should throw error if storeId mismatches', async () => {
      const existingMenuItem = { storeId: 'other-store', tenantId, stock: { current: 5 } };
      mockGetSequence([
        { pathPattern: `menuItems/${itemId}`, data: existingMenuItem, exists: true }
      ]);
      await expect(stockLevelServiceInstance.upsertStockLevel_REFACTORED(
        itemId, storeId, tenantId, 10, 5, userId
      )).rejects.toThrow(/is associated with store other-store/);
    });
    
    it('should throw error if tenantId mismatches', async () => {
      const existingMenuItem = { storeId, tenantId: 'other-tenant', stock: { current: 5 } };
      mockGetSequence([
         { pathPattern: `menuItems/${itemId}`, data: existingMenuItem, exists: true }
      ]);
      await expect(stockLevelServiceInstance.upsertStockLevel_REFACTORED(
        itemId, storeId, tenantId, 10, 5, userId
      )).rejects.toThrow(/tenant mismatch/);
    });
  });
});

describe('StockAdjustmentService', () => {
  let service: StockAdjustmentService;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks including spies
    service = new StockAdjustmentService();
     // Spy on the helper method within the same class, if it's called by createAdjustment_REFACTORED
    jest.spyOn(StockAdjustmentService.prototype, 'createAdjustmentRecordInTransaction_REFACTORED')
        .mockImplementation(async (transaction, details) => {
            // Simple mock implementation for the helper
            (transaction.set as jest.Mock).mockReturnThis(); // Simulate a set call
            return { 
                adjustmentId: 'mock-adj-id', 
                ...details, 
                createdAt: new Date(), 
                updatedAt: new Date() 
            } as StockAdjustment;
        });
  });

  describe('createAdjustment_REFACTORED', () => {
    const tenantId = 'tenant-abc';
    const sourceStoreId = 'store-1';
    const sourceItemId = 'item-doc-s1'; // Doc ID for item in source store
    const globalProductId = 'product-glob-001';
    const userId = 'user-adjuster';

    it('should create a RECEIPT adjustment, update stock, and log one adjustment record', async () => {
      const sourceMenuItemData = { 
        productId: globalProductId, 
        storeId: sourceStoreId, 
        tenantId, 
        name: 'Source Item',
        stock: { current: 50, manageStock: true } 
      };
      mockGetSequence([
        { pathPattern: `menuItems/${sourceItemId}`, data: sourceMenuItemData, exists: true }
      ]);

      const result = await service.createAdjustment_REFACTORED(
        tenantId, sourceItemId, sourceStoreId, StockAdjustmentType.RECEIPT,
        20, userId, { reason: 'New shipment' }
      );
      
      expect(admin.firestore().runTransaction).toHaveBeenCalledTimes(1);
      const transactionCallback = (admin.firestore().runTransaction as jest.Mock).mock.calls[0][0];
      const mockTransaction = { 
        get: jest.fn().mockImplementationOnce(() => Promise.resolve({ // Mock the get for sourceMenuItemRef
            exists: true, data: () => sourceMenuItemData, id: sourceItemId, ref: { path: `menuItems/${sourceItemId}`, id: sourceItemId }
        })),
        update: jest.fn().mockReturnThis(), 
        set: jest.fn().mockReturnThis() 
      };
      await transactionCallback(mockTransaction);

      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: `menuItems/${sourceItemId}` }),
        expect.objectContaining({ 'stock.current': 70 }) // 50 + 20
      );
      expect(StockAdjustmentService.prototype.createAdjustmentRecordInTransaction_REFACTORED).toHaveBeenCalledTimes(1);
      expect(StockAdjustmentService.prototype.createAdjustmentRecordInTransaction_REFACTORED).toHaveBeenCalledWith(
        expect.anything(), // transaction
        expect.objectContaining({
          itemId: sourceItemId, storeId: sourceStoreId, adjustmentType: StockAdjustmentType.RECEIPT,
          quantityAdjusted: 20, beforeQuantity: 50, afterQuantity: 70,
        })
      );
      expect(result.sourceAdjustment).toBeDefined();
      expect(result.targetAdjustment).toBeUndefined();
    });

    it('should create a TRANSFER adjustment, update source/target stock, and log two adjustment records', async () => {
      const targetStoreId = 'store-2';
      const targetItemId = 'item-doc-s2'; // Doc ID for the same product in target store
      const sourceMenuItemData = { productId: globalProductId, storeId: sourceStoreId, tenantId, name: 'Transfer Item', stock: { current: 100 } };
      const targetMenuItemData = { productId: globalProductId, storeId: targetStoreId, tenantId, name: 'Transfer Item', stock: { current: 30 } };

      // Setup sequence for transaction gets: 1st for source, 2nd for target lookup
      const { mockTransactionGet } = mockGetSequence([
        { pathPattern: `menuItems/${sourceItemId}`, data: sourceMenuItemData, exists: true }, // Source item get
        {  // Target item get (mocking a collection().where().limit().get() structure)
          // This mock for "where" queries is a bit tricky with the current simple mockGetDocument.
          // We'll assume the transaction.get is called with a DocumentReference for the target.
          // This means the query to find the target item happens *before* this transaction.get or is more complex.
          // For simplicity of this mock, let's assume the target Ref is known and passed to transaction.get.
          // A more robust mock would mock the query part.
          // For now, we'll assume the `createAdjustment_REFACTORED` internally resolves the target Ref
          // and then calls transaction.get(targetRef). We need to mock that second get.
          // The mockGetSequence is set up to handle multiple .get calls in a transaction
          pathPattern: /menuItems\/.*/, // A bit generic for the second call, assuming it's a menuItems doc
          data: targetMenuItemData, 
          exists: true 
        }
      ]);
      
      // Mock the collection().where()...get() for finding the target item
      (mockFirestoreInstance.collection as jest.Mock).mockImplementation(collectionName => {
        if (collectionName === 'menuItems') {
          return {
            where: jest.fn().mockReturnThis(), // chainable
            limit: jest.fn().mockReturnThis(), // chainable
            get: jest.fn().mockImplementation(() => {
                // This mock needs to be smart based on the where clauses for target item
                // For this test, specifically return the target item for the transfer lookup
                return Promise.resolve({ 
                    empty: false, 
                    docs: [{ 
                        ref: { id: targetItemId, path: `menuItems/${targetItemId}` }, 
                        data: () => targetMenuItemData 
                    }] 
                });
            }),
            doc: jest.fn(docId => ({ // For source item direct doc get
                get: jest.fn().mockResolvedValue({
                    exists: docId === sourceItemId,
                    data: () => sourceMenuItemData,
                    id: docId, ref: {id: docId, path: `menuItems/${docId}`}
                }),
                path: `menuItems/${docId}`
            }))
          };
        }
        return { doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({exists: false})})) }; // Default for other collections
      });


      const result = await service.createAdjustment_REFACTORED(
        tenantId, sourceItemId, sourceStoreId, StockAdjustmentType.TRANSFER,
        -15, userId, { reason: 'Store transfer', transferToStoreId: targetStoreId, productId: globalProductId }
      );
      expect(admin.firestore().runTransaction).toHaveBeenCalledTimes(1);
      
      // Manually simulate the transaction execution for verification
      const transactionCallback = (admin.firestore().runTransaction as jest.Mock).mock.calls[0][0];
      const mockTransactionObject = {
          get: mockTransactionGet, // The sequenced get
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis()
      };
      await transactionCallback(mockTransactionObject);

      // Verify source stock update
      expect(mockTransactionObject.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: `menuItems/${sourceItemId}` }),
        expect.objectContaining({ 'stock.current': 85 }) // 100 - 15
      );
      // Verify target stock update
      expect(mockTransactionObject.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: `menuItems/${targetItemId}` }), // Assuming target Ref path is correctly constructed
        expect.objectContaining({ 'stock.current': 45 }) // 30 + 15
      );

      expect(StockAdjustmentService.prototype.createAdjustmentRecordInTransaction_REFACTORED).toHaveBeenCalledTimes(2);
      // Source adjustment record
      expect(StockAdjustmentService.prototype.createAdjustmentRecordInTransaction_REFACTORED).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          itemId: sourceItemId, storeId: sourceStoreId, adjustmentType: StockAdjustmentType.TRANSFER,
          quantityAdjusted: -15, transferToStoreId: targetStoreId
        })
      );
      // Target adjustment record (as RECEIPT)
      expect(StockAdjustmentService.prototype.createAdjustmentRecordInTransaction_REFACTORED).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          itemId: targetItemId, storeId: targetStoreId, adjustmentType: StockAdjustmentType.RECEIPT,
          quantityAdjusted: 15 
        })
      );
      expect(result.sourceAdjustment).toBeDefined();
      expect(result.targetAdjustment).toBeDefined();
    });

    it('should throw error if source menuItem not found', async () => {
      mockGetSequence([
        { pathPattern: `menuItems/${sourceItemId}`, data: null, exists: false }
      ]);
      await expect(service.createAdjustment_REFACTORED(
        tenantId, sourceItemId, sourceStoreId, StockAdjustmentType.ISSUE, -5, userId
      )).rejects.toThrow(/Source Menu item with ID .* not found/);
    });
    
    it('should throw error for TRANSFER if target menuItem lookup fails (e.g. by productId and targetStoreId)', async () => {
        const sourceMenuItemData = { productId: globalProductId, storeId: sourceStoreId, tenantId, stock: { current: 10 } };
        // Mock source item found
        (mockFirestoreInstance.collection('menuItems').doc as jest.Mock).mockImplementation(docId => {
            if (docId === sourceItemId) {
                return { get: jest.fn().mockResolvedValue({ exists: true, data: () => sourceMenuItemData, id: sourceItemId, ref: {id: sourceItemId, path: `menuItems/${sourceItemId}`} }) };
            }
            return { get: jest.fn().mockResolvedValue({ exists: false }) };
        });
        // Mock target item NOT found by query
        (mockFirestoreInstance.collection('menuItems').where as jest.Mock).mockImplementation(() => ({
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({ empty: true, docs: [] }) 
        }));

        await expect(service.createAdjustment_REFACTORED(
            tenantId, sourceItemId, sourceStoreId, StockAdjustmentType.TRANSFER,
            -5, userId, { transferToStoreId: 'store-nonexistent', productId: globalProductId }
        )).rejects.toThrow(/Product .* not found in destination store/);
    });
    
    it('should correctly handle isInitialStock flag', async () => {
        const initialStockQty = 75;
        const sourceMenuItemData = { productId: globalProductId, storeId: sourceStoreId, tenantId, stock: { current: 0 } }; // Starting at 0
         mockGetSequence([
            { pathPattern: `menuItems/${sourceItemId}`, data: sourceMenuItemData, exists: true }
        ]);

        await service.createAdjustment_REFACTORED(
            tenantId, sourceItemId, sourceStoreId, StockAdjustmentType.INITIAL_STOCK,
            initialStockQty, userId, { isInitialStock: true }
        );
        
        const transactionCallback = (admin.firestore().runTransaction as jest.Mock).mock.calls[0][0];
        const mockTransaction = { 
            get: jest.fn().mockResolvedValue({exists: true, data: () => sourceMenuItemData, id: sourceItemId, ref: {path: `menuItems/${sourceItemId}`, id: sourceItemId}}),
            update: jest.fn().mockReturnThis(), 
            set: jest.fn().mockReturnThis() 
        };
        await transactionCallback(mockTransaction);

        expect(mockTransaction.update).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ 'stock.current': initialStockQty })
        );
        expect(StockAdjustmentService.prototype.createAdjustmentRecordInTransaction_REFACTORED).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                adjustmentType: StockAdjustmentType.INITIAL_STOCK,
                quantityAdjusted: initialStockQty, // Delta is initialStockQty - 0
                beforeQuantity: 0,
                afterQuantity: initialStockQty,
            })
        );
    });

  });
  
  // Test for createAdjustmentRecordInTransaction_REFACTORED (helper) can also be added if needed directly,
  // though it's indirectly tested via createAdjustment_REFACTORED.
});

// jest.clearAllMocks(); // Should be in afterEach or beforeEach if necessary globally

// jest.clearAllMocks(); // Should be in afterEach or beforeEach if necessary globally 