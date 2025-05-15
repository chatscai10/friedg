import sinon from 'sinon';
import admin from 'firebase-admin';
import functions from 'firebase-functions';

// --- Mocks ---
const loggerStub = {
  info: sinon.stub(),
  error: sinon.stub(),
  warn: sinon.stub(),
  debug: sinon.stub(),
};
if (!(functions as any).logger?.info?.isSinonProxy) {
    (functions as any).logger = loggerStub;
}

// Mock Firestore Transaction and collection methods for menuItems
const mockTransactionGet = sinon.stub();
const mockTransactionUpdate = sinon.stub();
const mockTransaction = {
  get: mockTransactionGet,
  update: mockTransactionUpdate,
  set: sinon.stub(), // Not used by deductStock but part of typical transaction mock
};

const mockMenuItemDoc = sinon.stub().returns({ 
    // no methods needed here as transaction.get(ref) is used
});
const mockMenuItemsCollection = sinon.stub().returns({ doc: mockMenuItemDoc });

if (typeof admin.firestore === 'function') {
    const mockDbInstance = { collection: mockMenuItemsCollection }; // Only need collection for menuItems
    sinon.stub(admin, 'firestore').get(() => () => mockDbInstance);
} else {
    console.warn("admin.firestore is not a function, mocking might be incomplete for InventoryService tests.");
}

// --- Import the service AFTER mocks are set up ---
import { InventoryServiceV2 } from './inventory.service.v2';
import { StockItem, MenuItemStockDoc, InventoryServiceError } from './inventory.types.v2';

describe('InventoryServiceV2', () => {
  let service: InventoryServiceV2;

  beforeEach(() => {
    sinon.resetHistory();
    mockTransactionGet.reset();
    mockTransactionUpdate.reset();
    mockMenuItemDoc.resetHistory();
    mockMenuItemsCollection.resetHistory();
    service = new InventoryServiceV2();
  });

  afterAll(() => {
    sinon.restore();
  });

  describe('deductStock', () => {
    const mockItemsToDeduct: StockItem[] = [
      { menuItemId: 'item-A', quantityToDeduct: 2 },
      { menuItemId: 'item-B', quantityToDeduct: 1 },
    ];

    it('should successfully deduct stock for all items if available and managed', async () => {
      const menuItemAData: Partial<MenuItemStockDoc> = {
        name: 'Item A',
        manageStock: true,
        stock: { current: 5, lowStockThreshold: 1 },
      };
      const menuItemBData: Partial<MenuItemStockDoc> = {
        name: 'Item B',
        manageStock: true,
        stock: { current: 10, lowStockThreshold: 2 },
      };
      mockTransactionGet.onFirstCall().resolves({ exists: true, data: () => menuItemAData });
      mockTransactionGet.onSecondCall().resolves({ exists: true, data: () => menuItemBData });
      mockTransactionUpdate.resolves(); // Simulate successful update

      await service.deductStock(mockTransaction as any, mockItemsToDeduct, 'order-test-1');

      expect(mockMenuItemsCollection.calledWith('menuItems')).toBe(true);
      expect(mockMenuItemDoc.calledWith('item-A')).toBe(true);
      expect(mockMenuItemDoc.calledWith('item-B')).toBe(true);
      expect(mockTransactionGet.callCount).toBe(2);
      expect(mockTransactionUpdate.callCount).toBe(2);
      expect(mockTransactionUpdate.firstCall.args[1]).toEqual({ 'stock.current': 3 }); // 5 - 2
      expect(mockTransactionUpdate.secondCall.args[1]).toEqual({ 'stock.current': 9 }); // 10 - 1
    });

    it('should skip deduction for items not managing stock', async () => {
      const menuItemAData: Partial<MenuItemStockDoc> = {
        name: 'Item A (No Stock Mgmt)',
        manageStock: false, // Does not manage stock
        stock: { current: 5 },
      };
      mockTransactionGet.resolves({ exists: true, data: () => menuItemAData });

      await service.deductStock(mockTransaction as any, [{ menuItemId: 'item-A', quantityToDeduct: 1 }], 'order-test-2');

      expect(mockTransactionGet.calledOnce).toBe(true);
      expect(mockTransactionUpdate.notCalled).toBe(true); // Update should not be called
    });

    it('should throw InventoryServiceError if item not found', async () => {
      mockTransactionGet.resolves({ exists: false }); // Item does not exist

      await expect(service.deductStock(mockTransaction as any, [{ menuItemId: 'item-NotFound', quantityToDeduct: 1 }], 'order-test-3'))
        .rejects.toThrow(InventoryServiceError);
      await expect(service.deductStock(mockTransaction as any, [{ menuItemId: 'item-NotFound', quantityToDeduct: 1 }], 'order-test-3'))
        .rejects.toMatchObject({ details: { itemId: 'item-NotFound', reason: 'not_found' } });
      expect(mockTransactionUpdate.notCalled).toBe(true);
    });
    
    it('should throw InventoryServiceError if item has invalid stock data', async () => {
        const menuItemInvalidData: Partial<MenuItemStockDoc> = {
            name: 'Item Invalid',
            manageStock: true,
            stock: undefined as any, // Invalid stock structure
        };
        mockTransactionGet.resolves({ exists: true, data: () => menuItemInvalidData });

        await expect(service.deductStock(mockTransaction as any, [{ menuItemId: 'item-Invalid', quantityToDeduct: 1 }], 'order-test-inv-data'))
            .rejects.toThrow(InventoryServiceError);
        await expect(service.deductStock(mockTransaction as any, [{ menuItemId: 'item-Invalid', quantityToDeduct: 1 }], 'order-test-inv-data'))
            .rejects.toMatchObject({ details: { itemId: 'item-Invalid', reason: 'invalid_stock_data' } });
    });

    it('should throw InventoryServiceError if stock is insufficient', async () => {
      const menuItemAData: Partial<MenuItemStockDoc> = {
        name: 'Item A Insufficient',
        manageStock: true,
        stock: { current: 1 }, // Only 1 available
      };
      mockTransactionGet.resolves({ exists: true, data: () => menuItemAData });

      await expect(service.deductStock(mockTransaction as any, [{ menuItemId: 'item-A', quantityToDeduct: 2 }], 'order-test-4'))
        .rejects.toThrow(InventoryServiceError);
      await expect(service.deductStock(mockTransaction as any, [{ menuItemId: 'item-A', quantityToDeduct: 2 }], 'order-test-4'))
        .rejects.toMatchObject({ 
            details: { 
                itemId: 'item-A', 
                reason: 'insufficient_stock', 
                required: 2, 
                available: 1 
            }
        });
      expect(mockTransactionUpdate.notCalled).toBe(true);
    });
    
    it('should do nothing if itemsToDeduct is empty or undefined', async () => {
        await service.deductStock(mockTransaction as any, [], 'order-test-empty');
        expect(mockTransactionGet.notCalled).toBe(true);
        expect(mockTransactionUpdate.notCalled).toBe(true);

        await service.deductStock(mockTransaction as any, undefined as any, 'order-test-undef');
        expect(mockTransactionGet.notCalled).toBe(true);
        expect(mockTransactionUpdate.notCalled).toBe(true);
    });

  });
}); 