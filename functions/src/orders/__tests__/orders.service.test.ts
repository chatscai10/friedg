import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { listOrders, getOrderById } from '../orders.service';
import { OrderStatus } from '../types';

// Mock Firebase Admin
jest.mock('firebase-admin', () => {
  const firebaseMock = {
    firestore: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      startAfter: jest.fn().mockReturnThis(),
      get: jest.fn(),
      count: jest.fn().mockReturnThis(),
      runTransaction: jest.fn()
    }),
    initializeApp: jest.fn(),
    app: jest.fn()
  };
  
  // Mock Timestamp
  const Timestamp = {
    now: jest.fn().mockReturnValue({
      toDate: jest.fn().mockReturnValue(new Date())
    }),
    fromDate: jest.fn().mockImplementation(date => ({
      toDate: jest.fn().mockReturnValue(date)
    }))
  };
  
  return {
    ...firebaseMock,
    firestore: {
      ...firebaseMock.firestore,
      Timestamp,
      FieldValue: {
        serverTimestamp: jest.fn(),
        increment: jest.fn().mockImplementation(n => n)
      }
    }
  };
});

// Mock Firebase Functions Logger
jest.mock('firebase-functions', () => {
  return {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    },
    https: {
      HttpsError: jest.fn()
    }
  };
});

describe('訂單服務 (Order Service)', () => {
  // 為每個測試重置模擬
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listOrders', () => {
    const mockTenantId = 'tenant-123';
    const mockTimestamp = {
      toDate: jest.fn().mockReturnValue(new Date('2023-01-01'))
    };
    
    // 模擬訂單數據
    const mockOrders = [
      {
        id: 'order-1',
        tenantId: mockTenantId,
        status: OrderStatus.PENDING,
        customerId: 'customer-1',
        storeId: 'store-1',
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
        isDeleted: false,
        estimatedPickupTime: mockTimestamp,
        actualPickupTime: null,
        // 其他必要的訂單屬性...
      },
      {
        id: 'order-2',
        tenantId: mockTenantId,
        status: OrderStatus.COMPLETED,
        customerId: 'customer-2',
        storeId: 'store-2',
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
        isDeleted: false,
        estimatedPickupTime: mockTimestamp,
        actualPickupTime: mockTimestamp,
        // 其他必要的訂單屬性...
      }
    ];

    // 模擬查詢結果
    const mockQuerySnapshot = {
      forEach: jest.fn().mockImplementation(callback => {
        mockOrders.forEach((order, index) => {
          callback({
            id: order.id,
            data: () => ({ ...order, id: undefined }), // 排除 id，因為它來自 doc.id
            ref: { id: order.id }
          });
        });
      }),
      docs: mockOrders.map(order => ({
        id: order.id,
        data: () => ({ ...order, id: undefined }),
        ref: { id: order.id }
      })),
      size: mockOrders.length
    };

    // 模擬計數查詢結果
    const mockCountSnapshot = {
      data: jest.fn().mockReturnValue({ count: mockOrders.length })
    };

    test('應正確返回基本查詢結果（無篩選條件）', async () => {
      // 設置 mock
      const firestoreMock = admin.firestore();
      firestoreMock.collection().where().where().get.mockResolvedValueOnce(mockQuerySnapshot);
      firestoreMock.collection().where().where().count().get.mockResolvedValueOnce(mockCountSnapshot);

      // 執行函數
      const result = await listOrders(mockTenantId, {});

      // 驗證查詢構建
      expect(firestoreMock.collection).toHaveBeenCalledWith('orders');
      expect(firestoreMock.collection().where).toHaveBeenCalledWith('tenantId', '==', mockTenantId);
      expect(firestoreMock.collection().where().where).toHaveBeenCalledWith('isDeleted', '==', false);
      expect(firestoreMock.collection().where().where().count).toHaveBeenCalled();
      expect(firestoreMock.collection().where().where().orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(firestoreMock.collection().where().where().orderBy().limit).toHaveBeenCalledWith(10);

      // 驗證結果
      expect(result.orders.length).toBe(mockOrders.length);
      expect(result.total).toBe(mockOrders.length);
      expect(result.lastVisible).toBeDefined();
      expect(result.orders[0].id).toBe('order-1');
      expect(result.orders[1].id).toBe('order-2');
      expect(result.orders[0].createdAt).toBeInstanceOf(Date);
      expect(result.orders[0].updatedAt).toBeInstanceOf(Date);
    });

    test('應正確處理按狀態篩選', async () => {
      // 設置 mock
      const firestoreMock = admin.firestore();
      firestoreMock.collection().where().where().where().get.mockResolvedValueOnce(mockQuerySnapshot);
      firestoreMock.collection().where().where().where().count().get.mockResolvedValueOnce(mockCountSnapshot);

      // 執行函數
      const result = await listOrders(mockTenantId, { status: OrderStatus.PENDING });

      // 驗證查詢構建
      expect(firestoreMock.collection().where().where().where).toHaveBeenCalledWith('status', '==', OrderStatus.PENDING);
      expect(firestoreMock.collection().where().where().where().count).toHaveBeenCalled();
      expect(firestoreMock.collection().where().where().where().orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    test('應正確處理按客戶ID篩選', async () => {
      // 設置 mock
      const firestoreMock = admin.firestore();
      firestoreMock.collection().where().where().where().get.mockResolvedValueOnce(mockQuerySnapshot);
      firestoreMock.collection().where().where().where().count().get.mockResolvedValueOnce(mockCountSnapshot);

      // 執行函數
      const result = await listOrders(mockTenantId, { customerId: 'customer-1' });

      // 驗證查詢構建
      expect(firestoreMock.collection().where().where().where).toHaveBeenCalledWith('customerId', '==', 'customer-1');
    });

    test('應正確處理按店鋪ID篩選', async () => {
      // 設置 mock
      const firestoreMock = admin.firestore();
      firestoreMock.collection().where().where().where().get.mockResolvedValueOnce(mockQuerySnapshot);
      firestoreMock.collection().where().where().where().count().get.mockResolvedValueOnce(mockCountSnapshot);

      // 執行函數
      const result = await listOrders(mockTenantId, { storeId: 'store-1' });

      // 驗證查詢構建
      expect(firestoreMock.collection().where().where().where).toHaveBeenCalledWith('storeId', '==', 'store-1');
    });

    test('應正確處理日期範圍篩選', async () => {
      // 設置 mock
      const firestoreMock = admin.firestore();
      firestoreMock.collection().where().where().where().where().get.mockResolvedValueOnce(mockQuerySnapshot);
      firestoreMock.collection().where().where().where().where().count().get.mockResolvedValueOnce(mockCountSnapshot);
      
      const dateFrom = '2023-01-01';
      const dateTo = '2023-01-31';

      // 執行函數
      const result = await listOrders(mockTenantId, { dateFrom, dateTo });

      // 驗證查詢構建
      // 檢查 dateFrom 的處理
      expect(firestoreMock.collection().where().where().where).toHaveBeenCalledWith(
        'createdAt', '>=', expect.any(Date)
      );
      
      // 檢查 dateTo 的處理
      expect(firestoreMock.collection().where().where().where().where).toHaveBeenCalledWith(
        'createdAt', '<=', expect.any(Date)
      );
      
      // 檢查排序邏輯（當有日期範圍篩選時，應首先按 createdAt 排序）
      expect(firestoreMock.collection().where().where().where().where().orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    test('當有日期範圍篩選且排序欄位不是 createdAt 時應正確處理排序', async () => {
      // 設置 mock
      const firestoreMock = admin.firestore();
      firestoreMock.collection().where().where().where().where().get.mockResolvedValueOnce(mockQuerySnapshot);
      firestoreMock.collection().where().where().where().where().count().get.mockResolvedValueOnce(mockCountSnapshot);
      
      // 執行函數
      const result = await listOrders(mockTenantId, { 
        dateFrom: '2023-01-01', 
        sortBy: 'totalAmount', 
        sortDirection: 'asc' 
      });

      // 驗證排序邏輯
      // 首先應按 createdAt 排序（因為有日期範圍篩選）
      expect(firestoreMock.collection().where().where().where().orderBy).toHaveBeenCalledWith('createdAt', 'asc');
      
      // 然後應按指定的欄位排序
      expect(firestoreMock.collection().where().where().where().orderBy().orderBy).toHaveBeenCalledWith('totalAmount', 'asc');
    });

    test('應正確處理分頁 (startAfter)', async () => {
      // 設置 mock
      const firestoreMock = admin.firestore();
      firestoreMock.collection().where().where().get.mockResolvedValueOnce(mockQuerySnapshot);
      firestoreMock.collection().where().where().count().get.mockResolvedValueOnce(mockCountSnapshot);
      
      const mockStartAfter = { id: 'previous-last-doc' };

      // 執行函數
      const result = await listOrders(mockTenantId, { startAfter: mockStartAfter });

      // 驗證分頁邏輯
      expect(firestoreMock.collection().where().where().orderBy().startAfter).toHaveBeenCalledWith(mockStartAfter);
    });

    test('應正確處理自定義每頁筆數 (limit)', async () => {
      // 設置 mock
      const firestoreMock = admin.firestore();
      firestoreMock.collection().where().where().get.mockResolvedValueOnce(mockQuerySnapshot);
      firestoreMock.collection().where().where().count().get.mockResolvedValueOnce(mockCountSnapshot);
      
      const customLimit = 20;

      // 執行函數
      const result = await listOrders(mockTenantId, { limit: customLimit });

      // 驗證限制邏輯
      expect(firestoreMock.collection().where().where().orderBy().limit).toHaveBeenCalledWith(customLimit);
    });

    test('應正確處理錯誤情況', async () => {
      // 設置 mock
      const firestoreMock = admin.firestore();
      const mockError = new Error('模擬 Firestore 錯誤');
      firestoreMock.collection().where().where().count().get.mockRejectedValueOnce(mockError);

      // 驗證錯誤處理
      await expect(listOrders(mockTenantId, {})).rejects.toThrow(/列出訂單失敗/);
      expect(functions.logger.error).toHaveBeenCalled();
    });
  });

  describe('getOrderById', () => {
    const mockTenantId = 'tenant-123';
    const mockOrderId = 'order-123';
    const mockTimestamp = {
      toDate: jest.fn().mockReturnValue(new Date('2023-01-01'))
    };
    
    // 模擬訂單數據
    const mockOrder = {
      id: mockOrderId,
      tenantId: mockTenantId,
      status: OrderStatus.PENDING,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      estimatedPickupTime: mockTimestamp,
      actualPickupTime: null,
      // 其他必要的訂單屬性...
    };

    // 模擬文檔快照
    const mockDocSnapshot = {
      exists: true,
      id: mockOrderId,
      data: jest.fn().mockReturnValue({ ...mockOrder, id: undefined }),
      ref: { id: mockOrderId }
    };

    test('應正確獲取存在的訂單', async () => {
      // 設置 mock
      const firestoreMock = admin.firestore();
      firestoreMock.collection().doc().get.mockResolvedValueOnce(mockDocSnapshot);

      // 執行函數
      const result = await getOrderById(mockTenantId, mockOrderId);

      // 驗證查詢構建
      expect(firestoreMock.collection).toHaveBeenCalledWith('orders');
      expect(firestoreMock.collection().doc).toHaveBeenCalledWith(mockOrderId);
      expect(firestoreMock.collection().doc().get).toHaveBeenCalled();

      // 驗證結果
      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockOrderId);
      expect(result?.tenantId).toBe(mockTenantId);
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.updatedAt).toBeInstanceOf(Date);
      expect(result?.estimatedPickupTime).toBeInstanceOf(Date);
      expect(result?.actualPickupTime).toBeNull();
    });

    test('當訂單不存在時應返回 null', async () => {
      // 設置 mock
      const firestoreMock = admin.firestore();
      const notFoundSnapshot = { ...mockDocSnapshot, exists: false };
      firestoreMock.collection().doc().get.mockResolvedValueOnce(notFoundSnapshot);

      // 執行函數
      const result = await getOrderById(mockTenantId, 'non-existent-order');

      // 驗證結果
      expect(result).toBeNull();
    });

    test('當租戶 ID 不匹配時應返回 null', async () => {
      // 設置 mock
      const firestoreMock = admin.firestore();
      const differentTenantOrder = { 
        ...mockOrder, 
        tenantId: 'different-tenant'
      };
      const differentTenantSnapshot = {
        ...mockDocSnapshot,
        data: jest.fn().mockReturnValue(differentTenantOrder)
      };
      firestoreMock.collection().doc().get.mockResolvedValueOnce(differentTenantSnapshot);

      // 執行函數
      const result = await getOrderById(mockTenantId, mockOrderId);

      // 驗證結果
      expect(result).toBeNull();
      expect(functions.logger.warn).toHaveBeenCalled();
    });

    test('應正確處理錯誤情況', async () => {
      // 設置 mock
      const firestoreMock = admin.firestore();
      const mockError = new Error('模擬 Firestore 錯誤');
      firestoreMock.collection().doc().get.mockRejectedValueOnce(mockError);

      // 驗證錯誤處理
      await expect(getOrderById(mockTenantId, mockOrderId)).rejects.toThrow(/獲取訂單失敗/);
      expect(functions.logger.error).toHaveBeenCalled();
    });
  });
}); 